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

    await b.setMyCommands([
      { command: "start", description: "Buka BigPekob Mini App" },
      { command: "trending", description: "Lihat video yang lagi viral" },
      { command: "help", description: "Bantuan" },
    ]);

    await b.setMyDescription(
      "🔞 BigPekob — Konten Indo terbaru dan yang lagi viral cuman ada disini.\n\n" +
      "⚠️ Konten dewasa 18+. Dilarang keras untuk pengguna di bawah umur."
    );

    await b.setMyShortDescription(
      "🔞 Konten Indo viral 18+ — cuman ada di BigPekob."
    );

    try {
      await (b as any).setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "🎬 Buka BigPekob",
          web_app: { url: MINI_APP_URL },
        },
      });
    } catch {}

    console.log(`[telegram] Webhook set to ${WEBHOOK_URL}`);
    console.log(`[telegram] Mini App URL: ${MINI_APP_URL}`);
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
    await b.sendMessage(
      chatId,
      "🔞 *BigPekob* — Nonton indo terbaru dan yang lagi viral cuman ada disini! 🔥\n\n" +
      "Klik tombol di bawah untuk langsung nonton:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            {
              text: "🎬 Buka BigPekob",
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

      let reply = "🔥 *Yang Lagi Viral di BigPekob:*\n\n";
      top.forEach((v, i) => {
        reply += `${i + 1}. *${v.title || "Untitled"}*\n`;
        reply += `   👤 ${(v as any).author?.displayName || (v as any).author?.username || "Unknown"}\n`;
        reply += `   ❤️ ${(v as any).likeCount || 0} likes\n\n`;
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
    await b.sendMessage(
      chatId,
      "📖 *Perintah BigPekob Bot:*\n\n" +
      "/start — Buka BigPekob Mini App\n" +
      "/trending — Lihat video yang lagi viral\n" +
      "/help — Tampilkan bantuan ini\n\n" +
      "⚠️ _Konten dewasa 18+. Dilarang untuk pengguna di bawah umur._",
      { parse_mode: "Markdown" }
    );
    return;
  }

  await b.sendMessage(
    chatId,
    "🔞 Nonton indo terbaru dan yang lagi viral cuman ada disini! 🔥",
    {
      reply_markup: {
        inline_keyboard: [[
          {
            text: "🎬 Buka BigPekob",
            web_app: { url: MINI_APP_URL },
          }
        ]]
      }
    }
  );
}
