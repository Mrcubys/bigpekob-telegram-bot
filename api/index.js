/**
 * Vercel Serverless Function
 * Uses the pre-compiled serverless handler bundle
 */

let handler = null;
let initPromise = null;

function getHandler() {
  if (!initPromise) {
    initPromise = (async () => {
      // Import the compiled handler bundle
      const mod = require("../dist/handler.cjs");
      const { getHandler: makeHandler } = mod;
      handler = await makeHandler();
    })();
  }
  return initPromise;
}

module.exports = async function(req, res) {
  try {
    await getHandler();
    return handler(req, res);
  } catch (err) {
    console.error("Serverless handler error:", err);
    res.status(500).json({ error: "Server initialization failed", message: err.message });
  }
};
