import { z } from "zod";
import { insertUserSchema, insertCommentSchema, updateUserProfileSchema } from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    register: {
      method: "POST" as const,
      path: "/api/auth/register" as const,
      input: insertUserSchema,
      responses: { 201: z.any(), 400: errorSchemas.validation },
    },
    login: {
      method: "POST" as const,
      path: "/api/auth/login" as const,
      input: insertUserSchema,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized },
    },
    me: {
      method: "GET" as const,
      path: "/api/auth/me" as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized },
    },
    logout: {
      method: "POST" as const,
      path: "/api/auth/logout" as const,
      responses: { 200: z.object({ message: z.string() }) },
    },
    profile: {
      method: "PUT" as const,
      path: "/api/auth/profile" as const,
      input: updateUserProfileSchema,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized },
    },
  },
  videos: {
    list: {
      method: "GET" as const,
      path: "/api/videos" as const,
      responses: { 200: z.array(z.any()) },
    },
    upload: {
      method: "POST" as const,
      path: "/api/videos" as const,
      responses: { 201: z.any(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized },
    },
    stream: {
      method: "GET" as const,
      path: "/api/videos/:id/stream" as const,
      responses: { 200: z.any() },
    },
    comments: {
      list: {
        method: "GET" as const,
        path: "/api/videos/:id/comments" as const,
        responses: { 200: z.array(z.any()) },
      },
      create: {
        method: "POST" as const,
        path: "/api/videos/:id/comments" as const,
        input: insertCommentSchema,
        responses: { 201: z.any(), 401: errorSchemas.unauthorized },
      },
    },
    like: {
      toggle: {
        method: "POST" as const,
        path: "/api/videos/:id/like" as const,
        responses: { 200: z.object({ liked: z.boolean(), likeCount: z.number() }) },
      },
    },
  },
  users: {
    get: {
      method: "GET" as const,
      path: "/api/users/:id" as const,
      responses: { 200: z.any(), 404: errorSchemas.notFound },
    },
    videos: {
      method: "GET" as const,
      path: "/api/users/:id/videos" as const,
      responses: { 200: z.array(z.any()) },
    },
    follow: {
      method: "POST" as const,
      path: "/api/users/:id/follow" as const,
      responses: { 200: z.object({ following: z.boolean() }) },
    },
  },
  search: {
    users: {
      method: "GET" as const,
      path: "/api/search/users" as const,
      responses: { 200: z.array(z.any()) },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
