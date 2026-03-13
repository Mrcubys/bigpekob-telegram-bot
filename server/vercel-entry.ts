/**
 * Vercel Build Output API entry point
 * Bundled by esbuild into .vercel/output/functions/api/index.func/index.js
 */
import { createApp } from "./app";
import type { IncomingMessage, ServerResponse } from "http";

let handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let initPromise: Promise<void> | null = null;

function ensureHandler(): Promise<void> {
  if (!initPromise) {
    initPromise = createApp().then(({ app }) => {
      handler = app as any;
    }).catch((err: Error) => {
      console.error("[vercel] Handler init error:", err);
      initPromise = null; // allow retry
      throw err;
    });
  }
  return initPromise;
}

module.exports = async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureHandler();
    handler!(req, res);
  } catch (err: any) {
    console.error("[vercel] Request error:", err);
    if (!res.headersSent) {
      (res as any).statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: "Server initialization failed",
        message: err?.message || String(err),
        stack: err?.stack?.split?.("\n")?.slice(0, 8)?.join("\n"),
      }));
    }
  }
};
