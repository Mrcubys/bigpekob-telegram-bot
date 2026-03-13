import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

let handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let initPromise: Promise<void> | null = null;

async function ensureHandler() {
  if (!initPromise) {
    initPromise = createApp()
      .then(({ app }) => {
        handler = app as unknown as (req: IncomingMessage, res: ServerResponse) => void;
      })
      .catch((err) => {
        initPromise = null;
        throw err;
      });
  }

  await initPromise;
}

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureHandler();
    handler!(req, res);
  } catch (err: any) {
    console.error("[vercel] handler init error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: "Server initialization failed",
          message: err?.message ?? String(err),
        }),
      );
    }
  }
}
