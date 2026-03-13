import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir, writeFile, cp } from "fs/promises";

// Server deps to bundle to reduce cold-start time
const allowlist = [
  "@aws-sdk/client-s3",
  "@aws-sdk/lib-storage",
  "@aws-sdk/middleware-retry",
  "@aws-sdk/credential-provider-node",
  "@smithy/node-http-handler",
  "@smithy/fetch-http-handler",
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const isVercel = !!process.env.VERCEL;

  // Clean dist
  await rm("dist", { recursive: true, force: true });

  if (isVercel) {
    // Clean previous Vercel output
    await rm(".vercel/output", { recursive: true, force: true });
  }

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // Main server bundle (for dev/self-hosted)
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Standard serverless handler bundle used by Vercel Function api/index.js
  console.log("building serverless handler...");
  await esbuild({
    entryPoints: ["server/handler.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/handler.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  if (isVercel) {
    // Optional Build Output API artifact generation (kept for compatibility)
    console.log("Building Vercel output (Build Output API v3)...");
    await mkdir(".vercel/output/static", { recursive: true });
    await mkdir(".vercel/output/functions/api/index.func", { recursive: true });
    await cp("dist/public", ".vercel/output/static", { recursive: true });
    await esbuild({
      entryPoints: ["server/vercel-entry.ts"],
      platform: "node",
      bundle: true,
      format: "esm",
      outfile: ".vercel/output/functions/api/index.func/index.mjs",
      define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.VERCEL": '"1"',
      },
      minify: true,
      external: externals,
      logLevel: "info",
    });
    await writeFile(
      ".vercel/output/functions/api/index.func/.vc-config.json",
      JSON.stringify({
        runtime: "nodejs20.x",
        handler: "index.mjs",
        launcherType: "Nodejs",
        maxDuration: 30,
      }, null, 2)
    );
    await writeFile(
      ".vercel/output/config.json",
      JSON.stringify({
        version: 3,
        routes: [
          { src: "^/api(/.*)?$", dest: "/api/index" },
          { handle: "filesystem" },
          { src: "/(.*)", dest: "/index.html" },
        ],
      }, null, 2)
    );
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
