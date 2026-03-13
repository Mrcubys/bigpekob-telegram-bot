/**
 * Vercel Serverless Function - MINIMAL DEBUG VERSION
 */
module.exports = function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({
    ok: true,
    url: req.url,
    method: req.method,
    env: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    hasDb: !!(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL),
    hasTgMain: !!process.env.TELEGRAM_BOT_TOKEN_MAIN
  }));
};
