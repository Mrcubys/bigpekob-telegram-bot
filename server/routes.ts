import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertCommentSchema, updateUserProfileSchema, videos } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import express from "express";
import fs from "fs";
import path from "path";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { setupTelegramWebhook, handleTelegramUpdate } from "./telegram";

// Setup multer: use memory storage so we can save to DB as binary
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
  },
});

// Legacy file upload directory (for serving old file-based videos)
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Serve legacy file-based uploads
  app.use("/uploads", express.static(uploadDir));

  // === SESSION ===
  app.use(session({
    secret: process.env.SESSION_SECRET || "bigpekob-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    proxy: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // === PASSPORT ===
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return done(null, false, { message: "Invalid username or password" });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => done(null, user.id));

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // === AUTH ROUTES ===

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(input);
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login after register failed" });
        const { password: _, ...safeUser } = user as any;
        res.status(201).json(safeUser);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user as any;
        res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password: _, ...safeUser } = req.user as any;
    res.status(200).json(safeUser);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.put(api.auth.profile.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const input = updateUserProfileSchema.parse(req.body);
      const user = await storage.updateUserProfile((req.user as any).id, input);
      const { password: _, ...safeUser } = user as any;
      res.status(200).json(safeUser);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err.message === "Username already taken") {
        return res.status(409).json({ message: "Username already taken" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === VIDEO ROUTES ===

  app.get(api.videos.list.path, async (req, res) => {
    const currentUserId = req.isAuthenticated() ? (req.user as any).id : undefined;
    const videosList = await storage.getVideos(currentUserId);
    res.status(200).json(videosList);
  });

  // In-memory video cache (keyed by id, TTL 10 minutes)
  const videoCache = new Map<number, { data: Buffer; mimeType: string; etag: string; cachedAt: number }>();
  const VIDEO_CACHE_TTL = 10 * 60 * 1000;

  async function getCachedVideoData(id: number) {
    const cached = videoCache.get(id);
    if (cached && Date.now() - cached.cachedAt < VIDEO_CACHE_TTL) return cached;
    const videoData = await storage.getVideoData(id);
    if (!videoData) return null;
    const etag = `"${id}-${videoData.data.length}"`;
    const entry = { ...videoData, etag, cachedAt: Date.now() };
    videoCache.set(id, entry);
    // Evict old entries if cache grows too large
    if (videoCache.size > 30) {
      const oldest = [...videoCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
      videoCache.delete(oldest[0]);
    }
    return entry;
  }

  // Stream video from DB (optimized with cache + ETag)
  app.get("/api/videos/:id/stream", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    // Check if it's a file-based video (serve directly from disk - fastest)
    const [videoRow] = await db
      .select({ fileUrl: videos.fileUrl, mimeType: videos.mimeType })
      .from(videos)
      .where(eq(videos.id, id));

    if (!videoRow) return res.status(404).json({ message: "Video not found" });

    if (videoRow.fileUrl) {
      const filePath = path.join(process.cwd(), videoRow.fileUrl.startsWith("/") ? videoRow.fileUrl.slice(1) : videoRow.fileUrl);
      if (fs.existsSync(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.redirect(videoRow.fileUrl);
      }
    }

    const cached = await getCachedVideoData(id);
    if (!cached) return res.status(404).json({ message: "Video data not found" });

    const { data, mimeType, etag } = cached;
    const totalSize = data.length;
    const rangeHeader = req.headers.range;

    // ETag support — skip sending data if client already has it
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.setHeader("Content-Type", mimeType || "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? Math.min(parseInt(parts[1], 10), totalSize - 1) : Math.min(start + 5 * 1024 * 1024, totalSize - 1);
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      res.setHeader("Content-Length", chunkSize);
      res.end(data.slice(start, end + 1));
    } else {
      res.setHeader("Content-Length", totalSize);
      res.status(200).end(data);
    }
  });

  // VIP check endpoint (for Mini App)
  app.get("/api/vip/check", async (req, res) => {
    const telegramId = parseInt(req.query.telegram_id as string);
    if (isNaN(telegramId)) return res.status(400).json({ vip: false });
    const isVip = await storage.isVipUser(telegramId);
    res.json({ vip: isVip });
  });

  // Download video (VIP only)
  app.get("/api/videos/:id/download", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const telegramId = parseInt(req.query.telegram_id as string);
    if (!isNaN(telegramId)) {
      const isVip = await storage.isVipUser(telegramId);
      if (!isVip) return res.status(403).json({ message: "VIP only" });
    } else {
      return res.status(403).json({ message: "VIP only" });
    }

    const [videoRow] = await db
      .select({ fileUrl: videos.fileUrl, mimeType: videos.mimeType, title: videos.title })
      .from(videos)
      .where(eq(videos.id, id));
    if (!videoRow) return res.status(404).json({ message: "Not found" });

    const filename = `${videoRow.title?.replace(/[^a-z0-9]/gi, "_") || "video"}.mp4`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (videoRow.fileUrl) {
      const filePath = path.join(process.cwd(), videoRow.fileUrl.startsWith("/") ? videoRow.fileUrl.slice(1) : videoRow.fileUrl);
      if (fs.existsSync(filePath)) {
        res.setHeader("Content-Type", videoRow.mimeType || "video/mp4");
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    const cached = await getCachedVideoData(id);
    if (!cached) return res.status(404).json({ message: "Video data not found" });
    res.setHeader("Content-Type", cached.mimeType || "video/mp4");
    res.setHeader("Content-Length", cached.data.length);
    res.end(cached.data);
  });

  app.post(api.videos.upload.path, uploader.single("file"), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const title = req.body.title || "Untitled";
      const description = req.body.description || "";
      const mimeType = req.file.mimetype || "video/mp4";

      // Store binary in DB for persistence across environments
      const video = await storage.createVideo({
        title,
        description,
        userId: (req.user as any).id,
        videoData: req.file.buffer,
        mimeType,
      });

      res.status(201).json(video);
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  // Comments
  app.get("/api/videos/:id/comments", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const commentsList = await storage.getComments(id);
    res.status(200).json(commentsList);
  });

  app.post("/api/videos/:id/comments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const input = insertCommentSchema.parse(req.body);
      const comment = await storage.addComment((req.user as any).id, id, input.content);
      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Likes (toggle)
  app.post("/api/videos/:id/like", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const userId = (req.user as any).id;
    const alreadyLiked = await storage.isLiked(userId, id);

    if (alreadyLiked) {
      await storage.unlikeVideo(userId, id);
    } else {
      await storage.likeVideo(userId, id);
    }

    const likeCount = await storage.getLikeCount(id);
    res.status(200).json({ liked: !alreadyLiked, likeCount });
  });

  // === USER ROUTES ===

  app.get("/api/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const currentUserId = req.isAuthenticated() ? (req.user as any).id : undefined;
    const profile = await storage.getUserPublicProfile(id, currentUserId);
    if (!profile) return res.status(404).json({ message: "User not found" });
    res.status(200).json(profile);
  });

  app.get("/api/users/:id/videos", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const currentUserId = req.isAuthenticated() ? (req.user as any).id : undefined;
    const userVideos = await storage.getUserVideos(id, currentUserId);
    res.status(200).json(userVideos);
  });

  app.post("/api/users/:id/follow", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const followerId = (req.user as any).id;
    if (followerId === id) return res.status(400).json({ message: "Cannot follow yourself" });

    const alreadyFollowing = await storage.isFollowing(followerId, id);
    if (alreadyFollowing) {
      await storage.unfollowUser(followerId, id);
    } else {
      await storage.followUser(followerId, id);
    }
    res.status(200).json({ following: !alreadyFollowing });
  });

  // === SEARCH ===
  app.get("/api/search/users", async (req, res) => {
    const q = (req.query.q as string) || "";
    if (!q.trim()) return res.status(200).json([]);
    const currentUserId = req.isAuthenticated() ? (req.user as any).id : undefined;
    const results = await storage.searchUsers(q.trim(), currentUserId);
    res.status(200).json(results);
  });

  // === TELEGRAM WEBHOOK ===
  app.post("/api/telegram/webhook", express.json(), async (req, res) => {
    res.status(200).json({ ok: true });
    try {
      await handleTelegramUpdate(req.body);
    } catch (err) {
      console.error("[telegram] webhook error:", err);
    }
  });

  // Setup Telegram webhook on startup
  setupTelegramWebhook().catch(console.error);

  // Seed database
  setTimeout(async () => {
    try {
      const existingAdmin = await storage.getUserByUsername("admin");
      if (!existingAdmin) {
        const adminPassword = process.env.ADMIN_SEED_PASSWORD || "password";
        await storage.createUser({ username: "admin", password: adminPassword });
        console.log("Created seed user: admin (password from ADMIN_SEED_PASSWORD env var)");
      }
    } catch (err) {
      console.error("Seed error:", err);
    }
  }, 2000);

  return httpServer;
}
