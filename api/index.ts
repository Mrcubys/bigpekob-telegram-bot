/**
 * Vercel Serverless Function entry point
 * Wraps the Express app for Vercel serverless deployment
 */
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { serveStatic } from "../server/static";
import { createServer } from "http";
import { runStartupSeed } from "../server/seed";

const app = express();
const httpServer = createServer(app);

app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Initialize routes and seed
let initialized = false;
let initPromise: Promise<void> | null = null;

async function initialize() {
  if (!initialized) {
    await registerRoutes(httpServer, app);
    await runStartupSeed();

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      if (res.headersSent) return next(err);
      return res.status(status).json({ message });
    });

    serveStatic(app);
    initialized = true;
  }
}

initPromise = initialize().catch(console.error);

export default async function handler(req: Request, res: Response) {
  if (initPromise) await initPromise;
  return app(req, res);
}
