const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('خطا: متغیر محیطی BOT_TOKEN تنظیم نشده.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// وضعیت هر چت: پیام در انتظار تنظیم بازه، یا تایمر فعال
// state[chatId] = { awaiting: true, payload: {...} } یا { intervalId, payload }
const state = {};

function describePayload(payload) {
  switch (payload.type) {
    case 'text': return 'متن';
    case 'photo': return 'عکس';
    case 'video': return 'ویدیو';
    case 'audio': return 'موزیک';
    case 'voice': return 'ویس';
    case 'document': return 'فایل';
    case 'animation': return 'گیف';
    case 'sticker': return 'استیکر';
    default: return 'پیام';
  }
}

function extractPayload(msg) {
  if (msg.text) return { type: 'text', text: msg.text };
  if (msg.photo) return { type: 'photo', fileId: msg.photo[msg.photo.length - 1].file_id, caption: msg.caption };
  if (msg.video) return { type: 'video', fileId: msg.video.file_id, caption: msg.caption };
  if (msg.audio) return { type: 'audio', fileId: msg.audio.file_id, caption: msg.caption };
  if (msg.voice) return { type: 'voice', fileId: msg.voice.file_id };
  if (msg.document) return { type: 'document', fileId: msg.document.file_id, caption: msg.caption };
  if (msg.animation) return { type: 'animation', fileId: msg.animation.file_id, caption: msg.caption };
  if (msg.sticker) return { type: 'sticker', fileId: msg.sticker.file_id };
  return null;
}

async function sendPayload(chatId, payload) {
  const opts = {
    reply_markup: {
      inline_keyboard: [[{ text: '🛑 توقف ارسال', callback_data: `stop_${chatId}` }]]
    }
  };
  switch (payload.type) {
    case 'text':
      return bot.sendMessage(chatId, payload.text, opts);
    case 'photo':
      return bot.sendPhoto(chatId, payload.fileId, { caption: payload.caption, ...opts });
    case 'video':
      return bot.sendVideo(chatId, payload.fileId, { caption: payload.caption, ...opts });
    case 'audio':
      return bot.sendAudio(chatId, payload.fileId, { caption: payload.caption, ...opts });
    case 'voice':
      return bot.sendVoice(chatId, payload.fileId, opts);
    case 'document':
      return bot.sendDocument(chatId, payload.fileId, { caption: payload.caption, ...opts });
    case 'animation':
      return bot.sendAnimation(chatId, payload.fileId, { caption: payload.caption, ...opts });
    case 'sticker':
      return bot.sendSticker(chatId, payload.fileId, opts);
  }
}

function clearSchedule(chatId) {
  const s = state[chatId];
  if (s && s.intervalId) {
    clearInterval(s.intervalId);
  }
  delete state[chatId];
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  clearSchedule(chatId);
  bot.sendMessage(chatId,
    'سلام! 👋\n' +
    'یه پیام برام بفرست (متن، عکس، موزیک، ویدیو یا هرچی)، بعد بهت میگم هر چند دقیقه یکبار برات همون پیام رو دوباره بفرستم.\n\n' +
    'برای لغو در هر مرحله: /cancel'
  );
});

bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  clearSchedule(chatId);
  bot.sendMessage(chatId, 'لغو شد. هر وقت خواستی یه پیام جدید بفرست.');
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text && !msg.photo && !msg.video && !msg.audio && !msg.voice && !msg.document && !msg.animation && !msg.sticker) return;
  if (msg.text && msg.text.startsWith('/')) return; // دستورات جدا هندل میشن

  const s = state[chatId];

  // حالت: منتظر عدد بازه هستیم
  if (s && s.awaiting) {
    const minutes = parseFloat(msg.text);
    if (!msg.text || isNaN(minutes) || minutes <= 0) {
      bot.sendMessage(chatId, 'لطفاً فقط یه عدد معتبر برای دقیقه بفرست (مثلاً 5).');
      return;
    }
    const payload = s.payload;
    const intervalMs = minutes * 60 * 1000;
    const intervalId = setInterval(() => sendPayload(chatId, payload), intervalMs);
    state[chatId] = { intervalId, payload };
    bot.sendMessage(chatId, `✅ باشه! از الان هر ${minutes} دقیقه یکبار این ${describePayload(payload)} رو برات می‌فرستم.`);
    sendPayload(chatId, payload);
    return;
  }

  // پیام جدید برای تنظیم
  const payload = extractPayload(msg);
  if (!payload) return;

  clearSchedule(chatId);
  state[chatId] = { awaiting: true, payload };
  bot.sendMessage(chatId, `${describePayload(payload)} رو گرفتم. هر چند دقیقه یکبار بفرستمش؟ (فقط عدد بفرست، مثلاً 5)`);
});

bot.on('callback_query', (query) => {
  const data = query.data || '';
  if (data.startsWith('stop_')) {
    const chatId = Number(data.split('_')[1]);
    clearSchedule(chatId);
    bot.answerCallbackQuery(query.id, { text: 'متوقف شد ✅' });
    bot.sendMessage(chatId, '🛑 ارسال تکراری متوقف شد. هر وقت خواستی یه پیام جدید بفرست.');
  }
});

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('ربات با موفقیت استارت شد و در حال گوش دادن به پیام‌هاست...');
