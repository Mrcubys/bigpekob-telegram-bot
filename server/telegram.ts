import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const DOMAIN = process.env.REPLIT_DOMAINS?.split(",")[0] || "";
const WEBHOOK_URL = `https://${DOMAIN}/api/telegram/webhook`;
const MINI_APP_URL = `https://${DOMAIN}/telegram`;

let bot: TelegramBot | null = null;

export function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(TOKEN);
  }
  return bot;
}

export async function setupTelegramWebhook() {
  if (!TOKEN) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set, skipping setup");
    return;
  }

  try {
    const b = getBot();
    await b.setWebHook(WEBHOOK_URL);

    // Set bot commands
    await b.setMyCommands([
      { command: "start", description: "Buka BigPekob Mini App" },
      { command: "trending", description: "Lihat video trending" },
      { command: "help", description: "Bantuan" },
    ]);

    // Set Mini App button in menu
    await b.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "BigPekob",
        web_app: { url: MINI_APP_URL },
      } as any,
    });

    console.log(`[telegram] Webhook set to ${WEBHOOK_URL}`);
  } catch (err) {
    console.error("[telegram] Failed to setup webhook:", err);
  }
}

export async function handleTelegramUpdate(body: any) {
  if (!TOKEN) return;

  const b = getBot();
  const update = body;

  const msg = update.message || update.edited_message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (text.startsWith("/start")) {
    await b.sendMessage(chatId,
      "🎬 *Selamat datang di BigPekob!*\n\nNonton dan share video seru langsung dari Telegram.\n\nKlik tombol di bawah untuk buka Mini App:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            {
              text: "🚀 Buka BigPekob",
              web_app: { url: MINI_APP_URL },
            }
          ]]
        }
      }
    );
    return;
  }

  if (text.startsWith("/trending")) {
    try {
      const videos = await storage.getVideos();
      const top = videos.slice(0, 5);

      if (top.length === 0) {
        await b.sendMessage(chatId, "Belum ada video tersedia.");
        return;
      }

      let reply = "🔥 *Video Trending BigPekob:*\n\n";
      top.forEach((v, i) => {
        reply += `${i + 1}. *${v.title || "Untitled"}*\n`;
        reply += `   👤 ${v.author?.displayName || v.author?.username || "Unknown"}\n`;
        reply += `   ❤️ ${v.likeCount || 0} likes\n\n`;
      });

      await b.sendMessage(chatId, reply, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            {
              text: "🎬 Tonton Sekarang",
              web_app: { url: MINI_APP_URL },
            }
          ]]
        }
      });
    } catch (err) {
      await b.sendMessage(chatId, "Gagal mengambil data video.");
    }
    return;
  }

  if (text.startsWith("/help")) {
    await b.sendMessage(chatId,
      "📖 *Perintah BigPekob Bot:*\n\n" +
      "/start - Buka BigPekob Mini App\n" +
      "/trending - Lihat 5 video terpopuler\n" +
      "/help - Tampilkan bantuan ini\n\n" +
      "Atau klik tombol *BigPekob* di menu chat untuk langsung membuka aplikasi!",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Default response
  await b.sendMessage(chatId,
    "Hei! Ketik /start untuk membuka BigPekob Mini App 🎬",
    {
      reply_markup: {
        inline_keyboard: [[
          {
            text: "🚀 Buka BigPekob",
            web_app: { url: MINI_APP_URL },
          }
        ]]
      }
    }
  );
}
