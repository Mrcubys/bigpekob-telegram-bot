/**
 * Vercel Serverless Function
 * Uses the pre-compiled serverless handler bundle
 */

let handler = null;
let initError = null;
let initPromise = null;

function getHandler() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const mod = require("../dist/handler.cjs");
        const { getHandler: makeHandler } = mod;
        handler = await makeHandler();
      } catch (err) {
        initError = err;
        throw err;
      }
    })();
  }
  return initPromise;
}

module.exports = async function(req, res) {
  // Simple health check bypass — no DB needed
  if (req.url === '/api/ping' || req.url === '/api/ping/') {
    return res.status(200).json({ ok: true, ts: Date.now() });
  }

  try {
    await getHandler();
    return handler(req, res);
  } catch (err) {
    console.error("Serverless handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Server initialization failed",
        message: err && err.message,
        stack: err && err.stack && err.stack.split('\n').slice(0, 10).join('\n'),
        cachedError: initError && initError.message,
      });
    }
  }
};
