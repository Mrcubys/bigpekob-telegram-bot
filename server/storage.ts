import { db } from "./db";
import {
  users, videos, follows, likes, comments, vipUsers, papDonations, channelConfig, telegramUsers, siteSettings,
  type User, type InsertUser, type UpdateUserProfile,
  type Video, type VideoResponse, type UserPublic, type CommentResponse,
  type VipUser, type PapDonation, type ChannelConfig, type TelegramUser,
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or, gt } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = connectPg(session);

export interface IStorage {
  // Auth
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createTelegramUser(data: { telegramId: number; firstName?: string; username?: string; photoUrl?: string }): Promise<User>;
  updateUserProfile(id: number, profile: UpdateUserProfile): Promise<User>;

  // Videos
  createVideo(data: { userId: number; title: string; description?: string; fileUrl?: string; videoData?: Buffer; mimeType?: string }): Promise<Video>;
  getVideos(currentUserId?: number, limit?: number, offset?: number): Promise<VideoResponse[]>;
  getVideoById(id: number, currentUserId?: number): Promise<VideoResponse | undefined>;
  getVideoData(id: number): Promise<{ data: Buffer; mimeType: string } | undefined>;
  getUserVideos(userId: number, currentUserId?: number): Promise<VideoResponse[]>;

  // Follows
  followUser(followerId: number, followingId: number): Promise<void>;
  unfollowUser(followerId: number, followingId: number): Promise<void>;
  isFollowing(followerId: number, followingId: number): Promise<boolean>;
  getFollowerCount(userId: number): Promise<number>;
  getFollowingCount(userId: number): Promise<number>;

  // Likes
  likeVideo(userId: number, videoId: number): Promise<void>;
  unlikeVideo(userId: number, videoId: number): Promise<void>;
  isLiked(userId: number, videoId: number): Promise<boolean>;
  getLikeCount(videoId: number): Promise<number>;

  // Comments
  addComment(userId: number, videoId: number, content: string): Promise<CommentResponse>;
  getComments(videoId: number): Promise<CommentResponse[]>;

  // Search
  searchUsers(query: string, currentUserId?: number): Promise<UserPublic[]>;
  getUserPublicProfile(userId: number, currentUserId?: number): Promise<UserPublic | undefined>;

  // VIP
  isVipUser(telegramId: number): Promise<boolean>;
  setVipUser(telegramId: number, expiresAt?: Date): Promise<VipUser>;
  getActiveVipUsers(): Promise<VipUser[]>;
  removeVipUser(telegramId: number): Promise<void>;

  // PAP Donations
  addPapDonation(data: { telegramId: number; gender: string; fileId: string; mediaType: string; caption?: string }): Promise<PapDonation>;
  getPapDonations(gender: string): Promise<PapDonation[]>; // returns opposite gender

  // Channel
  getChannelConfig(): Promise<ChannelConfig | undefined>;
  setChannelConfig(channelId: string): Promise<ChannelConfig>;
  updateChannelLastPosted(id: number): Promise<void>;

  // Telegram Users (gender + profile)
  getTelegramUser(telegramId: number): Promise<TelegramUser | undefined>;
  upsertTelegramUser(data: { telegramId: number; firstName?: string; username?: string; gender?: string }): Promise<TelegramUser>;

  // Site Settings
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;

  // Stats
  getStats(): Promise<{ userCount: number; videoCount: number; vipCount: number }>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // =========== AUTH ===========

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByTelegramId(telegramId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createTelegramUser(data: { telegramId: number; firstName?: string; username?: string; photoUrl?: string }): Promise<User> {
    const uname = data.username || `tg_${data.telegramId}`;
    let finalUsername = uname;
    let attempt = 0;
    while (await this.getUserByUsername(finalUsername)) {
      attempt++;
      finalUsername = `${uname}_${attempt}`;
    }
    const [user] = await db.insert(users).values({
      username: finalUsername,
      password: `tg_${data.telegramId}_${Date.now()}`,
      displayName: data.firstName || finalUsername,
      telegramId: data.telegramId,
    }).returning();
    return user;
  }

  async updateUserProfile(id: number, profile: UpdateUserProfile): Promise<User> {
    if (profile.username) {
      const existing = await this.getUserByUsername(profile.username);
      if (existing && existing.id !== id) {
        throw new Error("Username already taken");
      }
    }
    // Filter out undefined values — Drizzle cannot execute SET with all-undefined fields
    const updates: Record<string, any> = {};
    if (profile.username !== undefined) updates.username = profile.username;
    if (profile.displayName !== undefined) updates.displayName = profile.displayName;
    if (profile.bio !== undefined) updates.bio = profile.bio;
    if (profile.avatarData !== undefined) updates.avatarData = profile.avatarData;

    // If nothing to update, just return current user
    if (Object.keys(updates).length === 0) {
      const current = await this.getUser(id);
      return current!;
    }

    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // =========== VIDEOS ===========

  async createVideo(data: { userId: number; title: string; description?: string; fileUrl?: string; videoData?: Buffer; mimeType?: string; isExclusive?: boolean }): Promise<Video> {
    const [video] = await db.insert(videos).values({
      userId: data.userId,
      title: data.title,
      description: data.description || "",
      fileUrl: data.fileUrl,
      videoData: data.videoData,
      mimeType: data.mimeType || "video/mp4",
      isExclusive: data.isExclusive || false,
    }).returning();
    return video;
  }

  async getVideos(currentUserId?: number, limit = 20, offset = 0): Promise<VideoResponse[]> {
    const rows = await db
      .select({
        id: videos.id,
        userId: videos.userId,
        title: videos.title,
        description: videos.description,
        fileUrl: videos.fileUrl,
        mimeType: videos.mimeType,
        isExclusive: videos.isExclusive,
        createdAt: videos.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          isVip: sql<boolean>`EXISTS(SELECT 1 FROM vip_users WHERE vip_users.telegram_id = "users"."telegram_id" AND vip_users.expires_at > NOW())`,
        },
        likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE video_id = "videos"."id")::int`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE video_id = "videos"."id")::int`,
        isLiked: currentUserId
          ? sql<boolean>`EXISTS(SELECT 1 FROM likes WHERE video_id = "videos"."id" AND user_id = ${currentUserId})`
          : sql<boolean>`false`,
      })
      .from(videos)
      .leftJoin(users, eq(videos.userId, users.id))
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset);
    
    return rows as VideoResponse[];
  }

  async getVideoById(id: number, currentUserId?: number): Promise<VideoResponse | undefined> {
    const [row] = await db
      .select({
        id: videos.id,
        userId: videos.userId,
        title: videos.title,
        description: videos.description,
        fileUrl: videos.fileUrl,
        mimeType: videos.mimeType,
        isExclusive: videos.isExclusive,
        createdAt: videos.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          isVip: sql<boolean>`EXISTS(SELECT 1 FROM vip_users WHERE vip_users.telegram_id = "users"."telegram_id" AND vip_users.expires_at > NOW())`,
        },
        likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE video_id = "videos"."id")::int`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE video_id = "videos"."id")::int`,
        isLiked: currentUserId
          ? sql<boolean>`EXISTS(SELECT 1 FROM likes WHERE video_id = "videos"."id" AND user_id = ${currentUserId})`
          : sql<boolean>`false`,
      })
      .from(videos)
      .leftJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.id, id));
    
    return row as VideoResponse | undefined;
  }

  async getVideoData(id: number): Promise<{ data: Buffer; mimeType: string } | undefined> {
    const [row] = await db
      .select({ videoData: videos.videoData, mimeType: videos.mimeType })
      .from(videos)
      .where(eq(videos.id, id));
    
    if (!row || !row.videoData) return undefined;
    return { data: row.videoData as Buffer, mimeType: row.mimeType || "video/mp4" };
  }

  async getUserVideos(userId: number, currentUserId?: number): Promise<VideoResponse[]> {
    const rows = await db
      .select({
        id: videos.id,
        userId: videos.userId,
        title: videos.title,
        description: videos.description,
        fileUrl: videos.fileUrl,
        mimeType: videos.mimeType,
        isExclusive: videos.isExclusive,
        createdAt: videos.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          isVip: sql<boolean>`EXISTS(SELECT 1 FROM vip_users WHERE vip_users.telegram_id = "users"."telegram_id" AND vip_users.expires_at > NOW())`,
        },
        likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE video_id = "videos"."id")::int`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE video_id = "videos"."id")::int`,
        isLiked: currentUserId
          ? sql<boolean>`EXISTS(SELECT 1 FROM likes WHERE video_id = "videos"."id" AND user_id = ${currentUserId})`
          : sql<boolean>`false`,
      })
      .from(videos)
      .leftJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.userId, userId))
      .orderBy(desc(videos.createdAt));
    
    return rows as VideoResponse[];
  }

  // =========== FOLLOWS ===========

  async followUser(followerId: number, followingId: number): Promise<void> {
    await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing();
  }

  async unfollowUser(followerId: number, followingId: number): Promise<void> {
    await db.delete(follows).where(
      and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
    );
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const [row] = await db.select()
      .from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    return !!row;
  }

  async getFollowerCount(userId: number): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, userId));
    return count;
  }

  async getFollowingCount(userId: number): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, userId));
    return count;
  }

  // =========== LIKES ===========

  async likeVideo(userId: number, videoId: number): Promise<void> {
    await db.insert(likes).values({ userId, videoId }).onConflictDoNothing();
  }

  async unlikeVideo(userId: number, videoId: number): Promise<void> {
    await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.videoId, videoId)));
  }

  async isLiked(userId: number, videoId: number): Promise<boolean> {
    const [row] = await db.select().from(likes).where(
      and(eq(likes.userId, userId), eq(likes.videoId, videoId))
    );
    return !!row;
  }

  async getLikeCount(videoId: number): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(likes)
      .where(eq(likes.videoId, videoId));
    return count;
  }

  // =========== COMMENTS ===========

  async addComment(userId: number, videoId: number, content: string): Promise<CommentResponse> {
    const [comment] = await db.insert(comments).values({ userId, videoId, content }).returning();
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return {
      ...comment,
      author: user ? { id: user.id, username: user.username, displayName: user.displayName } : undefined,
    };
  }

  async getComments(videoId: number): Promise<CommentResponse[]> {
    const rows = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        videoId: comments.videoId,
        content: comments.content,
        createdAt: comments.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.videoId, videoId))
      .orderBy(desc(comments.createdAt));
    
    return rows as CommentResponse[];
  }

  // =========== SEARCH ===========

  async searchUsers(query: string, currentUserId?: number): Promise<UserPublic[]> {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        avatarData: users.avatarData,
        followerCount: sql<number>`(SELECT COUNT(*) FROM follows WHERE following_id = "users"."id")::int`,
        followingCount: sql<number>`(SELECT COUNT(*) FROM follows WHERE follower_id = "users"."id")::int`,
        videoCount: sql<number>`(SELECT COUNT(*) FROM videos WHERE user_id = "users"."id")::int`,
        isFollowing: currentUserId
          ? sql<boolean>`EXISTS(SELECT 1 FROM follows WHERE follower_id = ${currentUserId} AND following_id = "users"."id")`
          : sql<boolean>`false`,
      })
      .from(users)
      .where(
        or(
          ilike(users.username, `%${query}%`),
          ilike(users.displayName, `%${query}%`)
        )
      )
      .limit(20);
    
    return rows as UserPublic[];
  }

  async getUserPublicProfile(userId: number, currentUserId?: number): Promise<UserPublic | undefined> {
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        avatarData: users.avatarData,
        followerCount: sql<number>`(SELECT COUNT(*) FROM follows WHERE following_id = "users"."id")::int`,
        followingCount: sql<number>`(SELECT COUNT(*) FROM follows WHERE follower_id = "users"."id")::int`,
        videoCount: sql<number>`(SELECT COUNT(*) FROM videos WHERE user_id = "users"."id")::int`,
        isFollowing: currentUserId
          ? sql<boolean>`EXISTS(SELECT 1 FROM follows WHERE follower_id = ${currentUserId} AND following_id = "users"."id")`
          : sql<boolean>`false`,
      })
      .from(users)
      .where(eq(users.id, userId));
    
    return row as UserPublic | undefined;
  }

  // =========== VIP ===========

  async isVipUser(telegramId: number): Promise<boolean> {
    const [row] = await db.select().from(vipUsers)
      .where(eq(vipUsers.telegramId, telegramId));
    if (!row) return false;
    if (row.expiresAt && row.expiresAt < new Date()) return false;
    return true;
  }

  async setVipUser(telegramId: number, expiresAt?: Date): Promise<VipUser> {
    const existing = await db.select().from(vipUsers).where(eq(vipUsers.telegramId, telegramId));
    if (existing.length > 0) {
      const [updated] = await db.update(vipUsers)
        .set({ expiresAt: expiresAt ?? null })
        .where(eq(vipUsers.telegramId, telegramId))
        .returning();
      return updated;
    }
    const [row] = await db.insert(vipUsers)
      .values({ telegramId, expiresAt })
      .returning();
    return row;
  }

  async getActiveVipUsers(): Promise<VipUser[]> {
    const rows = await db.select().from(vipUsers)
      .where(gt(vipUsers.expiresAt, new Date()));
    return rows;
  }

  async removeVipUser(telegramId: number): Promise<void> {
    await db.delete(vipUsers).where(eq(vipUsers.telegramId, telegramId));
  }

  // =========== PAP ===========

  async addPapDonation(data: { telegramId: number; gender: string; fileId: string; mediaType: string; caption?: string }): Promise<PapDonation> {
    const [row] = await db.insert(papDonations).values({
      telegramId: data.telegramId,
      gender: data.gender,
      fileId: data.fileId,
      mediaType: data.mediaType,
      caption: data.caption,
    }).returning();
    return row;
  }

  async getPapDonations(gender: string): Promise<PapDonation[]> {
    // If viewer is female, show male pap; if male, show female pap
    const oppositeGender = gender === "female" ? "male" : "female";
    return db.select().from(papDonations)
      .where(and(eq(papDonations.gender, oppositeGender), eq(papDonations.isApproved, true)))
      .orderBy(desc(papDonations.createdAt))
      .limit(10);
  }

  // =========== CHANNEL ===========

  async getChannelConfig(): Promise<ChannelConfig | undefined> {
    const [row] = await db.select().from(channelConfig).limit(1);
    return row;
  }

  async setChannelConfig(channelIdValue: string): Promise<ChannelConfig> {
    const existing = await db.select().from(channelConfig).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(channelConfig)
        .set({ channelId: channelIdValue })
        .where(eq(channelConfig.id, existing[0].id))
        .returning();
      return updated;
    }
    const [row] = await db.insert(channelConfig).values({ channelId: channelIdValue }).returning();
    return row;
  }

  async updateChannelLastPosted(id: number): Promise<void> {
    await db.update(channelConfig).set({ lastPostedAt: new Date() }).where(eq(channelConfig.id, id));
  }

  // =========== TELEGRAM USERS ===========

  async getTelegramUser(telegramId: number): Promise<TelegramUser | undefined> {
    const [row] = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, telegramId));
    return row;
  }

  async upsertTelegramUser(data: { telegramId: number; firstName?: string; username?: string; gender?: string }): Promise<TelegramUser> {
    const existing = await this.getTelegramUser(data.telegramId);
    const updates: Record<string, any> = {};
    if (data.firstName !== undefined) updates.firstName = data.firstName;
    if (data.username !== undefined) updates.username = data.username;
    if (data.gender !== undefined) updates.gender = data.gender;

    if (existing) {
      if (Object.keys(updates).length === 0) return existing;
      const [updated] = await db.update(telegramUsers)
        .set(updates)
        .where(eq(telegramUsers.telegramId, data.telegramId))
        .returning();
      return updated;
    }
    const [row] = await db.insert(telegramUsers)
      .values({ telegramId: data.telegramId, ...updates })
      .returning();
    return row;
  }
  // =========== SITE SETTINGS ===========

  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing !== undefined) {
      await db.update(siteSettings).set({ value }).where(eq(siteSettings.key, key));
    } else {
      await db.insert(siteSettings).values({ key, value });
    }
  }

  // =========== STATS ===========

  async getStats(): Promise<{ userCount: number; videoCount: number; vipCount: number }> {
    const [uCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [vCount] = await db.select({ count: sql<number>`count(*)` }).from(videos);
    const [vipCount] = await db.select({ count: sql<number>`count(*)` }).from(vipUsers).where(gt(vipUsers.expiresAt!, new Date()));
    return {
      userCount: Number(uCount.count),
      videoCount: Number(vCount.count),
      vipCount: Number(vipCount.count),
    };
  }
}

export const storage = new DatabaseStorage();
