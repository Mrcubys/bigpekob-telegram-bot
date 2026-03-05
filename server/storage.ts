import { db } from "./db";
import { users, videos, type User, type InsertUser, type Video, type InsertVideo, type VideoResponse } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createVideo(video: InsertVideo & { userId: number, fileUrl: string }): Promise<Video>;
  getVideos(): Promise<VideoResponse[]>;
  
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

  async createVideo(video: InsertVideo & { userId: number, fileUrl: string }): Promise<Video> {
    const [newVideo] = await db.insert(videos).values(video).returning();
    return newVideo;
  }

  async getVideos(): Promise<VideoResponse[]> {
    const allVideos = await db.select({
      id: videos.id,
      userId: videos.userId,
      title: videos.title,
      description: videos.description,
      fileUrl: videos.fileUrl,
      createdAt: videos.createdAt,
      author: {
        username: users.username,
      }
    }).from(videos).leftJoin(users, eq(videos.userId, users.id)).orderBy(desc(videos.createdAt));
    return allVideos as VideoResponse[];
  }
}

export const storage = new DatabaseStorage();
