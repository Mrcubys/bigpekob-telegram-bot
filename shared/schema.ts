import { pgTable, text, serial, integer, timestamp, unique, customType, bigint, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Custom bytea type for storing binary video data
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

// =================== TABLES ===================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  bio: text("bio"),
  avatarData: text("avatar_data"),
  telegramId: bigint("telegram_id", { mode: "number" }).unique(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url"), // legacy file-based URL (optional)
  videoData: bytea("video_data"), // binary video data stored in DB
  mimeType: text("mime_type").default("video/mp4"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull(),
  followingId: integer("following_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  unq: unique().on(t.followerId, t.followingId),
}));

export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  videoId: integer("video_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  unq: unique().on(t.userId, t.videoId),
}));

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  videoId: integer("video_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vipUsers = pgTable("vip_users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const papDonations = pgTable("pap_donations", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  gender: text("gender").notNull(), // 'male' | 'female'
  fileId: text("file_id").notNull(),
  mediaType: text("media_type").notNull(), // 'photo' | 'video'
  caption: text("caption"),
  isApproved: boolean("is_approved").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const channelConfig = pgTable("channel_config", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  lastPostedAt: timestamp("last_posted_at"),
});

export const telegramUsers = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  gender: text("gender"), // 'male' | 'female' | null (not set yet)
  firstName: text("first_name"),
  username: text("username"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// =================== RELATIONS ===================

export const usersRelations = relations(users, ({ many }) => ({
  videos: many(videos),
  following: many(follows, { relationName: "follower" }),
  followers: many(follows, { relationName: "following" }),
  likes: many(likes),
  comments: many(comments),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  author: one(users, { fields: [videos.userId], references: [users.id] }),
  likes: many(likes),
  comments: many(comments),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, { fields: [follows.followerId], references: [users.id], relationName: "follower" }),
  following: one(users, { fields: [follows.followingId], references: [users.id], relationName: "following" }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, { fields: [likes.userId], references: [users.id] }),
  video: one(videos, { fields: [likes.videoId], references: [videos.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  video: one(videos, { fields: [comments.videoId], references: [videos.id] }),
}));

// =================== SCHEMAS ===================

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const updateUserProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores").optional(),
  displayName: z.string().max(50).optional(),
  bio: z.string().max(200).optional(),
  avatarData: z.string().optional(),
});

export const insertVideoSchema = createInsertSchema(videos).pick({
  title: true,
  description: true,
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
});

// =================== TYPES ===================

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type Follow = typeof follows.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type VipUser = typeof vipUsers.$inferSelect;
export type PapDonation = typeof papDonations.$inferSelect;
export type ChannelConfig = typeof channelConfig.$inferSelect;
export type TelegramUser = typeof telegramUsers.$inferSelect;

// Rich response types
export type UserPublic = Pick<User, "id" | "username" | "displayName" | "bio" | "avatarData"> & {
  followerCount: number;
  followingCount: number;
  videoCount: number;
  isFollowing?: boolean;
};

export type VideoResponse = Omit<Video, "videoData"> & {
  author?: Pick<User, "id" | "username" | "displayName" | "avatarData">;
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
};

export type CommentResponse = Comment & {
  author?: Pick<User, "id" | "username" | "displayName" | "avatarData">;
};
