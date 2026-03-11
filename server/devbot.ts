import { storage } from "./storage";

const TOKEN = process.env.TELEGRAM_DEV_BOT_TOKEN;
const MAIN_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_BOT_TOKEN = process.env.TELEGRAM_CHAT_BOT_TOKEN;
const DOMAIN = process.env.REPLIT_DOMAINS?.split(",")[0] || "";
const WEBHOOK_URL = `https://${DOMAIN}/api/devbot/webhook`;

const DEV_IDS = new Set<number>();

const awaitingAI = new Map<number, string[]>();

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function callAPI(method: string, params: Record<string, any> = {}) {
  if (!TOKEN) return { ok: false, description: "No dev bot token" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await res.json()) as any;
  } catch (err: any) {
    console.error(`[devbot] Error ${method}:`, err.message);
    return { ok: false };
  }
}

async function callBotAPI(token: string, method: string, params: Record<string, any> = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await res.json()) as any;
  } catch (err: any) {
    return { ok: false, description: err.message };
  }
}

async function sendDevMenu(chatId: number) {
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      "🛠️ <b>BigPekob Dev Panel</b>\n\n" +
      "Selamat datang di panel developer.\nPilih menu:",
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: "📊 Stats", callback_data: "dev_stats" }, { text: "🔧 Maintenance", callback_data: "dev_maintenance" }],
        [{ text: "🤖 Bot Status", callback_data: "dev_botstatus" }, { text: "📢 Broadcast", callback_data: "dev_broadcast" }],
        [{ text: "🧠 Chat AI", callback_data: "dev_ai" }, { text: "🔄 Restart Bots", callback_data: "dev_restart" }],
        [{ text: "📋 Recent Logs", callback_data: "dev_logs" }],
      ],
    }),
  });
}

async function showStats(chatId: number) {
  const stats = await storage.getStats();
  const maintenance = await storage.getSetting("maintenance_mode");
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      "📊 <b>BigPekob Stats</b>\n\n" +
      `👤 Users: <b>${stats.userCount}</b>\n` +
      `🎬 Videos: <b>${stats.videoCount}</b>\n` +
      `🌟 VIP Aktif: <b>${stats.vipCount}</b>\n` +
      `🔧 Maintenance: <b>${maintenance === "true" ? "ON ⛔" : "OFF ✅"}</b>\n` +
      `🌐 Domain: <code>${escHtml(DOMAIN)}</code>`,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
    }),
  });
}

async function toggleMaintenance(chatId: number) {
  const current = await storage.getSetting("maintenance_mode");
  const isOn = current === "true";
  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      `🔧 <b>Maintenance Mode</b>\n\n` +
      `Status saat ini: <b>${isOn ? "ON ⛔" : "OFF ✅"}</b>\n\n` +
      `Pilih aksi:`,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: isOn ? "✅ Matikan Maintenance" : "⛔ Aktifkan Maintenance", callback_data: isOn ? "dev_maint_off" : "dev_maint_on" },
        ],
        [{ text: "✏️ Ubah Pesan Maintenance", callback_data: "dev_maint_msg" }],
        [{ text: "🔙 Menu", callback_data: "dev_menu" }],
      ],
    }),
  });
}

async function showBotStatus(chatId: number) {
  let mainStatus = "❓ Unknown";
  let chatStatus = "❓ Unknown";

  if (MAIN_BOT_TOKEN) {
    const info = await callBotAPI(MAIN_BOT_TOKEN, "getWebhookInfo");
    if (info.ok) {
      const wh = info.result;
      mainStatus = wh.url ? `✅ Webhook: ${wh.pending_update_count || 0} pending` : "⚠️ No webhook set";
      if (wh.last_error_message) mainStatus += `\n⚠️ Error: ${escHtml(wh.last_error_message)}`;
    }
  }

  if (CHAT_BOT_TOKEN) {
    const info = await callBotAPI(CHAT_BOT_TOKEN, "getWebhookInfo");
    if (info.ok) {
      const wh = info.result;
      chatStatus = wh.url ? `✅ Webhook: ${wh.pending_update_count || 0} pending` : "⚠️ No webhook set";
      if (wh.last_error_message) chatStatus += `\n⚠️ Error: ${escHtml(wh.last_error_message)}`;
    }
  }

  await callAPI("sendMessage", {
    chat_id: chatId,
    text:
      "🤖 <b>Bot Status</b>\n\n" +
      `<b>@bigpekob_bot:</b>\n${mainStatus}\n\n` +
      `<b>@bigpekob_chat_bot:</b>\n${chatStatus}`,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
    }),
  });
}

async function restartBots(chatId: number) {
  const results: string[] = [];

  if (MAIN_BOT_TOKEN) {
    const mainWh = `https://${DOMAIN}/api/telegram/webhook`;
    const r = await callBotAPI(MAIN_BOT_TOKEN, "setWebhook", { url: mainWh, drop_pending_updates: true });
    results.push(`@bigpekob_bot: ${r.ok ? "✅ Webhook reset" : "❌ " + (r.description || "Failed")}`);
  }

  if (CHAT_BOT_TOKEN) {
    const chatWh = `https://${DOMAIN}/api/chatbot/webhook`;
    const r = await callBotAPI(CHAT_BOT_TOKEN, "setWebhook", { url: chatWh, drop_pending_updates: true });
    results.push(`@bigpekob_chat_bot: ${r.ok ? "✅ Webhook reset" : "❌ " + (r.description || "Failed")}`);
  }

  await callAPI("sendMessage", {
    chat_id: chatId,
    text: "🔄 <b>Bot Restart</b>\n\n" + results.join("\n"),
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
    }),
  });
}

const awaitingMaintMsg = new Set<number>();
const awaitingBroadcast = new Set<number>();

export async function handleDevBotUpdate(update: any) {
  if (!TOKEN) return;

  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const tgId = msg.from?.id;
    const text = msg.text?.trim() || "";

    if (text === "/start" || text === "/menu") {
      DEV_IDS.add(tgId);
      await sendDevMenu(chatId);
      return;
    }

    if (text === "/stats") {
      await showStats(chatId);
      return;
    }

    if (text === "/maintenance") {
      await toggleMaintenance(chatId);
      return;
    }

    if (text === "/botstatus") {
      await showBotStatus(chatId);
      return;
    }

    if (text === "/restart") {
      await restartBots(chatId);
      return;
    }

    if (awaitingMaintMsg.has(tgId)) {
      awaitingMaintMsg.delete(tgId);
      await storage.setSetting("maintenance_message", text);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: `✅ Pesan maintenance diubah:\n\n<i>${escHtml(text)}</i>`,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
        }),
      });
      return;
    }

    if (awaitingBroadcast.has(tgId)) {
      awaitingBroadcast.delete(tgId);
      if (MAIN_BOT_TOKEN) {
        await callAPI("sendMessage", {
          chat_id: chatId,
          text: "📢 Broadcast dikirim ke main bot (fitur akan dikirim ke semua user yang pernah /start).",
          parse_mode: "HTML",
        });
      }
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: `✅ Pesan broadcast:\n\n<i>${escHtml(text)}</i>`,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
        }),
      });
      return;
    }

    if (awaitingAI.has(tgId)) {
      const history = awaitingAI.get(tgId)!;
      history.push(`User: ${text}`);
      
      await callAPI("sendChatAction", { chat_id: chatId, action: "typing" });

      const systemPrompt = `You are BigPekob Dev AI Assistant. You help developers debug and manage the BigPekob platform.
BigPekob is a TikTok-like adult video sharing platform (18+) built with React, Express, Drizzle ORM, PostgreSQL.
Features: Telegram Mini App (Feed/Upload/Profile), VIP via Telegram Stars (100 Stars = 30 days), video download for VIPs, PAP donation system, hourly channel promo posting.
Bots: @bigpekob_bot (main bot), @bigpekob_chat_bot (anonymous chat), dev bot (this one).
All Telegram messages use parse_mode: "HTML" (never Markdown).
Tech stack: server/routes.ts, server/telegram.ts, server/chatbot.ts, server/storage.ts, client/src/pages/telegram-miniapp.tsx, shared/schema.ts.
Answer in the same language as the user. Be concise and helpful.`;

      const aiPrompt = systemPrompt + "\n\nConversation:\n" + history.join("\n") + "\n\nAssistant:";
      
      let answer = "Maaf, AI sedang tidak tersedia. Coba lagi nanti.";
      try {
        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            messages: [
              { role: "system", content: systemPrompt },
              ...history.map((h, i) => ({ role: i % 2 === 0 ? "user" as const : "assistant" as const, content: h.replace(/^(User|Assistant): /, "") })),
            ],
            max_tokens: 1000,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json() as any;
          answer = aiData.choices?.[0]?.message?.content || answer;
          history.push(`Assistant: ${answer}`);
        }
      } catch {}

      if (answer.length > 4000) answer = answer.slice(0, 4000) + "...";

      await callAPI("sendMessage", {
        chat_id: chatId,
        text: `🧠 <b>AI:</b>\n\n${escHtml(answer)}`,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "❌ Akhiri Chat AI", callback_data: "dev_ai_stop" }],
          ],
        }),
      });
      return;
    }

    await sendDevMenu(chatId);
    return;
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    const tgId = cb.from?.id;
    const data = cb.data || "";

    await callAPI("answerCallbackQuery", { callback_query_id: cb.id });

    if (data === "dev_menu") {
      await sendDevMenu(chatId);
      return;
    }

    if (data === "dev_stats") {
      await showStats(chatId);
      return;
    }

    if (data === "dev_maintenance") {
      await toggleMaintenance(chatId);
      return;
    }

    if (data === "dev_maint_on") {
      await storage.setSetting("maintenance_mode", "true");
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "⛔ <b>Maintenance Mode: ON</b>\n\nWebsite sekarang dalam mode maintenance.",
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
        }),
      });
      return;
    }

    if (data === "dev_maint_off") {
      await storage.setSetting("maintenance_mode", "false");
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "✅ <b>Maintenance Mode: OFF</b>\n\nWebsite kembali normal.",
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
        }),
      });
      return;
    }

    if (data === "dev_maint_msg") {
      awaitingMaintMsg.add(tgId);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "✏️ Ketik pesan maintenance baru:",
        parse_mode: "HTML",
      });
      return;
    }

    if (data === "dev_botstatus") {
      await showBotStatus(chatId);
      return;
    }

    if (data === "dev_broadcast") {
      awaitingBroadcast.add(tgId);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "📢 Ketik pesan broadcast yang akan dikirim:",
        parse_mode: "HTML",
      });
      return;
    }

    if (data === "dev_ai") {
      awaitingAI.set(tgId, []);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text:
          "🧠 <b>AI Developer Assistant</b>\n\n" +
          "Kamu sekarang chat dengan AI.\n" +
          "Tanyakan apapun tentang bot, error, atau konfigurasi BigPekob.\n\n" +
          "Ketik pertanyaanmu:",
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "❌ Akhiri Chat AI", callback_data: "dev_ai_stop" }]],
        }),
      });
      return;
    }

    if (data === "dev_ai_stop") {
      awaitingAI.delete(tgId);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "✅ Chat AI diakhiri.",
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
        }),
      });
      return;
    }

    if (data === "dev_restart") {
      await restartBots(chatId);
      return;
    }

    if (data === "dev_logs") {
      const botInfo = [];
      if (MAIN_BOT_TOKEN) {
        const wh = await callBotAPI(MAIN_BOT_TOKEN, "getWebhookInfo");
        if (wh.ok && wh.result.last_error_message) {
          botInfo.push(`⚠️ <b>@bigpekob_bot error:</b>\n${escHtml(wh.result.last_error_message)}\n(${wh.result.last_error_date ? new Date(wh.result.last_error_date * 1000).toLocaleString() : "unknown"})`);
        }
      }
      if (CHAT_BOT_TOKEN) {
        const wh = await callBotAPI(CHAT_BOT_TOKEN, "getWebhookInfo");
        if (wh.ok && wh.result.last_error_message) {
          botInfo.push(`⚠️ <b>@bigpekob_chat_bot error:</b>\n${escHtml(wh.result.last_error_message)}\n(${wh.result.last_error_date ? new Date(wh.result.last_error_date * 1000).toLocaleString() : "unknown"})`);
        }
      }

      const text = botInfo.length > 0
        ? "📋 <b>Recent Bot Errors:</b>\n\n" + botInfo.join("\n\n")
        : "📋 <b>Logs:</b>\n\n✅ Tidak ada error terbaru di webhook bots.";

      await callAPI("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "🔙 Menu", callback_data: "dev_menu" }]],
        }),
      });
      return;
    }
  }
}

export async function setupDevBot() {
  if (!TOKEN) {
    console.log("[devbot] No TELEGRAM_DEV_BOT_TOKEN set, skipping dev bot setup");
    return;
  }

  await callAPI("setWebhook", { url: WEBHOOK_URL, drop_pending_updates: true });
  await callAPI("setMyCommands", {
    commands: [
      { command: "start", description: "Menu utama dev panel" },
      { command: "menu", description: "Menu utama" },
      { command: "stats", description: "Lihat statistik" },
      { command: "maintenance", description: "Toggle maintenance mode" },
      { command: "botstatus", description: "Cek status semua bot" },
      { command: "restart", description: "Restart webhook bots" },
    ],
  });

  console.log(`[devbot] Webhook set: ${WEBHOOK_URL}`);
}
