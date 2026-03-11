import { storage } from "./storage";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const DOMAIN = process.env.REPLIT_DOMAINS?.split(",")[0] || "";
const WEBHOOK_URL = `https://${DOMAIN}/api/telegram/webhook`;
const MINI_APP_URL = `https://${DOMAIN}/telegram`;
const VIP_STARS_PRICE = 100;
const BIGPEKOB_BOT = "bigpekob_bot";
const CHAT_BOT = "bigpekob_chat_bot";

const papAwaitingMedia = new Set<number>();
const awaitingChannelMsg = new Set<number>();
let promoIndex = 0;

async function callAPI(method: string, params: Record<string, any> = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as any;
    if (!data.ok) console.warn(`[telegram] ${method} gagal:`, data.description);
    return data;
  } catch (err: any) {
    console.error(`[telegram] Error ${method}:`, err.message);
    return { ok: false };
  }
}

async function postToChannel() {
  const channel = await storage.getChannelConfig();
  if (!channel) return;

  const videos = await storage.getVideos();
  const latest = videos.slice(0, 10);

  let videoList = "";
  if (latest.length > 0) {
    videoList =
      "\n\n🎬 <b>Nonton Sekarang:</b>\n" +
      latest.map((v, i) => `${i + 1}. ${escHtml(v.title || "Untitled")}`).join("\n");
  }

  const promos = [
    () =>
      `🔥 <b>Video Indo Viral Terbaru!</b>${videoList}\n\n` +
      `👆 Nonton sekarang di @${BIGPEKOB_BOT}\n` +
      `🌟 Upgrade VIP untuk download video bebas!\n` +
      `💬 Chat anonim di @${CHAT_BOT}`,

    () =>
      `📺 <b>Update Video Indo BigPekob!</b>${videoList}\n\n` +
      `🔞 Nonton gratis, download khusus VIP!\n` +
      `👉 Buka @${BIGPEKOB_BOT} sekarang\n` +
      `👥 Chat stranger anonim: @${CHAT_BOT}`,

    () =>
      `📸 <b>Donasi PAP Eksklusif BigPekob!</b>\n\n` +
      `Kirim PAP kamu dan lihat PAP dari member lain!\n` +
      `✅ Privasi 100% terjaga — identitas tidak pernah diungkapkan\n` +
      `👨 PAP cowok → dilihat cewek\n` +
      `👩 PAP cewek → dilihat cowok\n\n` +
      `📌 Kirim PAP lewat bot: @${BIGPEKOB_BOT}\n` +
      `Ketik /pap untuk mulai!`,

    () =>
      `🎥 <b>Upload Video Kamu ke BigPekob!</b>\n\n` +
      `Punya video menarik? Upload sekarang dan dapatkan likes dari ribuan member!\n\n` +
      `✅ Upload gratis &amp; mudah\n` +
      `🔥 Video kamu tampil di feed member lain\n\n` +
      `👉 Upload di: @${BIGPEKOB_BOT}${videoList ? `\n\n📺 Video trending:\n${latest.slice(0, 5).map((v, i) => `${i + 1}. ${escHtml(v.title || "Untitled")}`).join("\n")}` : ""}`,

    () =>
      `🌟 <b>Jadi Member VIP BigPekob!</b>\n\n` +
      `Cuma 100 Telegram Stars = 30 hari akses VIP:\n` +
      `• ⬇️ Download semua video\n` +
      `• 📸 Akses PAP eksklusif\n` +
      `• 💬 Pilih gender di @${CHAT_BOT}\n\n` +
      `🔥 Upgrade sekarang di @${BIGPEKOB_BOT}${videoList}`,

    () =>
      `💬 <b>Chat Anonim di BigPekob!</b>\n\n` +
      `Ketemu stranger baru setiap saat di @${CHAT_BOT}\n\n` +
      `🎭 Identitas 100% terjaga\n` +
      `🔍 Cari pasangan chat random\n` +
      `🌟 VIP: pilih gender lawan chat\n\n` +
      `Nonton juga: @${BIGPEKOB_BOT}${videoList}`,
  ];

  const text = promos[promoIndex % promos.length]();
  promoIndex++;

  const result = await callAPI("sendMessage", {
    chat_id: channel.channelId,
    text,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: "🎬 Buka BigPekob", url: `https://t.me/${BIGPEKOB_BOT}` }],
        [{ text: "💬 Chat Anonim", url: `https://t.me/${CHAT_BOT}` }],
      ],
    }),
  });

  if (result.ok) {
    await storage.updateChannelLastPosted(channel.id);
    console.log(`[telegram] Promo terkirim ke ${channel.channelId} (template ${promoIndex})`);
  }
}

export async function setupTelegramWebhook() {
  if (!TOKEN) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN belum diset");
    return;
  }

  await callAPI("setWebhook", { url: WEBHOOK_URL, drop_pending_updates: true });

  await callAPI("setMyCommands", {
    commands: [
      { command: "start", description: "Buka BigPekob Mini App" },
      { command: "vip", description: "🌟 Upgrade VIP — download video bebas" },
      { command: "pap", description: "📸 Donasi & lihat PAP eksklusif 18+" },
      { command: "chatkechannel", description: "💬 Kirim pesan ke channel BigPekob" },
      { command: "help", description: "Bantuan & info bot" },
    ],
  });

  await callAPI("setMyDescription", {
    description:
      "🔞 BigPekob — Nonton video indo viral 18+ cuman ada di sini!\n\n" +
      "⚠️ KHUSUS 18+ — Dilarang untuk pengguna di bawah umur.\n\n" +
      "✅ Fitur:\n• Nonton & upload video indo viral\n• VIP: Download video bebas\n• Donasi PAP eksklusif\n• Chat anonim di @bigpekob_chat_bot",
  });

  await callAPI("setMyShortDescription", {
    short_description: "🔞 Video indo viral 18+ — cuman ada di BigPekob!",
  });

  await callAPI("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "🎬 Buka BigPekob",
      web_app: { url: MINI_APP_URL },
    },
  });

  setInterval(postToChannel, 60 * 60 * 1000);
  setTimeout(postToChannel, 2 * 60 * 1000);

  console.log(`[telegram] Webhook aktif: ${WEBHOOK_URL}`);
}

async function sendMainMenu(chatId: number, firstName?: string) {
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      `🔞 <b>BigPekob</b> — Video Indo Viral 18+ 🔥\n\n` +
      (firstName ? `Halo <b>${escHtml(firstName)}</b>! ` : "") +
      `Pilih menu:`,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: "🎬 Buka BigPekob Mini App", web_app: { url: MINI_APP_URL } }],
        [
          { text: "🌟 Upgrade VIP", callback_data: "menu_vip" },
          { text: "📸 Donasi PAP", callback_data: "menu_pap" },
        ],
        [
          { text: "💬 Chat ke Channel", callback_data: "menu_chatkechannel" },
          { text: "👥 Chat Anonim", url: `https://t.me/${CHAT_BOT}` },
        ],
        [{ text: "❓ Bantuan", callback_data: "menu_help" }],
      ],
    }),
  });
}

async function askGender(chatId: number) {
  await callAPI("sendMessage", {
    chat_id: chatId,
    text: "👋 Sebelum mulai, pilih jenis kelamin kamu:\n\nPilihan ini menentukan konten PAP yang bisa kamu kirim dan lihat.",
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

async function sendVipInvoice(chatId: number) {
  await callAPI("sendInvoice", {
    chat_id: chatId,
    title: "🌟 BigPekob VIP — 30 Hari",
    description: "Akses VIP BigPekob 30 hari: download video + PAP eksklusif + pilih gender di chatbot!",
    payload: "vip_30days",
    currency: "XTR",
    prices: [{ label: "VIP 30 Hari", amount: VIP_STARS_PRICE }],
  });
}

async function sendVipInfo(chatId: number, telegramId: number) {
  const isVip = await storage.isVipUser(telegramId);
  if (isVip) {
    await callAPI("sendMessage", {
      chat_id: chatId,
      text:
        "🌟 <b>Kamu sudah VIP BigPekob!</b>\n\n✅ Aktif:\n• Download video di Mini App\n• Akses PAP eksklusif\n• Pilih gender di @" + CHAT_BOT,
      parse_mode: "HTML",
      reply_markup: JSON.stringify({
        inline_keyboard: [[{ text: "🎬 Buka BigPekob", web_app: { url: MINI_APP_URL } }]],
      }),
    });
    return;
  }
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      "🌟 <b>Upgrade ke VIP BigPekob!</b>\n\n" +
      "Yang kamu dapat:\n• ⬇️ Download semua video\n• 📸 Akses PAP eksklusif\n• 💬 Pilih gender lawan chat di @" +
      CHAT_BOT +
      "\n• ✅ Aktif 30 hari\n\n" +
      `💰 Harga: <b>${VIP_STARS_PRICE} Telegram Stars</b>\n\nKlik tombol untuk bayar:`,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: `🌟 Beli VIP — ${VIP_STARS_PRICE} Stars`, callback_data: "buy_vip" }]],
    }),
  });
}

async function sendPapMenu(chatId: number, telegramId: number) {
  const tgUser = await storage.getTelegramUser(telegramId);
  if (!tgUser?.gender) { await askGender(chatId); return; }

  const gender = tgUser.gender;
  const genderEmoji = gender === "male" ? "👨" : "👩";
  const genderLabel = gender === "male" ? "Laki-laki" : "Perempuan";
  const oppositeEmoji = gender === "male" ? "👩" : "👨";
  const oppositeLabel = gender === "male" ? "Perempuan" : "Laki-laki";

  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      `📸 <b>Menu PAP BigPekob</b> 🔞\n\n` +
      `Gender kamu: ${genderEmoji} <b>${genderLabel}</b>\n\n` +
      `• <b>Donasi PAP</b> → kontenmu dilihat ${oppositeLabel}\n` +
      `• <b>Lihat PAP</b> → lihat PAP dari ${oppositeLabel}\n\n` +
      `⚠️ <i>Privasi 100% terjaga. Identitas tidak pernah diungkapkan.</i>`,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: `${genderEmoji} Donasi PAP Saya`, callback_data: "pap_donate" }],
        [{ text: `${oppositeEmoji} Lihat PAP ${oppositeLabel}`, callback_data: "pap_view" }],
        [{ text: "🔄 Ganti Gender", callback_data: "pap_change_gender" }],
      ],
    }),
  });
}

async function sendPapContent(chatId: number, telegramId: number) {
  const tgUser = await storage.getTelegramUser(telegramId);
  if (!tgUser?.gender) { await askGender(chatId); return; }

  const donations = await storage.getPapDonations(tgUser.gender);
  if (!donations.length) {
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: "😔 Belum ada PAP untuk kategori ini.\n\nJadi yang pertama donasi!",
    });
    return;
  }

  const oppositeGender = tgUser.gender === "male" ? "Perempuan" : "Laki-laki";
  await callAPI("sendMessage", {
    chat_id: chatId,
    text: `🔥 <b>PAP ${oppositeGender} Eksklusif</b> (${donations.length} konten)\n\n<i>Identitas pengirim dirahasiakan 🔒</i>`,
    parse_mode: "HTML",
  });

  for (const d of donations.slice(0, 5)) {
    const caption = d.caption ? `💬 ${d.caption}` : "";
    if (d.mediaType === "photo") {
      await callAPI("sendPhoto", { chat_id: chatId, photo: d.fileId, caption });
    } else {
      await callAPI("sendVideo", { chat_id: chatId, video: d.fileId, caption });
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}

async function sendHelp(chatId: number) {
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      "📖 <b>Perintah BigPekob Bot:</b>\n\n" +
      "/start — Menu utama &amp; Mini App\n" +
      "/vip — Upgrade VIP\n" +
      "/pap — Donasi &amp; lihat PAP 18+\n" +
      "/chatkechannel — Kirim pesan ke channel\n" +
      "/help — Bantuan ini\n\n" +
      `👥 Chat anonim: @${CHAT_BOT}\n\n` +
      "⚠️ <i>Konten 18+. Dilarang di bawah umur.</i>",
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: "🎬 Buka BigPekob", web_app: { url: MINI_APP_URL } }]],
    }),
  });
}

export async function handleTelegramUpdate(body: any) {
  if (!TOKEN) return;

  if (body.pre_checkout_query) {
    await callAPI("answerPreCheckoutQuery", { pre_checkout_query_id: body.pre_checkout_query.id, ok: true });
    return;
  }

  if (body.message?.successful_payment) {
    const msg = body.message;
    const chatId: number = msg.chat.id;
    const tgId: number = msg.from.id;
    if (msg.successful_payment.invoice_payload === "vip_30days") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.setVipUser(tgId, expiresAt);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          "🌟 <b>Selamat! Kamu sekarang VIP BigPekob!</b>\n\n" +
          "✅ Aktif 30 hari:\n• Download video\n• PAP eksklusif\n• Pilih gender di @" +
          CHAT_BOT +
          "\n\n<i>Aktif sampai: " +
          expiresAt.toLocaleDateString("id-ID") +
          "</i>",
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "🎬 Buka BigPekob", web_app: { url: MINI_APP_URL } }]],
        }),
      });
    }
    return;
  }

  if (body.callback_query) {
    const query = body.callback_query;
    const chatId: number = query.message.chat.id;
    const tgId: number = query.from.id;
    const data: string = query.data || "";

    await callAPI("answerCallbackQuery", { callback_query_id: query.id });
    await storage.upsertTelegramUser({ telegramId: tgId, firstName: query.from.first_name, username: query.from.username });

    if (data === "menu_vip") { await sendVipInfo(chatId, tgId); return; }
    if (data === "buy_vip") { await sendVipInvoice(chatId); return; }
    if (data === "menu_pap") { await sendPapMenu(chatId, tgId); return; }
    if (data === "menu_help") { await sendHelp(chatId); return; }
    if (data === "menu_chatkechannel") {
      awaitingChannelMsg.add(tgId);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "💬 <b>Kirim Pesan ke Channel BigPekob</b>\n\nTulis pesan kamu sekarang. Pesan akan dikirim sebagai pesan anonim ke channel BigPekob.",
        parse_mode: "HTML",
      });
      return;
    }
    if (data === "pap_donate") {
      const tgUser = await storage.getTelegramUser(tgId);
      if (!tgUser?.gender) { await askGender(chatId); return; }
      papAwaitingMedia.add(tgId);
      const opp = tgUser.gender === "male" ? "Perempuan" : "Laki-laki";
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          `📸 <b>Donasi PAP ${tgUser.gender === "male" ? "Laki-laki" : "Perempuan"}</b>\n\nKirim foto atau video PAP kamu (+ caption opsional).\n\n` +
          `⚠️ <i>Kontenmu dilihat oleh member ${opp}. Identitas TIDAK diungkapkan.</i>\n\nKirim sekarang:`,
        parse_mode: "HTML",
      });
      return;
    }
    if (data === "pap_view") { await sendPapContent(chatId, tgId); return; }
    if (data === "pap_change_gender") { await askGender(chatId); return; }
    if (data === "set_gender_male") {
      await storage.upsertTelegramUser({ telegramId: tgId, gender: "male" });
      await callAPI("sendMessage", { chat_id: chatId, text: "✅ Gender: 👨 <b>Laki-laki</b>", parse_mode: "HTML" });
      await sendPapMenu(chatId, tgId);
      return;
    }
    if (data === "set_gender_female") {
      await storage.upsertTelegramUser({ telegramId: tgId, gender: "female" });
      await callAPI("sendMessage", { chat_id: chatId, text: "✅ Gender: 👩 <b>Perempuan</b>", parse_mode: "HTML" });
      await sendPapMenu(chatId, tgId);
      return;
    }
    return;
  }

  const msg = body.message || body.edited_message;
  if (!msg) return;

  const chatId: number = msg.chat.id;
  const tgId: number = msg.from?.id;
  const firstName: string = msg.from?.first_name || "";
  const username: string = msg.from?.username || "";
  const text: string = msg.text || "";

  if (!tgId) return;

  await storage.upsertTelegramUser({ telegramId: tgId, firstName, username });

  if (awaitingChannelMsg.has(tgId) && text && !text.startsWith("/")) {
    awaitingChannelMsg.delete(tgId);
    const channel = await storage.getChannelConfig();
    if (!channel) {
      await callAPI("sendMessage", { chat_id: chatId, text: "⚠️ Channel belum dikonfigurasi." });
      return;
    }
    const sent = await callAPI("sendMessage", {
      chat_id: channel.channelId,
      text: `💬 <b>Pesan dari Member BigPekob:</b>\n\n${escHtml(text)}`,
      parse_mode: "HTML",
    });
    if (sent.ok) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "✅ Pesan kamu berhasil dikirim ke channel BigPekob!",
      });
    } else {
      await callAPI("sendMessage", { chat_id: chatId, text: "⚠️ Gagal kirim pesan ke channel. Coba lagi nanti." });
    }
    return;
  }

  if (papAwaitingMedia.has(tgId)) {
    let fileId: string | null = null;
    let mediaType: string | null = null;
    if (msg.photo?.length) { fileId = msg.photo[msg.photo.length - 1].file_id; mediaType = "photo"; }
    else if (msg.video) { fileId = msg.video.file_id; mediaType = "video"; }

    if (fileId && mediaType) {
      const tgUser = await storage.getTelegramUser(tgId);
      const gender = tgUser?.gender || "male";
      await storage.addPapDonation({ telegramId: tgId, gender, fileId, mediaType, caption: msg.caption || "" });
      papAwaitingMedia.delete(tgId);
      const opp = gender === "male" ? "Perempuan" : "Laki-laki";
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: `✅ <b>PAP berhasil dikirim!</b>\n\nTerima kasih! Kontenmu bisa dilihat oleh member ${opp} 🔥\n\n⚠️ <i>Privasi 100% terjaga.</i>`,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({ inline_keyboard: [[{ text: "📸 Kembali ke PAP", callback_data: "menu_pap" }]] }),
      });
      return;
    } else if (!msg.photo && !msg.video) {
      await callAPI("sendMessage", { chat_id: chatId, text: "⚠️ Kirim <b>foto</b> atau <b>video</b>, bukan teks.", parse_mode: "HTML" });
      return;
    }
  }

  if (text.startsWith("/start")) {
    const tgUser = await storage.getTelegramUser(tgId);
    if (!tgUser?.gender) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          `🔞 <b>Selamat datang di BigPekob!</b>${firstName ? ` Halo ${firstName}!` : ""}\n\nVideo indo viral 18+ 🔥\n\nSebelum mulai, pilih jenis kelamin kamu:`,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[
            { text: "👨 Laki-laki", callback_data: "set_gender_male" },
            { text: "👩 Perempuan", callback_data: "set_gender_female" },
          ]],
        }),
      });
    } else {
      await sendMainMenu(chatId, firstName);
    }
    return;
  }

  if (text.startsWith("/vip")) { await sendVipInfo(chatId, tgId); return; }
  if (text.startsWith("/pap")) { await sendPapMenu(chatId, tgId); return; }
  if (text.startsWith("/help")) { await sendHelp(chatId); return; }

  if (text.startsWith("/chatkechannel")) {
    awaitingChannelMsg.add(tgId);
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: "💬 <b>Kirim Pesan ke Channel BigPekob</b>\n\nTulis pesan kamu sekarang. Pesanmu dikirim anonim ke channel.",
      parse_mode: "HTML",
    });
    return;
  }

  if (text.startsWith("/setchannel")) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "Gunakan: <code>/setchannel @NamaChannel</code> atau <code>/setchannel -100xxxxxxxxxx</code>\n\nPastikan bot sudah jadi admin di channel.",
        parse_mode: "HTML",
      });
      return;
    }
    await storage.setChannelConfig(parts[1]);
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: `✅ Channel <b>${escHtml(parts[1])}</b> didaftarkan! Bot akan posting setiap jam.`,
      parse_mode: "HTML",
    });
    setTimeout(postToChannel, 3000);
    return;
  }

  if (text.startsWith("/postsekarang")) {
    await postToChannel();
    await callAPI("sendMessage", { chat_id: chatId, text: "✅ Posting dikirim ke channel." });
    return;
  }

  await sendMainMenu(chatId, firstName);
}
