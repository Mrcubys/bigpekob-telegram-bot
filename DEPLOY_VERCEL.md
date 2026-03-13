# Deploy BigPekob Telegram Bot + Mini App ke Vercel

## 1) Hubungkan repo ke project Vercel
- Import repo ini ke Vercel.
- Gunakan nama project: `bigpekob-telegram-bot`.

## 2) Environment Variables (Production)
Wajib:
- `DATABASE_URL` (atau `NEON_DATABASE_URL`)
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN_MAIN`
- `TELEGRAM_BOT_TOKEN_CHAT` (jika chatbot dipakai)
- `TELEGRAM_BOT_TOKEN_DEV` (jika devbot dipakai)

Disarankan:
- `APP_URL=https://bigpekob-telegram-bot.vercel.app`
- `CRON_SECRET` (harus sama dengan header cron kalau dipakai manual)

## 3) Deploy
- Push branch ke GitHub.
- Trigger deploy Production di Vercel.

## 4) Verifikasi endpoint
Setelah deploy, cek:
- `GET https://bigpekob-telegram-bot.vercel.app/` (mini app index)
- `POST https://bigpekob-telegram-bot.vercel.app/api/telegram/webhook`
- `POST https://bigpekob-telegram-bot.vercel.app/api/chatbot/webhook`
- `POST https://bigpekob-telegram-bot.vercel.app/api/devbot/webhook`

## 5) Verifikasi webhook Telegram
Webhook diset otomatis saat cold start function.
Pastikan bot token benar dan buka URL ini untuk cek status:
- `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN_MAIN>/getWebhookInfo`

Webhook yang diharapkan:
- `https://bigpekob-telegram-bot.vercel.app/api/telegram/webhook`

## 6) Telegram Mini App URL
Mini app path:
- `https://bigpekob-telegram-bot.vercel.app/telegram`

Bot akan set `setChatMenuButton` ke URL tersebut.
