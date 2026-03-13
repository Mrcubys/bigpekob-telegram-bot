/**
 * Serverless handler export - does NOT call listen()
 * Used for Vercel serverless deployment
 */
import { createApp } from "./app";

let handler: any = null;

export async function getHandler() {
  if (!handler) {
    const { app } = await createApp();
    handler = app;
  }
  return handler;
}
