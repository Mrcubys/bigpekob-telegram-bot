/**
 * @bigpekob_chat_bot — Bot Chat Anonim Multi-Bahasa
 * Fitur: pilih bahasa dulu, VIP-only gender matching, daily 100-search limit
 * Links: https://t.me/bigpekob_bot | https://t.me/bigpekob_chat_bot
 */
import { pool } from "./db";

const TOKEN = process.env.TELEGRAM_CHAT_BOT_TOKEN!;
const DOMAIN = process.env.REPLIT_DOMAINS?.split(",")[0] || "";
const WEBHOOK_URL = `https://${DOMAIN}/api/chatbot/webhook`;
const BP_BOT = "https://t.me/bigpekob_bot";
const CHAT_BOT = "https://t.me/bigpekob_chat_bot";
const DAILY_LIMIT = 100;

// ─── In-memory matching queues ────────────────────────────────────────────────
// any = non-VIP / VIP tanpa gender preference
// male = VIP male menunggu dicocokan oleh yang ingin male
// female = VIP female menunggu dicocokan oleh yang ingin female
const waitQ: Record<string, number[]> = { any: [], male: [], female: [] };

// Active pairs: telegramId ↔ partnerTelegramId
const pairs: Map<number, number> = new Map();

// ─── Languages ────────────────────────────────────────────────────────────────
type L = "id" | "en" | "ar" | "jp" | "kr" | "fr";

const LANGS: Record<L, string> = {
  id: "🇮🇩 Bahasa Indonesia",
  en: "🇬🇧 English",
  ar: "🇸🇦 العربية",
  jp: "🇯🇵 日本語",
  kr: "🇰🇷 한국어",
  fr: "🇫🇷 Français",
};

const T: Record<string, Record<L, string | ((a: any, b?: any, c?: any) => string)>> = {
  selectLang: {
    id: "🌐 *Pilih bahasa kamu:*",
    en: "🌐 *Choose your language:*",
    ar: "🌐 *اختر لغتك:*",
    jp: "🌐 *言語を選んでください：*",
    kr: "🌐 *언어를 선택하세요:*",
    fr: "🌐 *Choisissez votre langue :*",
  },
  welcome: {
    id: (n: string) => `👥 *BigPekob Chat*${n ? ` — Halo ${n}!` : ""}\n\n🎭 Chat anonim dengan stranger 18+\n🔒 Identitas kamu 100% terjaga\n📊 Limit pencarian: 100x/hari`,
    en: (n: string) => `👥 *BigPekob Chat*${n ? ` — Hi ${n}!` : ""}\n\n🎭 Anonymous chat with strangers 18+\n🔒 Your identity is 100% private\n📊 Search limit: 100x/day`,
    ar: (n: string) => `👥 *BigPekob Chat*${n ? ` — مرحباً ${n}!` : ""}\n\n🎭 دردشة مجهولة +18\n🔒 هويتك محمية 100%\n📊 حد البحث: 100/يوم`,
    jp: (n: string) => `👥 *BigPekob Chat*${n ? ` — こんにちは ${n}！` : ""}\n\n🎭 18歳以上の匿名チャット\n🔒 身元は100%秘密\n📊 検索制限: 100回/日`,
    kr: (n: string) => `👥 *BigPekob Chat*${n ? ` — 안녕하세요 ${n}!` : ""}\n\n🎭 18+ 익명 채팅\n🔒 신원 100% 보호\n📊 검색 한도: 100회/일`,
    fr: (n: string) => `👥 *BigPekob Chat*${n ? ` — Bonjour ${n} !` : ""}\n\n🎭 Chat anonyme 18+\n🔒 Identité 100% protégée\n📊 Limite de recherche : 100x/jour`,
  },
  btnSearch: { id: "🔍 Cari Pasangan", en: "🔍 Find Partner", ar: "🔍 بحث عن شريك", jp: "🔍 パートナー探す", kr: "🔍 파트너 찾기", fr: "🔍 Trouver" },
  btnProfile: { id: "⚙️ Profil", en: "⚙️ Profile", ar: "⚙️ الملف الشخصي", jp: "⚙️ プロフィール", kr: "⚙️ 프로필", fr: "⚙️ Profil" },
  btnVip: { id: "🌟 Info VIP", en: "🌟 VIP Info", ar: "🌟 معلومات VIP", jp: "🌟 VIP情報", kr: "🌟 VIP 정보", fr: "🌟 Info VIP" },
  btnStop: { id: "⏹ Stop Chat", en: "⏹ Stop Chat", ar: "⏹ إيقاف الدردشة", jp: "⏹ チャット終了", kr: "⏹ 채팅 중지", fr: "⏹ Stop Chat" },
  btnFindAgain: { id: "🔍 Cari Lagi", en: "🔍 Find Again", ar: "🔍 بحث مجدداً", jp: "🔍 再度探す", kr: "🔍 다시 찾기", fr: "🔍 Chercher encore" },
  btnChangeLang: { id: "🌐 Ganti Bahasa", en: "🌐 Change Language", ar: "🌐 تغيير اللغة", jp: "🌐 言語変更", kr: "🌐 언어 변경", fr: "🌐 Changer langue" },
  searching: {
    id: (r: number) => `⏳ *Sedang mencari pasangan...*\n\nTunggu sebentar ya! Sisa pencarian hari ini: *${r}x*\n\nKetik /stop untuk berhenti.`,
    en: (r: number) => `⏳ *Searching for a partner...*\n\nPlease wait! Searches left today: *${r}x*\n\nType /stop to cancel.`,
    ar: (r: number) => `⏳ *جارٍ البحث عن شريك...*\n\nانتظر قليلاً! متبقٍّ اليوم: *${r}x*\n\nاكتب /stop للإلغاء.`,
    jp: (r: number) => `⏳ *パートナーを検索中...*\n\n本日の残り検索: *${r}回*\n\n/stopでキャンセル。`,
    kr: (r: number) => `⏳ *파트너를 찾는 중...*\n\n오늘 남은 검색: *${r}회*\n\n/stop으로 취소.`,
    fr: (r: number) => `⏳ *Recherche d'un partenaire...*\n\nRecherches restantes aujourd'hui : *${r}x*\n\nTapez /stop pour annuler.`,
  },
  partnerFound: {
    id: "✅ *Pasangan ditemukan!* 🎉\n\n🎭 Terhubung dengan stranger anonim.\n🔒 Identitas 100% rahasia.\n\nMulai ngobrol! /stop untuk akhiri.",
    en: "✅ *Partner found!* 🎉\n\n🎭 Connected with an anonymous stranger.\n🔒 Identities 100% secret.\n\nStart chatting! /stop to end.",
    ar: "✅ *تم العثور على شريك!* 🎉\n\n🎭 متصل مع شخص مجهول.\n🔒 الهوية محمية 100%.\n\nابدأ الدردشة! /stop للإنهاء.",
    jp: "✅ *パートナーが見つかりました！* 🎉\n\n🎭 匿名の見知らぬ人と接続。\n🔒 身元100%秘密。\n\nチャット開始！/stopで終了。",
    kr: "✅ *파트너를 찾았습니다!* 🎉\n\n🎭 익명의 낯선 사람과 연결됨.\n🔒 신원 100% 비밀.\n\n채팅 시작! /stop으로 종료.",
    fr: "✅ *Partenaire trouvé !* 🎉\n\n🎭 Connecté avec un inconnu anonyme.\n🔒 Identités 100% secrètes.\n\nCommencez ! /stop pour terminer.",
  },
  limitReached: {
    id: `⛔ *Limit harian tercapai!*\n\nKamu sudah 100x mencari hari ini. Coba lagi besok!\n\n🌟 _Upgrade VIP di @bigpekob_bot untuk akses lebih!_`,
    en: `⛔ *Daily limit reached!*\n\nYou've done 100 searches today. Try again tomorrow!\n\n🌟 _Upgrade VIP at @bigpekob_bot for more!_`,
    ar: `⛔ *تم الوصول إلى الحد اليومي!*\n\n100 بحث اليوم. حاول غداً!\n\n🌟 _رقّ إلى VIP في @bigpekob_bot!_`,
    jp: `⛔ *1日の上限に達しました！*\n\n本日100回の検索を行いました。明日また！\n\n🌟 _@bigpekob_botでVIPにアップグレード！_`,
    kr: `⛔ *일일 한도 도달!*\n\n오늘 100회 검색했습니다. 내일 다시!\n\n🌟 _@bigpekob_bot에서 VIP 업그레이드!_`,
    fr: `⛔ *Limite quotidienne atteinte !*\n\n100 recherches aujourd'hui. Réessayez demain !\n\n🌟 _Passez VIP sur @bigpekob_bot !_`,
  },
  alreadyInChat: {
    id: "❌ Kamu sedang dalam chat. Ketik /stop dulu.",
    en: "❌ You're in a chat. Type /stop first.",
    ar: "❌ أنت في دردشة. اكتب /stop أولاً.",
    jp: "❌ チャット中です。/stopで終了してください。",
    kr: "❌ 채팅 중입니다. 먼저 /stop.",
    fr: "❌ Vous êtes dans un chat. Tapez /stop d'abord.",
  },
  notInChat: {
    id: "ℹ️ Kamu tidak sedang dalam chat.",
    en: "ℹ️ You're not in a chat.",
    ar: "ℹ️ لست في دردشة.",
    jp: "ℹ️ チャット中ではありません。",
    kr: "ℹ️ 채팅 중이 아닙니다.",
    fr: "ℹ️ Vous n'êtes pas dans un chat.",
  },
  stillSearching: {
    id: "⏳ Masih mencari... /stop untuk berhenti.",
    en: "⏳ Still searching... /stop to cancel.",
    ar: "⏳ لا يزال يبحث... /stop للإلغاء.",
    jp: "⏳ まだ検索中... /stopでキャンセル。",
    kr: "⏳ 아직 검색 중... /stop으로 취소.",
    fr: "⏳ Toujours en recherche... /stop pour annuler.",
  },
  chatEnded: {
    id: "👋 *Chat diakhiri.*\n\nKetik /cari untuk chat dengan stranger baru! 😊",
    en: "👋 *Chat ended.*\n\nType /cari to chat with a new stranger! 😊",
    ar: "👋 *انتهت الدردشة.*\n\nاكتب /cari للدردشة مع شخص جديد! 😊",
    jp: "👋 *チャット終了。*\n\n/cariで新しい人とチャット！ 😊",
    kr: "👋 *채팅이 종료되었습니다.*\n\n/cari로 새 낯선 사람과 채팅! 😊",
    fr: "👋 *Chat terminé.*\n\nTapez /cari pour un nouvel inconnu ! 😊",
  },
  vipOnlyGender: {
    id: "⭐ Fitur gender matching khusus *VIP BigPekob*.\n\nUpgrade di @bigpekob_bot untuk pilih gender lawan chat!",
    en: "⭐ Gender matching is exclusive to *BigPekob VIP*.\n\nUpgrade at @bigpekob_bot to choose your partner's gender!",
    ar: "⭐ مطابقة الجنس حصرية لـ *BigPekob VIP*.\n\nرقّ في @bigpekob_bot لاختيار جنس شريكك!",
    jp: "⭐ 性別マッチングは *BigPekob VIP* 限定です。\n\n@bigpekob_botでVIPにアップグレードして性別を選びましょう！",
    kr: "⭐ 성별 매칭은 *BigPekob VIP* 전용입니다.\n\n@bigpekob_bot에서 업그레이드하여 상대방 성별을 선택하세요!",
    fr: "⭐ La correspondance de genre est exclusive à *BigPekob VIP*.\n\nUpgrade sur @bigpekob_bot pour choisir le genre de votre partenaire !",
  },
  setGenderPrompt: {
    id: "⚙️ *Pilih Gender Kamu (VIP)*\n\nGender ini menentukan siapa yang bisa kamu temui.\n\n👨 Laki-laki = akan dicocokkan dengan perempuan\n👩 Perempuan = akan dicocokkan dengan laki-laki",
    en: "⚙️ *Set Your Gender (VIP)*\n\nThis determines who you'll be matched with.\n\n👨 Male = matched with female\n👩 Female = matched with male",
    ar: "⚙️ *اختر جنسك (VIP)*\n\nهذا يحدد مع من ستتم مطابقتك.\n\n👨 ذكر = مطابقة مع أنثى\n👩 أنثى = مطابقة مع ذكر",
    jp: "⚙️ *性別を設定 (VIP)*\n\n相手の性別が決まります。\n\n👨 男性 = 女性とマッチング\n👩 女性 = 男性とマッチング",
    kr: "⚙️ *성별 설정 (VIP)*\n\n매칭 상대가 결정됩니다.\n\n👨 남성 = 여성과 매칭\n👩 여성 = 남성과 매칭",
    fr: "⚙️ *Définir votre genre (VIP)*\n\nCela détermine avec qui vous serez mis en relation.\n\n👨 Homme = mis en relation avec femme\n👩 Femme = mis en relation avec homme",
  },
  genderSetMale: {
    id: "✅ Gender: 👨 *Laki-laki*\n\nKamu akan dicocokkan dengan perempuan. /cari untuk mulai!",
    en: "✅ Gender: 👨 *Male*\n\nYou'll be matched with females. /cari to start!",
    ar: "✅ الجنس: 👨 *ذكر*\n\nستتم مطابقتك مع الإناث. /cari للبدء!",
    jp: "✅ 性別: 👨 *男性*\n\n女性とマッチングされます。/cariで開始！",
    kr: "✅ 성별: 👨 *남성*\n\n여성과 매칭됩니다. /cari로 시작!",
    fr: "✅ Genre: 👨 *Homme*\n\nVous serez mis en relation avec des femmes. /cari pour commencer !",
  },
  genderSetFemale: {
    id: "✅ Gender: 👩 *Perempuan*\n\nKamu akan dicocokkan dengan laki-laki. /cari untuk mulai!",
    en: "✅ Gender: 👩 *Female*\n\nYou'll be matched with males. /cari to start!",
    ar: "✅ الجنس: 👩 *أنثى*\n\nستتم مطابقتك مع الذكور. /cari للبدء!",
    jp: "✅ 性別: 👩 *女性*\n\n男性とマッチングされます。/cariで開始！",
    kr: "✅ 성별: 👩 *여성*\n\n남성과 매칭됩니다. /cari로 시작!",
    fr: "✅ Genre: 👩 *Femme*\n\nVous serez mis en relation avec des hommes. /cari pour commencer !",
  },
  genderReset: {
    id: "✅ Gender direset ke random. Kamu akan dicocokkan secara acak.",
    en: "✅ Gender reset to random. You'll be matched randomly.",
    ar: "✅ تم إعادة تعيين الجنس إلى عشوائي.",
    jp: "✅ 性別をランダムにリセットしました。",
    kr: "✅ 성별이 랜덤으로 초기화되었습니다.",
    fr: "✅ Genre réinitialisé en aléatoire.",
  },
  unsupportedMedia: {
    id: "⚠️ Jenis pesan ini belum didukung.",
    en: "⚠️ This message type isn't supported yet.",
    ar: "⚠️ نوع الرسالة هذا غير مدعوم.",
    jp: "⚠️ このメッセージタイプはサポートされていません。",
    kr: "⚠️ 이 메시지 유형은 지원되지 않습니다.",
    fr: "⚠️ Ce type de message n'est pas encore pris en charge.",
  },
};

// Template pesan saat partner pergi (dirotasi, kadang ada promo VIP)
const partnerLeftMsgs: Record<L, string[]> = {
  id: [
    "😢 *Yah, pasanganmu pergi...*\n\nStrangermu mengakhiri chat. Tapi jangan sedih, masih banyak stranger lain yang siap ngobrol sama kamu! 😊\n\n/cari untuk cari pasangan baru!",
    "💔 *Chat berakhir.*\n\nPasanganmu udah cabut nih. Siapa tau percakapan berikutnya lebih seru! Coba lagi yuk 🎉\n\n/cari untuk mulai lagi.",
    "👻 *Pasanganmu menghilang!*\n\nMisterius banget ya... 😄 Tapi tenang, masih banyak yang menunggumu!\n\n🌟 _Tip: Upgrade VIP di @bigpekob_bot untuk pilih gender lawan chat!_",
    "🚪 *Pasanganmu keluar dari chat.*\n\nEvery ending is a new beginning! Cari stranger baru dan siapa tau lebih cocok 😉\n\n/cari untuk coba lagi!",
    "✨ *Chat selesai!*\n\nJangan menyerah! Di luar sana banyak stranger menarik yang nunggu diajak ngobrol 🌟\n\nUpgrade VIP di @bigpekob_bot untuk matching lebih personal!",
  ],
  en: [
    "😢 *Your partner left...*\n\nYour stranger ended the chat. Don't be sad — many others are waiting for you! 😊\n\n/cari to find a new partner!",
    "💔 *Chat ended.*\n\nYour partner is gone. Maybe the next one will be more fun! 🎉\n\n/cari to try again.",
    "👻 *Your partner disappeared!*\n\nMystery! 😄 But there are plenty more out there!\n\n🌟 _Tip: Upgrade VIP at @bigpekob_bot to choose your partner's gender!_",
    "🚪 *Your partner left the chat.*\n\nEvery ending is a new beginning! 😉\n\n/cari to try again!",
    "✨ *Chat over!*\n\nDon't give up! Upgrade VIP at @bigpekob_bot for more personal matching! 🌟",
  ],
  ar: [
    "😢 *غادر شريكك...*\n\nأنهى شريكك الدردشة. لا تحزن — هناك الكثيرون ينتظرونك! 😊\n\n/cari للعثور على شريك جديد!",
    "💔 *انتهت الدردشة.*\n\nرحل شريكك. ربما القادم أكثر متعة! 🎉\n\n/cari للمحاولة مجدداً.",
    "👻 *اختفى شريكك!*\n\nغامض! 😄 لكن هناك الكثيرون في الخارج!\n\n🌟 _رقّ إلى VIP في @bigpekob_bot لاختيار الجنس!_",
    "🚪 *غادر شريكك الدردشة.*\n\nكل نهاية هي بداية جديدة! 😉\n\n/cari للمحاولة!",
    "✨ *الدردشة منتهية!*\n\n!رقّ VIP لمطابقة أفضل على @bigpekob_bot 🌟",
  ],
  jp: [
    "😢 *パートナーが去りました...*\n\nストレンジャーがチャットを終了しました。悲しまないで！ 😊\n\n/cariで新しいパートナーを！",
    "💔 *チャット終了。*\n\nパートナーが去りました。次はもっと楽しいかも！ 🎉\n\n/cariで再挑戦。",
    "👻 *パートナーが消えました！*\n\nミステリアス！ 😄 でも他にもたくさんいます！\n\n🌟 _ヒント: @bigpekob_botでVIPにアップグレードして性別を選ぼう！_",
    "🚪 *パートナーがチャットを去りました。*\n\nすべての終わりは新しい始まり！ 😉\n\n/cariで再試行！",
    "✨ *チャット終了！*\n\n@bigpekob_botでVIPにアップグレードして個人的なマッチングを！ 🌟",
  ],
  kr: [
    "😢 *파트너가 떠났습니다...*\n\n상대방이 채팅을 종료했습니다. 슬퍼하지 마세요! 😊\n\n/cari로 새 파트너를 찾으세요!",
    "💔 *채팅이 끝났습니다.*\n\n파트너가 떠났습니다. 다음엔 더 재밌을 거예요! 🎉\n\n/cari로 다시 시도.",
    "👻 *파트너가 사라졌습니다!*\n\n미스터리! 😄 하지만 다른 많은 분들이 기다리고 있어요!\n\n🌟 _팁: @bigpekob_bot에서 VIP로 성별 선택!_",
    "🚪 *파트너가 채팅을 떠났습니다.*\n\n모든 끝은 새로운 시작! 😉\n\n/cari로 다시 시도!",
    "✨ *채팅 종료!*\n\n@bigpekob_bot에서 VIP로 업그레이드하여 더 개인적인 매칭을! 🌟",
  ],
  fr: [
    "😢 *Votre partenaire est parti...*\n\nVotre inconnu a terminé le chat. Ne soyez pas triste ! 😊\n\n/cari pour trouver un nouveau partenaire !",
    "💔 *Chat terminé.*\n\nVotre partenaire est parti. Le prochain sera peut-être plus fun ! 🎉\n\n/cari pour réessayer.",
    "👻 *Votre partenaire a disparu !*\n\nMystérieux ! 😄 Mais il y en a plein d'autres !\n\n🌟 _Astuce : Passez VIP sur @bigpekob_bot pour choisir le genre !_",
    "🚪 *Votre partenaire a quitté le chat.*\n\nToute fin est un nouveau début ! 😉\n\n/cari pour réessayer !",
    "✨ *Chat terminé !*\n\nPassez VIP sur @bigpekob_bot pour un matching plus personnel ! 🌟",
  ],
};

let partnerLeftIdx = 0;

function getPartnerLeftMsg(lang: L): string {
  const msgs = partnerLeftMsgs[lang] || partnerLeftMsgs.id;
  return msgs[partnerLeftIdx++ % msgs.length];
}

// ─── Helper: get string from T ─────────────────────────────────────────────
function s(lang: L, key: string, arg?: any): string {
  const val = T[key]?.[lang] ?? T[key]?.["id"];
  if (typeof val === "function") return val(arg);
  return (val as string) || "";
}

// ─── Telegram API ──────────────────────────────────────────────────────────
async function callAPI(method: string, params: Record<string, any> = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as any;
    if (!data.ok) console.warn(`[chatbot] ${method} error:`, data.description);
    return data;
  } catch (err: any) {
    console.error(`[chatbot] ${method} exception:`, err.message);
    return { ok: false };
  }
}

// ─── DB helpers ────────────────────────────────────────────────────────────
async function getCBUser(tgId: number) {
  const r = await pool.query("SELECT * FROM chatbot_users WHERE telegram_id = $1", [tgId]);
  return r.rows[0] || null;
}

async function upsertCBUser(tgId: number, fields: Record<string, any> = {}) {
  const existing = await getCBUser(tgId);
  if (!existing) {
    await pool.query(
      "INSERT INTO chatbot_users (telegram_id, language) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [tgId, fields.language || "id"]
    );
  } else if (Object.keys(fields).length > 0) {
    const sets: string[] = [];
    const vals: any[] = [tgId];
    for (const [k, v] of Object.entries(fields)) {
      vals.push(v); sets.push(`${k} = $${vals.length}`);
    }
    if (sets.length > 0) {
      await pool.query(`UPDATE chatbot_users SET ${sets.join(", ")} WHERE telegram_id = $1`, vals);
    }
  }
  return getCBUser(tgId);
}

async function getUserLang(tgId: number): Promise<L> {
  const u = await getCBUser(tgId);
  return (u?.language as L) || "id";
}

async function checkDailyLimit(tgId: number): Promise<{ ok: boolean; remaining: number }> {
  const today = new Date().toISOString().split("T")[0];
  await pool.query(
    `INSERT INTO chat_daily_limits (telegram_id, search_date, search_count) VALUES ($1, $2, 0)
     ON CONFLICT (telegram_id, search_date) DO NOTHING`,
    [tgId, today]
  );
  const r = await pool.query(
    "SELECT search_count FROM chat_daily_limits WHERE telegram_id = $1 AND search_date = $2",
    [tgId, today]
  );
  const count = r.rows[0]?.search_count || 0;
  if (count >= DAILY_LIMIT) return { ok: false, remaining: 0 };
  await pool.query(
    "UPDATE chat_daily_limits SET search_count = search_count + 1 WHERE telegram_id = $1 AND search_date = $2",
    [tgId, today]
  );
  return { ok: true, remaining: DAILY_LIMIT - count - 1 };
}

async function isVip(tgId: number): Promise<boolean> {
  const r = await pool.query("SELECT expires_at FROM vip_users WHERE telegram_id = $1", [tgId]);
  const row = r.rows[0];
  if (!row) return false;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
  return true;
}

// ─── Queue helpers ─────────────────────────────────────────────────────────
function removeFromAllQueues(tgId: number) {
  for (const key of Object.keys(waitQ)) {
    const idx = waitQ[key].indexOf(tgId);
    if (idx !== -1) waitQ[key].splice(idx, 1);
  }
}

function isInAnyQueue(tgId: number): boolean {
  return Object.values(waitQ).some((q) => q.includes(tgId));
}

// ─── Forward messages between paired users ─────────────────────────────────
async function forwardToPartner(fromId: number, msg: any): Promise<boolean> {
  const partnerId = pairs.get(fromId);
  if (!partnerId) return false;
  if (msg.text) {
    await callAPI("sendMessage", { chat_id: partnerId, text: msg.text });
  } else if (msg.photo?.length) {
    await callAPI("sendPhoto", { chat_id: partnerId, photo: msg.photo[msg.photo.length - 1].file_id, caption: msg.caption || "" });
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
    return false;
  }
  return true;
}

// ─── Stop chat ─────────────────────────────────────────────────────────────
async function stopChat(chatId: number, tgId: number, lang: L) {
  const partnerId = pairs.get(tgId);
  pairs.delete(tgId);
  removeFromAllQueues(tgId);

  if (partnerId) {
    pairs.delete(partnerId);
    const partnerLang = await getUserLang(partnerId);
    await callAPI("sendMessage", {
      chat_id: partnerId,
      text: getPartnerLeftMsg(partnerLang),
      parse_mode: "Markdown",
      reply_markup: JSON.stringify({
        keyboard: [[{ text: s(partnerLang, "btnFindAgain") }], [{ text: s(partnerLang, "btnProfile") }, { text: s(partnerLang, "btnVip") }]],
        resize_keyboard: true,
      }),
    });
  }

  await callAPI("sendMessage", {
    chat_id: chatId,
    text: s(lang, "chatEnded"),
    parse_mode: "Markdown",
    reply_markup: mainMenuKb(lang),
  });
}

// ─── Search for partner ────────────────────────────────────────────────────
async function searchPartner(chatId: number, tgId: number) {
  const limit = await checkDailyLimit(tgId);
  const lang = await getUserLang(tgId);

  if (!limit.ok) {
    await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "limitReached"), parse_mode: "Markdown" });
    return;
  }

  removeFromAllQueues(tgId);

  const vipUser = await isVip(tgId);
  const cbUser = await getCBUser(tgId);
  const myGender: string | null = vipUser ? (cbUser?.gender || null) : null;

  let partnerId: number | null = null;
  let myQueue = "any";

  if (vipUser && myGender) {
    // VIP with gender: look for opposite gender, or anyone in "any" queue
    const oppositeQ = myGender === "male" ? "female" : "male";
    myQueue = myGender;

    // Look in opposite gender queue
    const oppQ = waitQ[oppositeQ];
    if (oppQ.length > 0) {
      const idx = oppQ.findIndex((id) => id !== tgId);
      if (idx !== -1) {
        partnerId = oppQ.splice(idx, 1)[0];
      }
    }

    // Fallback: look in "any" queue
    if (!partnerId) {
      const anyQ = waitQ.any;
      const idx = anyQ.findIndex((id) => id !== tgId);
      if (idx !== -1) {
        partnerId = anyQ.splice(idx, 1)[0];
      }
    }
  } else {
    // Non-VIP or VIP without gender: look in "any" queue
    myQueue = "any";
    const anyQ = waitQ.any;
    const idx = anyQ.findIndex((id) => id !== tgId);
    if (idx !== -1) {
      partnerId = anyQ.splice(idx, 1)[0];
    }
    // Also check gender queues for diversity
    if (!partnerId) {
      for (const qKey of ["male", "female"]) {
        const q = waitQ[qKey];
        const i = q.findIndex((id) => id !== tgId);
        if (i !== -1) { partnerId = q.splice(i, 1)[0]; break; }
      }
    }
  }

  if (partnerId && partnerId !== tgId) {
    // Match found!
    pairs.set(tgId, partnerId);
    pairs.set(partnerId, tgId);

    const partnerLang = await getUserLang(partnerId);

    await callAPI("sendMessage", {
      chat_id: chatId,
      text: s(lang, "partnerFound"),
      parse_mode: "Markdown",
      reply_markup: JSON.stringify({
        keyboard: [[{ text: s(lang, "btnStop") }]],
        resize_keyboard: true,
      }),
    });
    await callAPI("sendMessage", {
      chat_id: partnerId,
      text: s(partnerLang, "partnerFound"),
      parse_mode: "Markdown",
      reply_markup: JSON.stringify({
        keyboard: [[{ text: s(partnerLang, "btnStop") }]],
        resize_keyboard: true,
      }),
    });
  } else {
    // Add to queue
    if (!waitQ[myQueue].includes(tgId)) {
      waitQ[myQueue].push(tgId);
    }
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: (T.searching[lang] as (r: number) => string)(limit.remaining),
      parse_mode: "Markdown",
      reply_markup: JSON.stringify({
        keyboard: [[{ text: s(lang, "btnStop") }]],
        resize_keyboard: true,
      }),
    });
  }
}

// ─── Keyboards ─────────────────────────────────────────────────────────────
function mainMenuKb(lang: L) {
  return JSON.stringify({
    keyboard: [
      [{ text: s(lang, "btnSearch") }],
      [{ text: s(lang, "btnProfile") }, { text: s(lang, "btnVip") }],
    ],
    resize_keyboard: true,
  });
}

// ─── Send profile menu ─────────────────────────────────────────────────────
async function sendProfile(chatId: number, tgId: number, lang: L) {
  const u = await getCBUser(tgId);
  const vipUser = await isVip(tgId);
  const langName = LANGS[lang] || lang;
  const gender = u?.gender;

  let profileText = `⚙️ *${lang === "id" ? "Profil Kamu" : lang === "en" ? "Your Profile" : lang === "ar" ? "ملفك الشخصي" : lang === "jp" ? "プロフィール" : lang === "kr" ? "내 프로필" : "Votre Profil"}*\n\n`;
  profileText += `${lang === "id" ? "Bahasa" : lang === "en" ? "Language" : lang === "ar" ? "اللغة" : lang === "jp" ? "言語" : lang === "kr" ? "언어" : "Langue"}: ${langName}\n`;
  profileText += `Status: ${vipUser ? "🌟 VIP" : "🆓 Free"}\n`;
  if (vipUser && gender) {
    profileText += `Gender: ${gender === "male" ? "👨" : "👩"} ${lang === "id" ? (gender === "male" ? "Laki-laki" : "Perempuan") : lang === "en" ? (gender === "male" ? "Male" : "Female") : lang === "ar" ? (gender === "male" ? "ذكر" : "أنثى") : lang === "jp" ? (gender === "male" ? "男性" : "女性") : lang === "kr" ? (gender === "male" ? "남성" : "여성") : (gender === "male" ? "Homme" : "Femme")}\n`;
  }

  const inlineKb: any[][] = [
    [
      { text: `${LANGS.id.split(" ")[0]} ID`, callback_data: "lang_id" },
      { text: `${LANGS.en.split(" ")[0]} EN`, callback_data: "lang_en" },
    ],
    [
      { text: `${LANGS.ar.split(" ")[0]} AR`, callback_data: "lang_ar" },
      { text: `${LANGS.jp.split(" ")[0]} JP`, callback_data: "lang_jp" },
      { text: `${LANGS.kr.split(" ")[0]} KR`, callback_data: "lang_kr" },
      { text: `${LANGS.fr.split(" ")[0]} FR`, callback_data: "lang_fr" },
    ],
  ];

  if (vipUser) {
    inlineKb.push([
      { text: "👨 Set Male (VIP)", callback_data: "gender_male" },
      { text: "👩 Set Female (VIP)", callback_data: "gender_female" },
    ]);
    inlineKb.push([{ text: "🎲 Random (reset gender)", callback_data: "gender_reset" }]);
  }

  await callAPI("sendMessage", {
    chat_id: chatId,
    text: profileText,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({ inline_keyboard: inlineKb }),
  });
}

// ─── Send VIP info ─────────────────────────────────────────────────────────
async function sendVipInfo(chatId: number, tgId: number, lang: L) {
  const vipUser = await isVip(tgId);
  const text = vipUser
    ? `🌟 *${lang === "id" ? "Kamu sudah VIP!" : lang === "en" ? "You're VIP!" : lang === "ar" ? "أنت VIP!" : lang === "jp" ? "VIPです！" : lang === "kr" ? "VIP입니다!" : "Vous êtes VIP !"}*\n\n✅ ${lang === "id" ? "Aktif:\n• Pilih gender lawan chat\n• Download video\n• PAP eksklusif" : lang === "en" ? "Active:\n• Choose chat partner's gender\n• Download videos\n• Exclusive PAP" : lang === "ar" ? "نشط:\n• اختيار جنس شريك الدردشة\n• تنزيل الفيديوهات\n• PAP حصري" : lang === "jp" ? "有効:\n• 相手の性別選択\n• 動画ダウンロード\n• PAP独占" : lang === "kr" ? "활성:\n• 채팅 상대 성별 선택\n• 동영상 다운로드\n• 독점 PAP" : "Actif :\n• Choisir le genre\n• Télécharger vidéos\n• PAP exclusif"}`
    : `🌟 *${lang === "id" ? "Upgrade VIP BigPekob!" : lang === "en" ? "Upgrade BigPekob VIP!" : lang === "ar" ? "رقّ إلى VIP!" : lang === "jp" ? "VIPにアップグレード！" : lang === "kr" ? "VIP 업그레이드!" : "Passez VIP !"}*\n\n✅ ${lang === "id" ? "Keuntungan:\n• 🔍 Pilih gender lawan chat\n• ⬇️ Download semua video\n• 📸 PAP eksklusif\n• 30 hari aktif\n\n💰 100 Telegram Stars\n\n👉 Upgrade: @bigpekob_bot → /vip" : lang === "en" ? "Benefits:\n• 🔍 Choose partner's gender\n• ⬇️ Download videos\n• 📸 Exclusive PAP\n• 30 days active\n\n💰 100 Telegram Stars\n\n👉 Upgrade: @bigpekob_bot → /vip" : lang === "ar" ? "الفوائد:\n• 🔍 اختيار الجنس\n• ⬇️ تنزيل الفيديوهات\n• 📸 PAP حصري\n• 30 يوماً\n\n💰 100 Telegram Stars\n\n👉 @bigpekob_bot → /vip" : lang === "jp" ? "特典:\n• 🔍 相手の性別選択\n• ⬇️ 動画ダウンロード\n• 📸 PAP独占\n• 30日間有効\n\n💰 100 Telegram Stars\n\n👉 @bigpekob_bot → /vip" : lang === "kr" ? "혜택:\n• 🔍 상대방 성별 선택\n• ⬇️ 동영상 다운로드\n• 📸 독점 PAP\n• 30일 활성\n\n💰 100 Telegram Stars\n\n👉 @bigpekob_bot → /vip" : "Avantages :\n• 🔍 Choisir le genre\n• ⬇️ Télécharger vidéos\n• 📸 PAP exclusif\n• 30 jours actif\n\n💰 100 Telegram Stars\n\n👉 @bigpekob_bot → /vip"}`;

  await callAPI("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: "🌟 Upgrade VIP", url: BP_BOT }]],
    }),
  });
}

// ─── Language selection keyboard ───────────────────────────────────────────
function langSelectionKb() {
  return JSON.stringify({
    inline_keyboard: [
      [{ text: "🇮🇩 Indonesia", callback_data: "lang_id" }, { text: "🇬🇧 English", callback_data: "lang_en" }],
      [{ text: "🇸🇦 العربية", callback_data: "lang_ar" }, { text: "🇯🇵 日本語", callback_data: "lang_jp" }],
      [{ text: "🇰🇷 한국어", callback_data: "lang_kr" }, { text: "🇫🇷 Français", callback_data: "lang_fr" }],
    ],
  });
}

// ─── Setup webhook ─────────────────────────────────────────────────────────
export async function setupChatBot() {
  if (!TOKEN) {
    console.warn("[chatbot] TELEGRAM_CHAT_BOT_TOKEN not set");
    return;
  }
  await callAPI("setWebhook", { url: WEBHOOK_URL, drop_pending_updates: true });
  await callAPI("setMyCommands", {
    commands: [
      { command: "start", description: "Mulai / Start" },
      { command: "cari", description: "🔍 Cari pasangan / Find partner" },
      { command: "stop", description: "⏹ Akhiri chat / End chat" },
      { command: "profil", description: "⚙️ Profil & pengaturan / Profile" },
      { command: "vip", description: "🌟 Info VIP" },
      { command: "bahasa", description: "🌐 Ganti bahasa / Change language" },
    ],
  });
  console.log(`[chatbot] Webhook set: ${WEBHOOK_URL}`);
}

// ─── Handle incoming updates ───────────────────────────────────────────────
export async function handleChatBotUpdate(body: any) {
  if (!TOKEN) return;

  // ── Callback query ────────────────────────────────────────────────────────
  if (body.callback_query) {
    const q = body.callback_query;
    const chatId: number = q.message.chat.id;
    const tgId: number = q.from.id;
    const data: string = q.data || "";

    await callAPI("answerCallbackQuery", { callback_query_id: q.id });
    await upsertCBUser(tgId);
    const lang = await getUserLang(tgId);

    // Language set
    if (data.startsWith("lang_")) {
      const newLang = data.replace("lang_", "") as L;
      await upsertCBUser(tgId, { language: newLang });
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: s(newLang, "welcome", q.from.first_name || ""),
        parse_mode: "Markdown",
        reply_markup: mainMenuKb(newLang),
      });
      return;
    }

    // Gender set (VIP only)
    if (data === "gender_male") {
      if (!(await isVip(tgId))) {
        await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "vipOnlyGender"), parse_mode: "Markdown" });
        return;
      }
      await upsertCBUser(tgId, { gender: "male" });
      await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "genderSetMale"), parse_mode: "Markdown" });
      return;
    }
    if (data === "gender_female") {
      if (!(await isVip(tgId))) {
        await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "vipOnlyGender"), parse_mode: "Markdown" });
        return;
      }
      await upsertCBUser(tgId, { gender: "female" });
      await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "genderSetFemale"), parse_mode: "Markdown" });
      return;
    }
    if (data === "gender_reset") {
      await pool.query("UPDATE chatbot_users SET gender = NULL WHERE telegram_id = $1", [tgId]);
      await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "genderReset"), parse_mode: "Markdown" });
      return;
    }
    return;
  }

  // ── Message ────────────────────────────────────────────────────────────────
  const msg = body.message || body.edited_message;
  if (!msg) return;

  const chatId: number = msg.chat.id;
  const tgId: number = msg.from?.id;
  const firstName: string = msg.from?.first_name || "";
  const rawText: string = msg.text || "";
  const isCmd = rawText.startsWith("/");

  if (!tgId) return;

  // Ensure user exists
  await upsertCBUser(tgId);
  const lang = await getUserLang(tgId);

  // ── If in active chat, forward message (unless it's a stop command) ────────
  if (pairs.has(tgId) && !isCmd && rawText !== s(lang, "btnStop")) {
    const forwarded = await forwardToPartner(tgId, msg);
    if (!forwarded) {
      await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "unsupportedMedia"), parse_mode: "Markdown" });
    }
    return;
  }

  // ── Stop command / button while in chat ────────────────────────────────────
  if (rawText === "/stop" || rawText === s(lang, "btnStop")) {
    if (pairs.has(tgId)) {
      await stopChat(chatId, tgId, lang);
    } else {
      removeFromAllQueues(tgId);
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: s(lang, "notInChat"),
        parse_mode: "Markdown",
        reply_markup: mainMenuKb(lang),
      });
    }
    return;
  }

  // ── /start command ─────────────────────────────────────────────────────────
  if (rawText.startsWith("/start")) {
    const u = await getCBUser(tgId);
    if (!u?.language) {
      // First time: ask language
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: "🌐 *BigPekob Chat*\n\nSelect your language / Pilih bahasa kamu:",
        parse_mode: "Markdown",
        reply_markup: langSelectionKb(),
      });
    } else {
      await callAPI("sendMessage", {
        chat_id: chatId,
        text: s(lang, "welcome", firstName),
        parse_mode: "Markdown",
        reply_markup: mainMenuKb(lang),
      });
    }
    return;
  }

  // ── /bahasa or profile language change ─────────────────────────────────────
  if (rawText === "/bahasa" || rawText === s(lang, "btnChangeLang")) {
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: "🌐 *Select Language / Pilih Bahasa:*",
      parse_mode: "Markdown",
      reply_markup: langSelectionKb(),
    });
    return;
  }

  // ── /cari command or search button ─────────────────────────────────────────
  if (rawText === "/cari" || rawText === s(lang, "btnSearch") || rawText === s(lang, "btnFindAgain")) {
    if (pairs.has(tgId)) {
      await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "alreadyInChat"), parse_mode: "Markdown" });
      return;
    }
    if (isInAnyQueue(tgId)) {
      await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "stillSearching"), parse_mode: "Markdown" });
      return;
    }
    await searchPartner(chatId, tgId);
    return;
  }

  // ── /profil ─────────────────────────────────────────────────────────────────
  if (rawText === "/profil" || rawText === s(lang, "btnProfile")) {
    await sendProfile(chatId, tgId, lang);
    return;
  }

  // ── /vip ────────────────────────────────────────────────────────────────────
  if (rawText === "/vip" || rawText === s(lang, "btnVip")) {
    await sendVipInfo(chatId, tgId, lang);
    return;
  }

  // ── First time user without language set ───────────────────────────────────
  const u = await getCBUser(tgId);
  if (!u?.language) {
    await callAPI("sendMessage", {
      chat_id: chatId,
      text: "🌐 *BigPekob Chat*\n\nSelect your language / Pilih bahasa kamu:",
      parse_mode: "Markdown",
      reply_markup: langSelectionKb(),
    });
    return;
  }

  // ── In queue, got a message ─────────────────────────────────────────────────
  if (isInAnyQueue(tgId)) {
    await callAPI("sendMessage", { chat_id: chatId, text: s(lang, "stillSearching"), parse_mode: "Markdown" });
    return;
  }

  // ── Default: show main menu ─────────────────────────────────────────────────
  await callAPI("sendMessage", {
    chat_id: chatId,
    text: s(lang, "welcome", firstName),
    parse_mode: "Markdown",
    reply_markup: mainMenuKb(lang),
  });
}
