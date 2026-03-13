/**
 * Vercel Serverless Function — handles all /api/* routes
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/app";
import type { Application } from "express";

let app: Application | null = null;
let initPromise: Promise<void> | null = null;

function ensureApp(): Promise<void> {
  if (!initPromise) {
    initPromise = createApp().then(({ app: a }) => {
      app = a;
    });
  }
  return initPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureApp();
  return app!(req as any, res as any);
}
