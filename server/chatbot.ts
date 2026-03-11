/**
 * @bigpekob_chat_bot — Bot Anonymous Chat
 * Mirip dengan @anonymous_bot: pairing random user untuk chat anonim.
 * VIP: bisa pilih gender lawan chat.
 * Non-VIP: random (bisa dapat siapapun).
 * Limit: 100x cari pasangan per hari.
 */

import { pool } from "./db";

const TOKEN = process.env.TELEGRAM_CHAT_BOT_TOKEN!;
const DOMAIN = process.env.REPLIT_DOMAINS?.split(",")[0] || "";
const WEBHOOK_URL = `https://${DOMAIN}/api/chatbot/webhook`;
const BIGPEKOB_BOT = "bigpekob_bot";
const DAILY_SEARCH_LIMIT = 100;

// ─── In-memory state ──────────────────────────────────────────────────────────
// Antrian: gender → list telegramId yang sedang menunggu
const waitingQueue: Map<string, number[]> = new Map([
  ["male", []],
  ["female", []],
  ["any", []],
]);

// Pasangan aktif: telegramId ↔ partnerTelegramId
const activePairs: Map<number, number> = new Map();

// ─── Panggil Chatbot API ──────────────────────────────────────────────────────
async function callAPI(method: string, params: Record<string, any> = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json() as any;
    if (!data.ok) console.warn(`[chatbot] ${method} gagal:`, data.description);
    return data;
  } catch (err: any) {
    console.error(`[chatbot] Error ${method}:`, err.message);
    return { ok: false };
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getChatbotUser(telegramId: number) {
  const res = await pool.query(
    "SELECT * FROM chatbot_users WHERE telegram_id = $1",
    [telegramId]
  );
  return res.rows[0] || null;
}

async function upsertChatbotUser(telegramId: number, data: { gender?: string; preferred_gender?: string } = {}) {
  const existing = await getChatbotUser(telegramId);
  if (existing) {
    const sets: string[] = [];
    const vals: any[] = [telegramId];
    if (data.gender !== undefined) { vals.push(data.gender); sets.push(`gender = $${vals.length}`); }
    if (data.preferred_gender !== undefined) { vals.push(data.preferred_gender); sets.push(`preferred_gender = $${vals.length}`); }
    if (sets.length === 0) return existing;
    await pool.query(`UPDATE chatbot_users SET ${sets.join(", ")} WHERE telegram_id = $1`, vals);
  } else {
    await pool.query(
      "INSERT INTO chatbot_users (telegram_id, gender, preferred_gender) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING",
      [telegramId, data.gender || null, data.preferred_gender || null]
    );
  }
  return getChatbotUser(telegramId);
}

async function checkAndIncrementDailyLimit(telegramId: number): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split("T")[0];
  await pool.query(
    `INSERT INTO chat_daily_limits (telegram_id, search_date, search_count)
     VALUES ($1, $2, 0)
     ON CONFLICT (telegram_id, search_date) DO NOTHING`,
    [telegramId, today]
  );
  const res = await pool.query(
    "SELECT search_count FROM chat_daily_limits WHERE telegram_id = $1 AND search_date = $2",
    [telegramId, today]
  );
  const count = res.rows[0]?.search_count || 0;
  if (count >= DAILY_SEARCH_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  await pool.query(
    "UPDATE chat_daily_limits SET search_count = search_count + 1 WHERE telegram_id = $1 AND search_date = $2",
    [telegramId, today]
  );
  return { allowed: true, remaining: DAILY_SEARCH_LIMIT - count - 1 };
}

async function isVipUser(telegramId: number): Promise<boolean> {
  const res = await pool.query(
    "SELECT * FROM vip_users WHERE telegram_id = $1",
    [telegramId]
  );
  const row = res.rows[0];
  if (!row) return false;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
  return true;
}

// ─── Kirim pesan ke pasangan ──────────────────────────────────────────────────
async function forwardToPartner(fromId: number, msg: any) {
  const partnerId = activePairs.get(fromId);
  if (!partnerId) return false;

  // Forward berbagai jenis pesan
  if (msg.text) {
    await callAPI("sendMessage", { chat_id: partnerId, text: msg.text });
  } else if (msg.photo) {
    const photo = msg.photo[msg.photo.length - 1];
    await callAPI("sendPhoto", { chat_id: partnerId, photo: photo.file_id, caption: msg.caption || "" });
  } else if (msg.video) {
    await callAPI("sendVideo", { chat_id: partnerId, video: msg.video.file_id, caption: msg.caption || "" });
  } else if (msg.voice) {
    await callAPI("sendVoice", { chat_id: partnerId, voice: msg.voice.file_id });
  } else if (msg.audio) {
    await callAPI("sendAudio", { chat_id: partnerId, audio: msg.audio.file_id, caption: msg.caption || "" });
  } else if (msg.sticker) {
    await callAPI("sendSticker", { chat_id: partnerId, sticker: msg.sticker.file_id });
  } else if (msg.document) {
    await callAPI("sendDocument", { chat_id: partnerId, document: msg.document.file_id, caption: msg.caption || "" });
  } else {
    await callAPI("sendMessage", { chat_id: fromId, text: "⚠️ Jenis pesan ini tidak didukung." });
    return false;
  }
  return true;
}

// ─── Cari pasangan chat ───────────────────────────────────────────────────────
async function findPartner(chatId: number, telegramId: number): Promise<void> {
  // Cek limit harian
  const limit = await checkAndIncrementDailyLimit(telegramId);
  if (!limit.allowed) {
    await callAPI("sendMessage", {
      chat_id: chatId,
      text:
        "⛔ Kamu sudah mencapai batas harian *100x pencarian pasangan*.\n\n" +
        "Batas akan direset besok. Coba lagi besok ya! 😊\n\n" +
        `🌟 _Upgrade VIP di @${BIGPEKOB_BOT} untuk unlock fitur premium!_`,
      parse_mode: "Markdown",
    });
    return;
  }

  const cbUser = await getChatbotUser(telegramId);
  const isVip = await isVipUser(telegramId);
  const myGender = cbUser?.gender || "any";
  const preferredGender = isVip ? (cbUser?.preferred_gender || null) : null;

  // Hapus dari semua antrian terlebih dahulu
  removeFromQueue(telegramId);

  // Tentukan antrian yang dicari dan antrian sendiri
  const queueToSearch = preferredGender || "any";
  const myQueue = myGender;

  // Cari pasangan dari antrian
  let partnerId: number | null = null;

  if (preferredGender) {
    // VIP: cari dari gender tertentu
    const queue = waitingQueue.get(preferredGender) || [];
    if (queue.length > 0) {
      partnerId = queue.shift()!;
      waitingQueue.set(preferredGender, queue);
    } else {
      // Tidak ada di antrian spesifik, cek antrian "any"
      const anyQueue = waitingQueue.get("any") || [];
      if (anyQueue.length > 0) {
        partnerId = anyQueue.shift()!;
        waitingQueue.set("any", anyQueue);
      }
    }
  } else {
    // Non-VIP: cek semua antrian secara random
    const allQueues = ["male", "female", "any"];
    const shuffled = allQueues.sort(() => Math.random() - 0.5);
    for (const q of shuffled) {
      const queue = waitingQueue.get(q) || [];
      const idx = queue.findIndex((id) => id !== telegramId);
      if (idx !== -1) {
        partnerId = queue.splice(idx, 1)[0];
        waitingQueue.set(q, queue);
        break;
      }
    }
  }

  if (partnerId && partnerId !== telegramId) {
    // Pasangkan!
    activePairs.set(telegramId, partnerId);
    activePairs.set(partnerId, telegramId);

    await callAPI("sendMessage", {
      chat_id: chatId,
      text:
        "✅ *Pasangan ditemukan!*\n\n" +
        "Kamu sekarang terhubung dengan stranger secara anonim 🎭\n" +
        "Identitas kalian dijaga kerahasiaannya.\n\n" +
        "Ketik /stop untuk mengakhiri chat.",
      parse_mode: "Markdown",
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "⏹ Stop Chat" }], [{ text: "🔍 Cari Lagi" }]],
        resize_keyboard: true,
      }),
    });
    await callAPI("sendMessage", {
      chat_id: partnerId,
      text:
        "✅ *Pasangan ditemukan!*\n\n" +
        "Kamu sekarang terhubung dengan stranger secara anonim 🎭\n" +
        "Identitas kalian dijaga kerahasiaannya.\n\n" +
        "Ketik /stop untuk mengakhiri chat.",
      parse_mode: "Markdown",
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "⏹ Stop Chat" }], [{ text: "🔍 Cari Lagi" }]],
        resize_keyboard: true,
      }),
    });
  } else {
    // Masuk antrian tunggu
    const myQueueKey = myGender === "any" ? "any" : myGender;
    const currentQueue = waitingQueue.get(myQueueKey) || [];
    if (!currentQueue.includes(telegramId)) {
      currentQueue.push(telegramId);
      waitingQueue.set(myQueueKey, currentQueue);
    }

    await callAPI("sendMessage", {
      chat_id: chatId,
      text:
        "⏳ *Sedang mencari pasangan...*\n\n" +
        "Tunggu sebentar, kamu akan dipasangkan dengan stranger secara anonim.\n\n" +
        `📊 Sisa pencarian hari ini: *${limit.remaining}x*\n` +
        "Ketik /stop untuk berhenti mencari.",
      parse_mode: "Markdown",
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "⏹ Stop" }]],
        resize_keyboard: true,
      }),
    });
  }
}

function removeFromQueue(telegramId: number) {
  Array.from(waitingQueue.entries()).forEach(([key, queue]) => {
    const idx = queue.indexOf(telegramId);
    if (idx !== -1) {
      queue.splice(idx, 1);
      waitingQueue.set(key, queue);
    }
  });
}

async function stopChat(chatId: number, telegramId: number) {
  const partnerId = activePairs.get(telegramId);
  activePairs.delete(telegramId);
  removeFromQueue(telegramId);

  if (partnerId) {
    activePairs.delete(partnerId);
    await callAPI("sendMessage", {
      chat_id: partnerId,
      text:
        "👋 Pasangan kamu mengakhiri chat.\n\n" +
        "Ketik /cari untuk mencari pasangan baru!",
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "🔍 Cari Pasangan Baru" }]],
        resize_keyboard: true,
      }),
    });
  }

  await callAPI("sendMessage", {
    chat_id: chatId,
    text: "👋 Chat diakhiri.\n\nKetik /cari untuk mulai chat dengan stranger baru!",
    reply_markup: JSON.stringify({
      keyboard: [[{ text: "🔍 Cari Pasangan Baru" }]],
      resize_keyboard: true,
    }),
  });
}

// ─── Main menu ────────────────────────────────────────────────────────────────
async function sendMainMenu(chatId: number, firstName?: string) {
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      `👥 *BigPekob Chat* — Chat Anonim 18+\n\n` +
      (firstName ? `Halo *${firstName}*! ` : "") +
      `Chat dengan stranger secara anonim. Identitas kamu tidak akan diketahui!\n\n` +
      `🎭 _Semua percakapan 100% anonim_`,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      keyboard: [
        [{ text: "🔍 Cari Pasangan" }],
        [{ text: "⚙️ Profil & Pengaturan" }, { text: "🌟 Info VIP" }],
      ],
      resize_keyboard: true,
    }),
  });
}

async function sendProfileMenu(chatId: number, telegramId: number) {
  const cbUser = await getChatbotUser(telegramId);
  const isVip = await isVipUser(telegramId);
  const gender = cbUser?.gender || "belum diset";
  const prefGender = cbUser?.preferred_gender || "random";
  const genderLabel = gender === "male" ? "👨 Laki-laki" : gender === "female" ? "👩 Perempuan" : "❓ Belum diset";
  const prefLabel = prefGender === "male" ? "👨 Laki-laki" : prefGender === "female" ? "👩 Perempuan" : "🎲 Random (non-VIP)";

  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      `⚙️ *Profil Kamu:*\n\n` +
      `Gender: ${genderLabel}\n` +
      `${isVip ? `Preferensi gender chat: ${prefLabel} ✅ (VIP)` : `Preferensi gender: 🎲 Random (upgrade VIP untuk pilih)`}\n\n` +
      `${isVip ? "🌟 Status: *VIP*" : `Status: Free\n🌟 Upgrade VIP di @${BIGPEKOB_BOT} untuk pilih gender lawan chat!`}`,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: "👨 Set Gender: Laki-laki", callback_data: "set_gender_male" },
          { text: "👩 Set Gender: Perempuan", callback_data: "set_gender_female" },
        ],
        ...(isVip ? [
          [
            { text: "💬 Chat sama Laki-laki (VIP)", callback_data: "set_pref_male" },
            { text: "💬 Chat sama Perempuan (VIP)", callback_data: "set_pref_female" },
          ],
          [{ text: "🎲 Preferensi Random (VIP)", callback_data: "set_pref_any" }],
        ] : []),
      ],
    }),
  });
}

// ─── Setup chatbot webhook ─────────────────────────────────────────────────────
export async function setupChatBot() {
  if (!TOKEN) {
    console.warn("[chatbot] TELEGRAM_CHAT_BOT_TOKEN belum diset");
    return;
  }

  await callAPI("setWebhook", { url: WEBHOOK_URL, drop_pending_updates: true });

  await callAPI("setMyCommands", {
    commands: [
      { command: "start", description: "Mulai chat anonim" },
      { command: "cari", description: "🔍 Cari pasangan chat" },
      { command: "stop", description: "⏹ Akhiri chat saat ini" },
      { command: "profil", description: "⚙️ Lihat & atur profil kamu" },
      { command: "vip", description: "🌟 Info VIP & keuntungannya" },
    ],
  });

  await callAPI("setMyDescription", {
    description:
      "👥 BigPekob Chat — Chat anonim dengan stranger!\n\n" +
      "🎭 Identitas kamu 100% terjaga\n" +
      "🔍 Cari pasangan chat random\n" +
      "🌟 VIP: pilih gender lawan chat\n\n" +
      "⚠️ Khusus 18+",
  });

  await callAPI("setMyShortDescription", {
    short_description: "👥 Chat anonim 18+ — Ketemu stranger baru setiap saat!",
  });

  console.log(`[chatbot] Webhook aktif: ${WEBHOOK_URL}`);
}

// ─── Handle update ────────────────────────────────────────────────────────────
export async function handleChatBotUpdate(body: any) {
  if (!TOKEN) return;

  // Callback query
  if (body.callback_query) {
    const query = body.callback_query;
    const chatId: number = query.message.chat.id;
    const tgId: number = query.from.id;
    const data: string = query.data || "";

    await callAPI("answerCallbackQuery", { callback_query_id: query.id });
    await upsertChatbotUser(tgId);

    if (data === "set_gender_male") {
      await upsertChatbotUser(tgId, { gender: "male" });
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "✅ Gender kamu: 👨 *Laki-laki*",
        parse_mode: "Markdown",
      });
      await sendProfileMenu(chatId, tgId);
      return;
    }
    if (data === "set_gender_female") {
      await upsertChatbotUser(tgId, { gender: "female" });
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "✅ Gender kamu: 👩 *Perempuan*",
        parse_mode: "Markdown",
      });
      await sendProfileMenu(chatId, tgId);
      return;
    }
    if (data === "set_pref_male") {
      await upsertChatbotUser(tgId, { preferred_gender: "male" });
      await callAPI("sendMessage", { chat_id: chatId, text: "✅ Preferensi: akan dipasangkan dengan *Laki-laki*.", parse_mode: "Markdown" });
      return;
    }
    if (data === "set_pref_female") {
      await upsertChatbotUser(tgId, { preferred_gender: "female" });
      await callAPI("sendMessage", { chat_id: chatId, text: "✅ Preferensi: akan dipasangkan dengan *Perempuan*.", parse_mode: "Markdown" });
      return;
    }
    if (data === "set_pref_any") {
      await pool.query("UPDATE chatbot_users SET preferred_gender = NULL WHERE telegram_id = $1", [tgId]);
      await callAPI("sendMessage", { chat_id: chatId, text: "✅ Preferensi: *Random* (siapapun).", parse_mode: "Markdown" });
      return;
    }
    return;
  }

  const msg = body.message || body.edited_message;
  if (!msg) return;

  const chatId: number = msg.chat.id;
  const tgId: number = msg.from?.id;
  const firstName: string = msg.from?.first_name || "";
  const text: string = msg.text || "";

  if (!tgId) return;

  // Pastikan user ada di DB
  await upsertChatbotUser(tgId);

  // ── Jika sedang aktif chat → forward ke pasangan ─────────────────────────
  if (activePairs.has(tgId) && !text.startsWith("/") && text !== "⏹ Stop Chat") {
    const forwarded = await forwardToPartner(tgId, msg);
    if (!forwarded && text) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Gagal kirim pesan ke pasangan.",
      });
    }
    return;
  }

  // ── Commands & keyboard shortcuts ─────────────────────────────────────────
  if (text === "/start" || text === "📋 Menu") {
    // Cek apakah user sudah set gender
    const cbUser = await getChatbotUser(tgId);
    if (!cbUser?.gender) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          `👥 *Selamat datang di BigPekob Chat!* ${firstName ? `Halo ${firstName}!` : ""}\n\n` +
          `Chat anonim dengan stranger 18+.\n\n` +
          `Sebelum mulai, pilih gender kamu:`,
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
      return;
    }
    await sendMainMenu(chatId, firstName);
    return;
  }

  if (text === "/cari" || text === "🔍 Cari Pasangan" || text === "🔍 Cari Pasangan Baru") {
    if (activePairs.has(tgId)) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "❌ Kamu sedang dalam chat. Ketik /stop dulu untuk mengakhiri.",
      });
      return;
    }
    // Cek gender dulu
    const cbUser = await getChatbotUser(tgId);
    if (!cbUser?.gender) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Set gender kamu dulu sebelum mencari pasangan.",
        reply_markup: JSON.stringify({
          inline_keyboard: [[
            { text: "👨 Laki-laki", callback_data: "set_gender_male" },
            { text: "👩 Perempuan", callback_data: "set_gender_female" },
          ]],
        }),
      });
      return;
    }
    await findPartner(chatId, tgId);
    return;
  }

  if (text === "/stop" || text === "⏹ Stop Chat" || text === "⏹ Stop") {
    if (!activePairs.has(tgId)) {
      removeFromQueue(tgId);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "ℹ️ Kamu tidak sedang dalam chat.",
        reply_markup: JSON.stringify({
          keyboard: [[{ text: "🔍 Cari Pasangan" }], [{ text: "⚙️ Profil & Pengaturan" }, { text: "🌟 Info VIP" }]],
          resize_keyboard: true,
        }),
      });
      return;
    }
    await stopChat(chatId, tgId);
    return;
  }

  if (text === "/profil" || text === "⚙️ Profil & Pengaturan") {
    await sendProfileMenu(chatId, tgId);
    return;
  }

  if (text === "/vip" || text === "🌟 Info VIP") {
    const isVip = await isVipUser(tgId);
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: isVip
        ? "🌟 *Kamu sudah VIP!*\n\n✅ Keuntungan VIP:\n• Pilih gender lawan chat\n• Prioritas matching dengan VIP lain"
        : `🌟 *Upgrade ke VIP BigPekob!*\n\n✅ Keuntungan VIP di chat bot ini:\n• Pilih gender lawan chat (cowok/cewek)\n• VIP dipasangkan dengan VIP lain dulu\n\n💰 Cara upgrade: buka @${BIGPEKOB_BOT} dan gunakan perintah /vip`,
      parse_mode: "Markdown",
    });
    return;
  }

  // Jika sedang dalam antrian tunggu
  if (!activePairs.has(tgId)) {
    const isWaiting = Array.from(waitingQueue.values()).some((q: number[]) => q.includes(tgId));
    if (isWaiting) {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "⏳ Masih mencari pasangan... Ketik /stop untuk berhenti.",
      });
      return;
    }
    // Pesan biasa tapi tidak dalam chat
    await sendMainMenu(chatId, firstName);
    return;
  }
}
