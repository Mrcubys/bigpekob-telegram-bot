# BigPekob - TikTok-like Video Sharing Platform

## Overview

BigPekob adalah platform berbagi video Indo/dewasa 18+ berbasis TikTok, dibangun sebagai full-stack web app. Fitur: feed video vertikal, upload, like, komentar, follow, Telegram Mini App, VIP via Telegram Stars, donasi PAP, dan channel auto-posting.

Key features:
- Full-screen vertical scroll-snap video feed ("For You" style)
- Video upload with **disk storage** (`uploads/` dir, `fileUrl` field) — no OOM risk
- User auth with sessions (register/login/logout) + **Telegram auto-login** (auto-creates user from Telegram identity via `/api/auth/telegram`)
- Like, comment, and follow social interactions
- User discovery/search
- Profile editing with base64 avatar support + **profile photo upload** (click avatar)
- **Telegram Mini App** at `/telegram` with Feed/Upload/Profile tabs
- **VIP system** via Telegram Stars (100 Stars = 30 days VIP, enables video download + exclusive content access); auto-VIP for @rafnoxxx and @bahlillahadila on login; VIP users get blue checkmark badge next to their name
- **Video download** for VIP users (gated by `telegram_id` query param)
- **Donasi PAP** conversation flow in bot (gender-based, privacy protected)
- **Channel auto-posting** every hour (20 rotating templates — VIP promo, app intro, upload CTA, chat anonim, video terbaru, PAP donasi, konten eksklusif, fitur lengkap, greeting harian, top pick, perbandingan VIP/biasa, statistik, koleksi video, rahasia VIP, creator CTA, rekomendasi malam, quick recap, promo terbatas, dan perbandingan platform)
- **`/chatkechannel`** command: member kirim pesan anonim ke channel BigPekob
- **Optimized video streaming** with in-memory cache (10 min TTL) + ETag support
- **Performance**: `avatarData` excluded from video/comment list queries to avoid huge JSON payloads; avatars loaded lazily via `/api/users/:id/avatar` with client-side cache; video feed uses infinite scroll pagination (20 per page)
- **@bigpekob_chat_bot** (anonymous chat): gender selection, /cari pairing, /stop, VIP gender filter, daily 100-search limit

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: `wouter` (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query v5 for server state, with custom hooks per domain (`use-videos`, `use-auth`, `use-comments`, `use-follow`, `use-search`, `use-user-profile`)
- **UI Components**: shadcn/ui (Radix UI primitives) with Tailwind CSS, "new-york" style
- **Styling**: Tailwind CSS with CSS variables for theming; dark-first color palette (zinc-950 background); custom fonts (Plus Jakarta Sans, Outfit)
- **Mobile Container**: `MobileContainer` wrapper (`max-w-[420px]`, `100dvh`) centers a phone-sized view on desktop, with a `BottomNav` bar for navigation
- **Pages**:
  - `/` — Feed (vertical scroll-snap video list)
  - `/discover` — User search
  - `/upload` — Video upload form
  - `/inbox` — Placeholder inbox/messages
  - `/profile` / `/profile/:userId` — User profile with video grid
  - `/auth` — Login/Register

### Backend Architecture

- **Runtime**: Node.js with Express (TypeScript via `tsx` in dev, esbuild bundle in prod)
- **Entry**: `server/index.ts` → registers routes via `server/routes.ts`, serves static files via `server/static.ts`, uses `server/vite.ts` for dev HMR
- **Auth**: `passport-local` strategy with `express-session` (sessions stored in PostgreSQL via `connect-pg-simple`)
- **File Uploads**: `multer` with memory storage; video binary data is stored directly in the PostgreSQL `bytea` column (no disk storage for new uploads; legacy file-based `/uploads` directory is still served for old content)
- **API Structure**: RESTful routes defined in `shared/routes.ts` (typed with Zod), implemented in `server/routes.ts`:
  - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `PUT /api/auth/profile`
  - `GET /api/videos?limit=&offset=` (paginated, default 20, max 50), `POST /api/videos`, `GET /api/videos/:id`, `GET /api/videos/:id/stream`
  - `GET /api/users/:id/avatar` (lazy avatar loading, cached 1h)
  - `POST /api/videos/:id/like`, `GET/POST /api/videos/:id/comments`
  - `GET /api/users/:id`, `GET /api/users/:id/videos`, `POST /api/users/:id/follow`
  - `GET /api/search/users`
- **Storage Layer**: `server/storage.ts` defines an `IStorage` interface implemented with Drizzle ORM queries, keeping all DB logic in one place

### Data Storage

- **Database**: PostgreSQL (required via `DATABASE_URL` env var)
- **ORM**: Drizzle ORM with `drizzle-kit` for migrations (`./migrations` directory, schema at `shared/schema.ts`)
- **Schema tables**:
  - `users` — id, username, password, displayName, bio, avatarData (base64 string), telegramId (bigint unique, for Telegram auto-login)
  - `videos` — id, userId, title, description, fileUrl (legacy), videoData (bytea binary), mimeType, isExclusive (boolean, VIP-only content), createdAt
  - `follows` — followerId, followingId (unique pair)
  - `likes` — userId, videoId (unique pair)
  - `comments` — userId, videoId, content, createdAt
  - `vip_users` — telegramId (bigint unique), expiresAt, createdAt
  - `pap_donations` — telegramId, gender, fileId, mediaType, caption, isApproved, createdAt
  - `channel_config` — channelId, lastPostedAt
- **Sessions**: Stored in PostgreSQL using `connect-pg-simple`
- **Video storage strategy**: Binary video data is stored in the `videoData` bytea column. This avoids external storage dependencies but may become a bottleneck for large libraries. The legacy `fileUrl` path still exists for backward compatibility.

### Authentication & Authorization

- Session-based auth (not JWT) using `express-session` + `passport-local`
- Sessions persist in PostgreSQL (7-day cookie max age)
- Protected routes check `req.isAuthenticated()` on the server; client redirects to `/auth` when API returns 401
- `SESSION_SECRET` env var (falls back to hardcoded default — should be set in production)

### Build & Deployment

- **Dev**: `tsx server/index.ts` + Vite dev server with HMR via middleware mode
- **Build**: `script/build.ts` runs Vite for client (outputs to `dist/public`) then esbuild for server (outputs `dist/index.cjs`), bundling an allowlisted set of server deps for fast cold starts
- **Start**: `node dist/index.cjs` (production)
- **DB migrations**: `drizzle-kit push` (`npm run db:push`)

## External Dependencies

### Required Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required; app throws on startup without it)
- `SESSION_SECRET` — Secret for signing session cookies (has insecure fallback; must be set in production)
- `TELEGRAM_BOT_TOKEN` — Bot token for @bigpekob_bot (Mini App, VIP, PAP, channel posting)
- `TELEGRAM_CHAT_BOT_TOKEN` — Bot token for @bigpekob_chat_bot (anonymous chat)
- `TELEGRAM_DEV_BOT_TOKEN` — Bot token for dev bot panel (stats, maintenance, AI chat)
- `OPENROUTER_API_KEY` — API key for OpenRouter (used by dev bot AI chat feature, google/gemini-2.0-flash-001)

### Telegram Bot Notes
- All three bots use **HTML parse mode** (`parse_mode: "HTML"`) for all messages — Markdown v1 breaks on bot usernames containing underscores (e.g. `@bigpekob_bot`)
- All dynamic content interpolated into Telegram messages must go through `escHtml()` (replaces `&`, `<`, `>`)
- Mini App auto-login: on mount, if `window.Telegram.WebApp.initDataUnsafe.user` exists, POST to `/api/auth/telegram` with initData HMAC verification
- Users table has `telegram_id` column for linking Telegram accounts to app users
- Dev bot panel (`server/devbot.ts`): stats dashboard, maintenance mode toggle, bot status check, webhook restart, AI chat (OpenRouter/Gemini), broadcast, recent error logs
- Maintenance mode: stored in `site_settings` table, read via `/api/maintenance` endpoint, Mini App shows maintenance screen when active
- `site_settings` table: key (text PK), value (text), for persistent settings like maintenance mode

### Key Third-Party Libraries

| Category | Library | Purpose |
|---|---|---|
| Database | `drizzle-orm`, `drizzle-kit`, `pg` | ORM + PostgreSQL driver |
| Auth | `passport`, `passport-local`, `express-session`, `connect-pg-simple` | Session auth |
| Upload | `multer` | Multipart form parsing for video upload |
| UI Primitives | `@radix-ui/*` | Accessible component primitives |
| Styling | `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge` | Utility-first CSS |
| Data Fetching | `@tanstack/react-query` | Server state management |
| Routing | `wouter` | Lightweight React router |
| Forms | `react-hook-form`, `@hookform/resolvers` | Form state + validation |
| Validation | `zod`, `drizzle-zod` | Schema validation shared between client and server |
| Video Carousel | `embla-carousel-react` | Scroll/carousel primitives |
| Date | `date-fns` | Date formatting |
| ID generation | `nanoid` | Unique ID generation |

### Replit-specific Plugins (dev only)
- `@replit/vite-plugin-runtime-error-modal` — Runtime error overlay
- `@replit/vite-plugin-cartographer` — Replit file explorer integration
- `@replit/vite-plugin-dev-banner` — Dev mode banner