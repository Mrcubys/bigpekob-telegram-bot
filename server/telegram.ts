import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const DOMAIN = process.env.REPLIT_DOMAINS?.split(",")[0] || "";
const WEBHOOK_URL = `https://${DOMAIN}/api/telegram/webhook`;
const MINI_APP_URL = `https://${DOMAIN}/telegram`;
const VIP_STARS_PRICE = 100;

let bot: TelegramBot | null = null;

export function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(TOKEN);
  }
  return bot;
}

// ─── Panggil Bot API langsung (lebih reliable) ───────────────────────────────
async function callAPI(method: string, params: Record<string, any> = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json() as any;
    if (!data.ok) {
      console.warn(`[telegram] ${method} gagal:`, data.description);
    }
    return data;
  } catch (err: any) {
    console.error(`[telegram] Error panggil ${method}:`, err.message);
    return { ok: false };
  }
}

// ─── State in-memory (PAP, menunggu media) ───────────────────────────────────
const papAwaitingMedia = new Set<number>(); // userId yg sedang menunggu kirim media

// ─── Promo messages yang dirotasi setiap jam ─────────────────────────────────
const promoMessages = [
  {
    text:
      "🔥 *BigPekob — Video Indo Viral 18+*\n\n" +
      "Nonton video indo terbaru yang lagi trending cuman ada di sini!\n\n" +
      "🌟 *Upgrade VIP sekarang* dengan Telegram Stars!\n" +
      "✅ VIP = Download video bebas + konten eksklusif\n\n" +
      "👇 Buka sekarang dan rasain sendiri:",
  },
  {
    text:
      "🔞 *BigPekob Update Terbaru!*\n\n" +
      "Video indo viral terbaru udah masuk! Jangan sampe ketinggalan 🔥\n\n" +
      "💎 *Member VIP BigPekob:*\n" +
      "• Download semua video\n" +
      "• Akses konten eksklusif\n" +
      "• Hanya 100 Telegram Stars — aktif 30 hari!\n\n" +
      "👇 Klik untuk nonton:",
  },
  {
    text:
      "📸 *Donasi PAP Eksklusif* — BigPekob\n\n" +
      "Kirim PAP kamu dan lihat PAP dari member lain!\n" +
      "Privasi 100% terjaga 🔒\n\n" +
      "🎬 Nonton video indo viral + fitur PAP eksklusif:\n",
  },
  {
    text:
      "🌟 *Promo VIP BigPekob!*\n\n" +
      "Cukup 100 Telegram Stars = 30 hari akses VIP penuh!\n\n" +
      "✅ Yang kamu dapat:\n" +
      "• ⬇️ Download video tanpa batas\n" +
      "• 🔓 Konten eksklusif VIP\n" +
      "• 📸 Akses PAP premium\n\n" +
      "Jangan tunggu lagi! Buka bot sekarang:",
  },
];

let promoIndex = 0;

// ─── Posting promosi ke channel setiap jam ────────────────────────────────────
async function postToChannel() {
  const channel = await storage.getChannelConfig();
  if (!channel) {
    console.log("[telegram] Channel belum dikonfigurasi, skip posting");
    return;
  }

  const promo = promoMessages[promoIndex % promoMessages.length];
  promoIndex++;

  const result = await callAPI("sendMessage", {
    chat_id: channel.channelId,
    text: promo.text,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: "🎬 Buka BigPekob Sekarang", url: `https://t.me/${TOKEN.split(":")[0]}?start=channel` }],
        [{ text: "🌟 Upgrade VIP — 100 Stars", url: `https://t.me/${TOKEN.split(":")[0]}?start=vip` }],
      ],
    }),
  });

  if (result.ok) {
    await storage.updateChannelLastPosted(channel.id);
    console.log(`[telegram] Promosi terkirim ke channel ${channel.channelId}`);
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────
export async function setupTelegramWebhook() {
  if (!TOKEN) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN belum diset");
    return;
  }

  // Set webhook
  await callAPI("setWebhook", { url: WEBHOOK_URL, drop_pending_updates: true });

  // Set commands (hanya yang publik, setchannel tersembunyi)
  await callAPI("setMyCommands", {
    commands: [
      { command: "start", description: "Buka BigPekob Mini App" },
      { command: "vip", description: "🌟 Upgrade VIP — download video bebas" },
      { command: "pap", description: "📸 Donasi & lihat PAP eksklusif 18+" },
      { command: "help", description: "Bantuan & info bot" },
    ],
  });

  // Set deskripsi bot
  await callAPI("setMyDescription", {
    description:
      "🔞 BigPekob — Nonton video indo viral 18+ cuman ada di sini!\n\n" +
      "⚠️ KHUSUS 18+ — Dilarang untuk pengguna di bawah umur.\n\n" +
      "✅ Fitur:\n• Nonton & upload video indo viral\n• VIP: Download video bebas\n• Donasi PAP eksklusif",
  });

  await callAPI("setMyShortDescription", {
    short_description: "🔞 Video indo viral 18+ — cuman ada di BigPekob!",
  });

  // Set menu button
  await callAPI("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "🎬 Buka BigPekob",
      web_app: { url: MINI_APP_URL },
    },
  });

  // Mulai posting channel setiap jam
  setInterval(postToChannel, 60 * 60 * 1000);
  // Posting pertama setelah 5 menit (bukan langsung, beri waktu bot setup)
  setTimeout(postToChannel, 5 * 60 * 1000);

  console.log(`[telegram] Webhook aktif: ${WEBHOOK_URL}`);
}

// ─── Kirim menu utama ─────────────────────────────────────────────────────────
async function sendMainMenu(chatId: number, firstName?: string) {
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      `🔞 *BigPekob* — Video Indo Viral 18+ 🔥\n\n` +
      (firstName ? `Halo *${firstName}*! ` : "") +
      `Pilih menu di bawah atau buka Mini App:`,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: "🎬 Buka BigPekob Mini App", web_app: { url: MINI_APP_URL } }],
        [
          { text: "🌟 Upgrade VIP", callback_data: "menu_vip" },
          { text: "📸 Donasi PAP", callback_data: "menu_pap" },
        ],
        [{ text: "❓ Bantuan", callback_data: "menu_help" }],
      ],
    }),
  });
}

// ─── Minta pilih gender ───────────────────────────────────────────────────────
async function askGender(chatId: number) {
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      "👋 Sebelum mulai, pilih jenis kelamin kamu:\n\n" +
      "Pilihan ini menentukan konten PAP yang bisa kamu kirim dan lihat.",
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: "👨 Laki-laki", callback_data: "set_gender_male" },
          { text: "👩 Perempuan", callback_data: "set_gender_female" },
        ],
      ],
    }),
  });
}

// ─── VIP invoice (100 Stars) ──────────────────────────────────────────────────
async function sendVipInvoice(chatId: number) {
  const result = await callAPI("sendInvoice", {
    chat_id: chatId,
    title: "🌟 BigPekob VIP — 30 Hari",
    description: "Akses VIP BigPekob 30 hari: download video bebas + konten eksklusif!",
    payload: "vip_30days",
    currency: "XTR",
    prices: [{ label: "VIP 30 Hari", amount: VIP_STARS_PRICE }],
  });
  if (!result.ok) {
    // Fallback: kirim pesan manual jika invoice gagal
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: `⚠️ Gagal membuat invoice otomatis.\n\nHubungi admin untuk upgrade VIP manual.`,
    });
  }
}

// ─── Kirim info VIP ───────────────────────────────────────────────────────────
async function sendVipInfo(chatId: number, telegramId: number) {
  const isVip = await storage.isVipUser(telegramId);

  if (isVip) {
    await callAPI("sendMessage", {
      chat_id: chatId,
      text:
        "🌟 *Kamu sudah VIP BigPekob!*\n\n" +
        "✅ Keuntungan aktif:\n" +
        "• Download video bebas di Mini App\n" +
        "• Akses konten eksklusif\n\n" +
        "Buka Mini App untuk menikmati semua fitur VIP:",
      parse_mode: "Markdown",
      reply_markup: JSON.stringify({
        inline_keyboard: [[{ text: "🎬 Buka BigPekob", web_app: { url: MINI_APP_URL } }]],
      }),
    });
    return;
  }

  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      "🌟 *Upgrade ke VIP BigPekob!*\n\n" +
      "Yang kamu dapat dengan VIP:\n" +
      "• ⬇️ Download semua video bebas\n" +
      "• 🔓 Akses konten eksklusif VIP\n" +
      "• ✅ Aktif selama 30 hari\n\n" +
      `💰 Harga: *${VIP_STARS_PRICE} Telegram Stars*\n\n` +
      "Klik tombol di bawah untuk langsung bayar dengan Stars:",
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: `🌟 Beli VIP — ${VIP_STARS_PRICE} Stars`, callback_data: "buy_vip" }],
      ],
    }),
  });
}

// ─── PAP flow berdasarkan gender user ────────────────────────────────────────
async function sendPapMenu(chatId: number, telegramId: number) {
  const tgUser = await storage.getTelegramUser(telegramId);
  if (!tgUser?.gender) {
    await askGender(chatId);
    return;
  }

  const gender = tgUser.gender;
  const genderLabel = gender === "male" ? "Laki-laki" : "Perempuan";
  const genderEmoji = gender === "male" ? "👨" : "👩";
  const oppositeLabel = gender === "male" ? "Perempuan" : "Laki-laki";
  const oppositeEmoji = gender === "male" ? "👩" : "👨";

  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      `📸 *Menu PAP BigPekob* 🔞\n\n` +
      `Gender kamu: ${genderEmoji} *${genderLabel}*\n\n` +
      `• *Donasi PAP* — kirim foto/video PAP sebagai ${genderLabel}\n` +
      `  Konten kamu akan dilihat oleh member ${oppositeLabel}\n\n` +
      `• *Lihat PAP* — lihat PAP dari member ${oppositeLabel}\n\n` +
      `⚠️ _Privasi 100% terjaga. Identitas tidak pernah diungkapkan._`,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: `${genderEmoji} Donasi PAP Saya`, callback_data: "pap_donate" }],
        [{ text: `${oppositeEmoji} Lihat PAP ${oppositeLabel}`, callback_data: "pap_view" }],
        [{ text: "🔄 Ganti Gender", callback_data: "pap_change_gender" }],
      ],
    }),
  });
}

// ─── Kirim konten PAP ─────────────────────────────────────────────────────────
async function sendPapContent(chatId: number, telegramId: number) {
  const tgUser = await storage.getTelegramUser(telegramId);
  if (!tgUser?.gender) {
    await askGender(chatId);
    return;
  }

  const donations = await storage.getPapDonations(tgUser.gender);
  if (!donations.length) {
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: "😔 Belum ada konten PAP untuk kategori ini.\n\nBe the first to donate!",
    });
    return;
  }

  const oppositeGender = tgUser.gender === "male" ? "Perempuan" : "Laki-laki";
  await callAPI("sendMessage", {
    chat_id: chatId,
    text: `🔥 *PAP ${oppositeGender} Eksklusif* (${donations.length} konten)\n\n_Identitas pengirim dirahasiakan._`,
    parse_mode: "Markdown",
  });

  const sample = donations.slice(0, 5);
  for (const d of sample) {
    const caption = d.caption ? `💬 ${d.caption}` : "";
    if (d.mediaType === "photo") {
      await callAPI("sendPhoto", { chat_id: chatId, photo: d.fileId, caption });
    } else {
      await callAPI("sendVideo", { chat_id: chatId, video: d.fileId, caption });
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}

// ─── Proses update dari Telegram ─────────────────────────────────────────────
export async function handleTelegramUpdate(body: any) {
  if (!TOKEN) return;

  // ── Pre-checkout Stars (wajib dijawab) ────────────────────────────────────
  if (body.pre_checkout_query) {
    await callAPI("answerPreCheckoutQuery", {
      pre_checkout_query_id: body.pre_checkout_query.id,
      ok: true,
    });
    return;
  }

  // ── Pembayaran Stars berhasil ─────────────────────────────────────────────
  if (body.message?.successful_payment) {
    const msg = body.message;
    const chatId = msg.chat.id;
    const tgId: number = msg.from.id;
    const payload = msg.successful_payment.invoice_payload;

    if (payload === "vip_30days") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.setVipUser(tgId, expiresAt);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          "🌟 *Selamat! Kamu sekarang VIP BigPekob!*\n\n" +
          "✅ VIP aktif 30 hari:\n" +
          "• Download video bebas di Mini App\n" +
          "• Akses konten eksklusif\n\n" +
          `_Aktif sampai: ${expiresAt.toLocaleDateString("id-ID")}_\n\n` +
          "Buka Mini App sekarang:",
        parse_mode: "Markdown",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "🎬 Buka BigPekob", web_app: { url: MINI_APP_URL } }]],
        }),
      });
    }
    return;
  }

  // ── Callback query (tombol inline) ────────────────────────────────────────
  if (body.callback_query) {
    const query = body.callback_query;
    const chatId: number = query.message.chat.id;
    const tgId: number = query.from.id;
    const data: string = query.data || "";

    // Selalu jawab callback query agar loading spinner hilang
    await callAPI("answerCallbackQuery", { callback_query_id: query.id });

    // Simpan/update profil user
    await storage.upsertTelegramUser({
      telegramId: tgId,
      firstName: query.from.first_name,
      username: query.from.username,
    });

    if (data === "menu_vip") {
      await sendVipInfo(chatId, tgId);
      return;
    }

    if (data === "buy_vip") {
      await sendVipInvoice(chatId);
      return;
    }

    if (data === "menu_pap") {
      await sendPapMenu(chatId, tgId);
      return;
    }

    if (data === "menu_help") {
      await sendHelp(chatId);
      return;
    }

    if (data === "pap_donate") {
      const tgUser = await storage.getTelegramUser(tgId);
      if (!tgUser?.gender) { await askGender(chatId); return; }
      papAwaitingMedia.add(tgId);
      const genderLabel = tgUser.gender === "male" ? "Laki-laki" : "Perempuan";
      const oppositeLabel = tgUser.gender === "male" ? "Perempuan" : "Laki-laki";
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          `📸 *Donasi PAP ${genderLabel}*\n\n` +
          `Kirim foto atau video PAP kamu + tulisan caption (opsional).\n\n` +
          `⚠️ _Konten kamu akan dilihat oleh member ${oppositeLabel}. Identitas kamu TIDAK akan diungkapkan._\n\n` +
          `Kirim foto/video sekarang:`,
        parse_mode: "Markdown",
      });
      return;
    }

    if (data === "pap_view") {
      await sendPapContent(chatId, tgId);
      return;
    }

    if (data === "pap_change_gender") {
      await askGender(chatId);
      return;
    }

    if (data === "set_gender_male") {
      await storage.upsertTelegramUser({ telegramId: tgId, gender: "male" });
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "✅ Gender kamu: 👨 *Laki-laki*\n\nSekarang kamu bisa donasi PAP dan lihat PAP dari member Perempuan.",
        parse_mode: "Markdown",
      });
      await sendPapMenu(chatId, tgId);
      return;
    }

    if (data === "set_gender_female") {
      await storage.upsertTelegramUser({ telegramId: tgId, gender: "female" });
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "✅ Gender kamu: 👩 *Perempuan*\n\nSekarang kamu bisa donasi PAP dan lihat PAP dari member Laki-laki.",
        parse_mode: "Markdown",
      });
      await sendPapMenu(chatId, tgId);
      return;
    }

    return;
  }

  // ── Pesan biasa ───────────────────────────────────────────────────────────
  const msg = body.message || body.edited_message;
  if (!msg) return;

  const chatId: number = msg.chat.id;
  const tgId: number = msg.from?.id;
  const firstName: string = msg.from?.first_name || "";
  const username: string = msg.from?.username || "";
  const text: string = msg.text || "";

  if (!tgId) return;

  // Simpan/update profil user
  await storage.upsertTelegramUser({ telegramId: tgId, firstName, username });

  // ── Cek apakah user sedang menunggu kirim media PAP ──────────────────────
  if (papAwaitingMedia.has(tgId)) {
    let fileId: string | null = null;
    let mediaType: string | null = null;

    if (msg.photo?.length) {
      fileId = msg.photo[msg.photo.length - 1].file_id;
      mediaType = "photo";
    } else if (msg.video) {
      fileId = msg.video.file_id;
      mediaType = "video";
    }

    if (fileId && mediaType) {
      const tgUser = await storage.getTelegramUser(tgId);
      const gender = tgUser?.gender || "male";
      const caption = msg.caption || "";

      await storage.addPapDonation({ telegramId: tgId, gender, fileId, mediaType, caption });
      papAwaitingMedia.delete(tgId);

      const genderLabel = gender === "male" ? "Laki-laki" : "Perempuan";
      const oppositeLabel = gender === "male" ? "Perempuan" : "Laki-laki";
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          `✅ *PAP ${genderLabel} berhasil dikirim!*\n\n` +
          `Terima kasih! Konten kamu sudah tersimpan dan bisa dilihat oleh member ${oppositeLabel} 🔥\n\n` +
          `⚠️ _Privasi kamu 100% terjaga._`,
        parse_mode: "Markdown",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "📸 Kembali ke Menu PAP", callback_data: "menu_pap" }]],
        }),
      });
      return;
    } else {
      // Mereka kirim teks bukan media
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Kirim *foto* atau *video*, bukan teks.\n\nAtau ketik /pap untuk kembali ke menu PAP.",
        parse_mode: "Markdown",
      });
      return;
    }
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    const tgUser = await storage.getTelegramUser(tgId);
    if (!tgUser?.gender) {
      // User baru, minta pilih gender dulu
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          `🔞 *Selamat datang di BigPekob!* ${firstName ? `Halo ${firstName}!` : ""}\n\n` +
          `Video indo viral 18+ cuman ada di sini 🔥\n\n` +
          `Sebelum mulai, pilih jenis kelamin kamu:`,
        parse_mode: "Markdown",
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              { text: "👨 Laki-laki", callback_data: "set_gender_male" },
              { text: "👩 Perempuan", callback_data: "set_gender_female" },
            ],
          ],
        }),
      });
    } else {
      await sendMainMenu(chatId, firstName);
    }
    return;
  }

  if (text.startsWith("/vip")) {
    await sendVipInfo(chatId, tgId);
    return;
  }

  if (text.startsWith("/pap")) {
    await sendPapMenu(chatId, tgId);
    return;
  }

  if (text.startsWith("/help")) {
    await sendHelp(chatId);
    return;
  }

  // Perintah admin tersembunyi — set channel
  if (text.startsWith("/setchannel")) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          "⚙️ Gunakan: `/setchannel @NamaChannel` atau `/setchannel -100xxxxxxxxxx`\n\n" +
          "Pastikan bot sudah ditambahkan sebagai admin di channel tersebut.",
        parse_mode: "Markdown",
      });
      return;
    }
    const channelId = parts[1];
    await storage.setChannelConfig(channelId);
    await callAPI("sendMessage", {
      chat_id: chatId,
      text:
        `✅ Channel *${channelId}* berhasil didaftarkan!\n\n` +
        `Bot akan posting promosi otomatis ke channel setiap jam.\n` +
        `Posting pertama dalam 5 menit.`,
      parse_mode: "Markdown",
    });
    return;
  }

  // Perintah admin tersembunyi — posting sekarang
  if (text.startsWith("/postsekarang")) {
    await postToChannel();
    await callAPI("sendMessage", { chat_id: chatId, text: "✅ Posting dikirim." });
    return;
  }

  // Default: kirim menu utama
  await sendMainMenu(chatId, firstName);
}

// ─── Bantuan ──────────────────────────────────────────────────────────────────
async function sendHelp(chatId: number) {
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      "📖 *Perintah BigPekob Bot:*\n\n" +
      "/start — Menu utama & buka Mini App\n" +
      "/vip — Info & upgrade akses VIP\n" +
      "/pap — Donasi & lihat PAP eksklusif 18+\n" +
      "/help — Bantuan ini\n\n" +
      "⚠️ _Konten dewasa 18+. Dilarang untuk pengguna di bawah umur._",
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: "🎬 Buka BigPekob", web_app: { url: MINI_APP_URL } }]],
    }),
  });
}
