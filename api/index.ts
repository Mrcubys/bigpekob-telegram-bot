/**
 * Vercel Node Function entrypoint.
 * Loads prebuilt server handler from dist/handler.cjs produced by `npm run build`.
 */

import type { IncomingMessage, ServerResponse } from "http";

let cachedHandler: ((req: IncomingMessage, res: ServerResponse) => unknown) | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!cachedHandler) {
      const mod: any = await import("../dist/handler.cjs");
      if (typeof mod.default === "function") {
        cachedHandler = mod.default;
      } else if (typeof mod.getHandler === "function") {
        cachedHandler = await mod.getHandler();
      } else {
        throw new Error("dist/handler.cjs does not export a handler function");
      }
    }

    return cachedHandler(req, res);
  } catch (err: any) {
    console.error("[vercel] api bootstrap error:", err);
    if (!(res as any).headersSent) {
      (res as any).statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: "Server bootstrap failed",
          message: err?.message ?? String(err),
        }),
      );
    }
  }
}
