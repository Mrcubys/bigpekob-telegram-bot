import { db } from "./db";
import {
  users, videos, follows, likes, comments,
  type User, type InsertUser, type UpdateUserProfile,
  type Video, type VideoResponse, type UserPublic, type CommentResponse,
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = connectPg(session);

export interface IStorage {
  // Auth
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: number, profile: UpdateUserProfile): Promise<User>;

  // Videos
  createVideo(data: { userId: number; title: string; description?: string; fileUrl?: string; videoData?: Buffer; mimeType?: string }): Promise<Video>;
  getVideos(currentUserId?: number): Promise<VideoResponse[]>;
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserProfile(id: number, profile: UpdateUserProfile): Promise<User> {
    const [user] = await db.update(users)
      .set({ ...profile })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // =========== VIDEOS ===========

  async createVideo(data: { userId: number; title: string; description?: string; fileUrl?: string; videoData?: Buffer; mimeType?: string }): Promise<Video> {
    const [video] = await db.insert(videos).values({
      userId: data.userId,
      title: data.title,
      description: data.description || "",
      fileUrl: data.fileUrl,
      videoData: data.videoData,
      mimeType: data.mimeType || "video/mp4",
    }).returning();
    return video;
  }

  async getVideos(currentUserId?: number): Promise<VideoResponse[]> {
    const rows = await db
      .select({
        id: videos.id,
        userId: videos.userId,
        title: videos.title,
        description: videos.description,
        fileUrl: videos.fileUrl,
        mimeType: videos.mimeType,
        createdAt: videos.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarData: users.avatarData,
        },
        likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE video_id = "videos"."id")::int`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE video_id = "videos"."id")::int`,
        isLiked: currentUserId
          ? sql<boolean>`EXISTS(SELECT 1 FROM likes WHERE video_id = "videos"."id" AND user_id = ${currentUserId})`
          : sql<boolean>`false`,
      })
      .from(videos)
      .leftJoin(users, eq(videos.userId, users.id))
      .orderBy(desc(videos.createdAt));
    
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
        createdAt: videos.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarData: users.avatarData,
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
        createdAt: videos.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarData: users.avatarData,
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
      author: user ? { id: user.id, username: user.username, displayName: user.displayName, avatarData: user.avatarData } : undefined,
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
          avatarData: users.avatarData,
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
}

export const storage = new DatabaseStorage();
