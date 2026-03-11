import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const DOMAIN = process.env.REPLIT_DOMAINS?.split(",")[0] || "";
const WEBHOOK_URL = `https://${DOMAIN}/api/telegram/webhook`;
const MINI_APP_URL = `https://${DOMAIN}/telegram`;
const VIP_STARS_PRICE = 50; // 50 Telegram Stars for VIP

let bot: TelegramBot | null = null;

export function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(TOKEN);
  }
  return bot;
}

// ─── PAP Conversation State ──────────────────────────────────────────────────
type PapState = {
  step: "choose_gender" | "awaiting_media";
  gender?: string;
};
const papStates = new Map<number, PapState>();

// ─── Upload bot profile photo ─────────────────────────────────────────────────
// NOTE: Telegram Bot API does not allow bots to set their own profile photo programmatically.
// The photo must be set manually via BotFather:
// 1. Open @BotFather on Telegram
// 2. /mybots → select your bot → Edit Bot → Edit Botpic
// 3. Send the photo from attached_assets/bigpekob_bot_photo.png
async function setBotProfilePhoto() {
  console.log("[telegram] Bot profile photo must be set manually via @BotFather → /mybots → Edit Bot → Edit Botpic");
  console.log("[telegram] Use the image at: attached_assets/bigpekob_bot_photo.png");
}

// ─── Channel auto-posting (every hour) ───────────────────────────────────────
async function postToChannel() {
  const b = getBot();
  const channel = await storage.getChannelConfig();
  if (!channel) return;

  try {
    const videos = await storage.getVideos();
    if (!videos.length) return;

    // Pick a random video
    const video = videos[Math.floor(Math.random() * Math.min(videos.length, 20))];
    const author = video.author?.displayName || `@${video.author?.username}` || "BigPekob";
    const caption =
      `🔥 *${video.title || "Video Viral"}*\n` +
      `👤 ${author}\n` +
      `❤️ ${video.likeCount || 0} likes\n\n` +
      `Nonton indo terbaru dan yang lagi viral cuman ada disini 🎬\n` +
      `👇 Buka sekarang:`;

    await b.sendMessage(channel.channelId, caption, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🎬 Tonton di BigPekob", web_app: { url: MINI_APP_URL } }]],
      },
    });
    await storage.updateChannelLastPosted(channel.id);
    console.log(`[telegram] Posted to channel ${channel.channelId}`);
  } catch (err: any) {
    console.error("[telegram] Channel post error:", err?.message || err);
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────
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
      { command: "vip", description: "🌟 Jadi member VIP (download video)" },
      { command: "trending", description: "🔥 Video yang lagi viral" },
      { command: "pap", description: "📸 Donasi PAP (khusus 18+)" },
      { command: "setchannel", description: "⚙️ Admin: daftarkan channel BigPekob" },
      { command: "help", description: "Bantuan" },
    ]);

    await (b as any).setMyDescription(
      "🔞 BigPekob — Nonton indo terbaru dan yang lagi viral cuman ada disini!\n\n" +
      "⚠️ KHUSUS 18+ — Dilarang keras untuk pengguna di bawah umur.\n\n" +
      "✅ Fitur:\n" +
      "• Nonton video indo viral\n" +
      "• Upload video kamu\n" +
      "• VIP: Download video bebas\n" +
      "• Donasi PAP eksklusif"
    );

    await (b as any).setMyShortDescription(
      "🔞 Video indo viral 18+ — cuman ada di BigPekob!"
    );

    // Set menu button
    await (b as any).setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "🎬 Buka BigPekob",
        web_app: { url: MINI_APP_URL },
      },
    });

    // Set profile photo
    await setBotProfilePhoto();

    // Start hourly channel posting
    setInterval(postToChannel, 60 * 60 * 1000);

    console.log(`[telegram] Webhook set to ${WEBHOOK_URL}`);
  } catch (err) {
    console.error("[telegram] Failed to setup webhook:", err);
  }
}

// ─── Send main menu ───────────────────────────────────────────────────────────
async function sendMainMenu(chatId: number, firstName?: string) {
  const b = getBot();
  await b.sendMessage(
    chatId,
    `🔞 *BigPekob* — Nonton indo terbaru dan yang lagi viral cuman ada disini! 🔥\n\n` +
    (firstName ? `Halo *${firstName}*! ` : "") +
    `Pilih menu di bawah:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎬 Buka BigPekob Mini App", web_app: { url: MINI_APP_URL } }],
          [
            { text: "🌟 Jadi VIP", callback_data: "menu_vip" },
            { text: "🔥 Trending", callback_data: "menu_trending" },
          ],
          [{ text: "📸 Donasi PAP 18+", callback_data: "menu_pap" }],
        ],
      },
    }
  );
}

// ─── Handle Updates ───────────────────────────────────────────────────────────
export async function handleTelegramUpdate(body: any) {
  if (!TOKEN) return;
  const b = getBot();

  // Handle Stars pre-checkout
  if (body.pre_checkout_query) {
    await b.answerPreCheckoutQuery(body.pre_checkout_query.id, true);
    return;
  }

  // Handle Stars successful payment
  if (body.message?.successful_payment) {
    const msg = body.message;
    const chatId = msg.chat.id;
    const tgId = msg.from.id;
    const payload = msg.successful_payment.invoice_payload;

    if (payload === "vip_30days") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.setVipUser(tgId, expiresAt);
      await b.sendMessage(
        chatId,
        "🌟 *Selamat! Kamu sekarang VIP BigPekob!*\n\n" +
        "✅ Keuntungan VIP aktif 30 hari:\n" +
        "• Download video bebas\n" +
        "• Akses konten eksklusif\n\n" +
        `_VIP aktif sampai: ${expiresAt.toLocaleDateString("id-ID")}_`,
        { parse_mode: "Markdown" }
      );
    }
    return;
  }

  // Handle callback queries (inline button presses)
  if (body.callback_query) {
    const query = body.callback_query;
    const chatId = query.message.chat.id;
    const tgId = query.from.id;
    const data = query.data;

    await b.answerCallbackQuery(query.id);

    if (data === "menu_vip") {
      await sendVipInfo(chatId, tgId);
      return;
    }
    if (data === "buy_vip") {
      await sendVipInvoice(chatId, query.from.first_name);
      return;
    }
    if (data === "menu_trending") {
      await sendTrending(chatId);
      return;
    }
    if (data === "menu_pap") {
      await startPapFlow(chatId, tgId);
      return;
    }
    if (data === "pap_female") {
      papStates.set(tgId, { step: "awaiting_media", gender: "female" });
      await b.sendMessage(chatId,
        "📸 *Donasi PAP Cewek*\n\n" +
        "Kirim foto atau video PAP kamu + tulisan caption.\n\n" +
        "⚠️ _Identitas kamu dijaga kerahasiaannya. Konten kamu akan terlihat oleh member cowok._\n\n" +
        "Kirim sekarang:",
        { parse_mode: "Markdown" }
      );
      return;
    }
    if (data === "pap_male") {
      papStates.set(tgId, { step: "awaiting_media", gender: "male" });
      await b.sendMessage(chatId,
        "📸 *Donasi PAP Cowok*\n\n" +
        "Kirim foto atau video PAP kamu + tulisan caption.\n\n" +
        "⚠️ _Identitas kamu dijaga kerahasiaannya. Konten kamu akan terlihat oleh member cewek._\n\n" +
        "Kirim sekarang:",
        { parse_mode: "Markdown" }
      );
      return;
    }
    if (data?.startsWith("view_pap_")) {
      const gender = data.replace("view_pap_", "");
      await sendPapContent(chatId, tgId, gender);
      return;
    }
    return;
  }

  const msg = body.message || body.edited_message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const tgId = msg.from?.id;
  const text = msg.text || "";
  const firstName = msg.from?.first_name || "";

  // Check if user is in PAP flow and expecting media
  if (tgId && papStates.has(tgId)) {
    const state = papStates.get(tgId)!;
    if (state.step === "awaiting_media") {
      let fileId: string | null = null;
      let mediaType: string | null = null;

      if (msg.photo) {
        const largestPhoto = msg.photo[msg.photo.length - 1];
        fileId = largestPhoto.file_id;
        mediaType = "photo";
      } else if (msg.video) {
        fileId = msg.video.file_id;
        mediaType = "video";
      }

      if (fileId && mediaType && state.gender) {
        const caption = msg.caption || "";
        await storage.addPapDonation({
          telegramId: tgId,
          gender: state.gender,
          fileId,
          mediaType,
          caption,
        });
        papStates.delete(tgId);

        const genderLabel = state.gender === "female" ? "Cewek" : "Cowok";
        await b.sendMessage(chatId,
          `✅ *PAP ${genderLabel} berhasil dikirim!*\n\n` +
          "Terima kasih sudah berdonasi PAP 🔥\n" +
          "Konten kamu sudah tersimpan dan bisa dilihat oleh member lawan jenis.\n\n" +
          "⚠️ _Privasi kamu terjaga — identitasmu tidak akan diungkapkan._",
          { parse_mode: "Markdown" }
        );
        return;
      } else if (!msg.photo && !msg.video) {
        // They sent text when we expected media
        await b.sendMessage(chatId,
          "⚠️ Kirim foto atau video, bukan teks.\n\nKetik /start untuk kembali ke menu utama.",
        );
        return;
      }
    }
  }

  // Commands
  if (text.startsWith("/start")) {
    await sendMainMenu(chatId, firstName);
    return;
  }

  if (text.startsWith("/vip")) {
    await sendVipInfo(chatId, tgId);
    return;
  }

  if (text.startsWith("/trending")) {
    await sendTrending(chatId);
    return;
  }

  if (text.startsWith("/pap")) {
    await startPapFlow(chatId, tgId);
    return;
  }

  if (text.startsWith("/setchannel")) {
    const parts = text.split(" ");
    if (parts.length < 2) {
      await b.sendMessage(chatId,
        "⚙️ Cara daftar channel:\n\n" +
        "1. Buat channel Telegram dengan nama *BigPekob*\n" +
        "2. Tambahkan bot ini sebagai admin (beri izin post)\n" +
        "3. Forward pesan dari channel ke sini, atau ketik:\n\n" +
        "`/setchannel @NamaChannel` atau `/setchannel -100xxxxxxxxxx`",
        { parse_mode: "Markdown" }
      );
      return;
    }
    const channelId = parts[1];
    await storage.setChannelConfig(channelId);
    await b.sendMessage(chatId,
      `✅ Channel *${channelId}* berhasil didaftarkan!\n\nBot akan posting otomatis setiap jam ke channel tersebut.`,
      { parse_mode: "Markdown" }
    );
    // Post immediately as test
    await postToChannel();
    return;
  }

  if (text.startsWith("/help")) {
    await b.sendMessage(chatId,
      "📖 *Perintah BigPekob Bot:*\n\n" +
      "/start — Menu utama & buka Mini App\n" +
      "/vip — Info & beli akses VIP\n" +
      "/trending — Video yang lagi viral\n" +
      "/pap — Donasi PAP 18+\n" +
      "/setchannel — Daftarkan channel (admin)\n" +
      "/help — Bantuan ini\n\n" +
      "⚠️ _Konten dewasa 18+. Dilarang untuk pengguna di bawah umur._",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Default
  await sendMainMenu(chatId, firstName);
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function sendVipInfo(chatId: number, tgId: number) {
  const b = getBot();
  const isVip = tgId ? await storage.isVipUser(tgId) : false;

  if (isVip) {
    await b.sendMessage(chatId,
      "🌟 *Kamu sudah VIP BigPekob!*\n\n" +
      "✅ Keuntungan VIP kamu:\n" +
      "• Download video bebas di Mini App\n" +
      "• Akses konten eksklusif\n\n" +
      "Buka Mini App untuk download video:",
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🎬 Buka BigPekob", web_app: { url: MINI_APP_URL } }]] },
      }
    );
    return;
  }

  await b.sendMessage(chatId,
    "🌟 *Upgrade ke VIP BigPekob!*\n\n" +
    "Dengan VIP kamu bisa:\n" +
    "• ⬇️ Download semua video\n" +
    "• 🔓 Akses konten eksklusif\n" +
    "• ✅ Aktif 30 hari\n\n" +
    `💰 Harga: *${VIP_STARS_PRICE} Telegram Stars*\n\n` +
    "Klik tombol di bawah untuk beli:",
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: `🌟 Beli VIP — ${VIP_STARS_PRICE} Stars`, callback_data: "buy_vip" }]] },
    }
  );
}

async function sendVipInvoice(chatId: number, firstName?: string) {
  const b = getBot();
  await (b as any).sendInvoice(
    chatId,
    "🌟 BigPekob VIP — 30 Hari",
    `Akses VIP BigPekob selama 30 hari. Download video bebas + konten eksklusif!`,
    "vip_30days",
    "XTR",
    [{ label: "VIP 30 Hari", amount: VIP_STARS_PRICE }]
  );
}

async function sendTrending(chatId: number) {
  const b = getBot();
  try {
    const videos = await storage.getVideos();
    const top = videos.slice(0, 5);
    if (!top.length) {
      await b.sendMessage(chatId, "Belum ada video tersedia.");
      return;
    }
    let reply = "🔥 *Yang Lagi Viral di BigPekob:*\n\n";
    top.forEach((v, i) => {
      const author = (v as any).author?.displayName || `@${(v as any).author?.username}` || "Unknown";
      reply += `${i + 1}. *${v.title || "Untitled"}*\n   👤 ${author}  ❤️ ${(v as any).likeCount || 0}\n\n`;
    });
    await b.sendMessage(chatId, reply, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🎬 Tonton Sekarang", web_app: { url: MINI_APP_URL } }]] },
    });
  } catch {
    await b.sendMessage(chatId, "Gagal mengambil data video.");
  }
}

async function startPapFlow(chatId: number, tgId: number) {
  const b = getBot();
  await b.sendMessage(chatId,
    "📸 *Donasi PAP BigPekob* 🔞\n\n" +
    "Pilih jenis PAP yang mau kamu donasikan:\n\n" +
    "• *PAP Cewek* — kamu cewek, kirim foto/video PAP kamu → bisa dilihat cowok\n" +
    "• *PAP Cowok* — kamu cowok, kirim foto/video PAP kamu → bisa dilihat cewek\n\n" +
    "⚠️ _Privasi terjaga. Identitas tidak akan diungkapkan._\n\n" +
    "Pilih:",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "👩 PAP Cewek", callback_data: "pap_female" },
            { text: "👨 PAP Cowok", callback_data: "pap_male" },
          ],
          [{ text: "👀 Lihat PAP (sebagai Cewek)", callback_data: "view_pap_female" }],
          [{ text: "👀 Lihat PAP (sebagai Cowok)", callback_data: "view_pap_male" }],
        ],
      },
    }
  );
}

async function sendPapContent(chatId: number, tgId: number, viewerGender: string) {
  const b = getBot();
  try {
    const donations = await storage.getPapDonations(viewerGender);
    if (!donations.length) {
      await b.sendMessage(chatId,
        "😔 Belum ada donasi PAP untuk kategori ini.\n\nJadi yang pertama donasi!",
      );
      return;
    }
    await b.sendMessage(chatId,
      `🔥 *PAP Eksklusif BigPekob* (${donations.length} konten):\n\n_Identitas pengirim dirahasiakan._`,
      { parse_mode: "Markdown" }
    );
    // Send up to 5 random PAP items
    const sample = donations.slice(0, 5);
    for (const d of sample) {
      const caption = d.caption ? `💬 ${d.caption}` : undefined;
      try {
        if (d.mediaType === "photo") {
          await b.sendPhoto(chatId, d.fileId, { caption });
        } else {
          await b.sendVideo(chatId, d.fileId, { caption });
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (err) {
    await b.sendMessage(chatId, "Gagal mengambil konten PAP.");
  }
}
