/**
 * Vercel Serverless Function — handles all API requests
 * Plain JavaScript to avoid TypeScript compilation issues
 */

let appHandler = null;
let initError = null;

async function getHandler() {
  if (initError) throw initError;
  if (appHandler) return appHandler;

  try {
    const { createApp } = await import("../server/app.js");
    const { app } = await createApp();
    appHandler = app;
    return appHandler;
  } catch (err) {
    initError = err;
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    const app = await getHandler();
    return app(req, res);
  } catch (err) {
    console.error("Handler initialization error:", err);
    res.status(500).json({ error: "Server initialization failed", message: err.message });
  }
}
