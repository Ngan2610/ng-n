export const hasSpeech =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export const LANGCODE = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN' };

/** Tìm giọng đọc của trình duyệt cho ngôn ngữ (vi | en | zh). */
export function voiceFor(lang) {
  if (!hasSpeech) return null;
  const list = window.speechSynthesis.getVoices();
  return list.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang)) || null;
}

export function voicesLoaded() {
  return hasSpeech && window.speechSynthesis.getVoices().length > 0;
}

/** { vi: bool, en: bool, zh: bool } — true nếu máy thật sự có giọng đọc cho ngôn ngữ đó.
 *  Trả về null khi danh sách giọng chưa tải xong (tránh khoá nhầm lúc mới vào trang). */
export function availableVoiceLangs() {
  if (!hasSpeech || !voicesLoaded()) return null;
  return { vi: !!voiceFor('vi'), en: !!voiceFor('en'), zh: !!voiceFor('zh') };
}

/** Ngôn ngữ đầu tiên (ưu tiên theo thứ tự truyền vào) có giọng đọc thật trên máy, hoặc 'off' nếu không có gì. */
export function firstAvailableVoice(preferred, order = ['vi', 'en', 'zh']) {
  if (preferred && voiceFor(preferred)) return preferred;
  const found = order.find((l) => voiceFor(l));
  return found || 'off';
}

// Giữ tham chiếu tới các câu đang chờ đọc — Chrome có lỗi tự thu gom bộ nhớ làm giọng đọc đứng giữa chừng.
let held = [];

// Tốc độ nói tự nhiên (ký tự/giây) ở rate 1, dùng để ước lượng câu đọc mất bao lâu.
const CPS = { vi: 14, en: 15, zh: 4.5 };

/** Chọn rate sao cho câu đọc vừa khung thời gian [start, end] của nó trong video (không nén quá 1.6×). */
export function fitRate(text, lang, seg, speed = 1) {
  if (!seg || seg.start == null || seg.end == null || seg.end <= seg.start) return speed;
  const natural = String(text).length / (CPS[lang] || 14);
  const need = natural / (seg.end - seg.start);
  return Math.min(1.6, Math.max(0.9, need)) * speed;
}

/** Một tốc độ đọc DUY NHẤT cho cả bài (thay vì mỗi câu một tốc độ khác nhau gây cảm giác giật cục).
 *  Tính theo tổng thời lượng lời nói trong video, giới hạn 0.9–1.25 để nghe vẫn tự nhiên. */
export function uniformRate(segments, lang, speed = 1) {
  let natural = 0;
  let slot = 0;
  for (const seg of segments || []) {
    if (seg.start == null || seg.end == null || seg.end <= seg.start || seg[lang] == null) continue;
    natural += String(seg[lang]).length / (CPS[lang] || 14);
    slot += seg.end - seg.start;
  }
  if (!slot) return speed;
  return Math.min(1.25, Math.max(0.9, natural / slot)) * speed;
}

/** Đọc liền mạch một dãy câu: xếp hàng tất cả ngay từ đầu, không câu nào bị cắt ngang khi sang câu kế.
 *  onStart(k) báo câu thứ k (trong items) bắt đầu được đọc. */
export function speakQueue(items, { lang, voice, onStart }) {
  stopSpeech();
  if (!hasSpeech || !voice) return;
  held = items.map(({ text, rate }, k) => {
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = LANGCODE[lang];
    u.voice = voice;
    u.rate = rate;
    u.onstart = () => { if (onStart) onStart(k); };
    return u;
  });
  held.forEach((u) => { try { window.speechSynthesis.speak(u); } catch (e) { /* bỏ qua */ } });
}

export function stopSpeech() {
  if (hasSpeech) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ }
  }
}

export const reduceMotion =
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
