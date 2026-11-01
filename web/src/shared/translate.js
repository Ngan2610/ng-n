// Dịch văn bản bằng dịch vụ MyMemory (miễn phí, không cần khóa API).
// Giới hạn của dịch vụ: khoảng 500 ký tự mỗi câu, có hạn mức miễn phí theo IP mỗi ngày.
// Đây là dịch THẬT qua Internet — cần máy đang chạy có kết nối mạng.
const ENDPOINT = 'https://api.mymemory.translated.net/get';
const LANGPAIR = { vi: 'vi', en: 'en', zh: 'zh-CN' };

export class TranslateError extends Error {
  constructor(code) {
    super(code);
    this.name = 'TranslateError';
    this.code = code; // 'net' | 'server' | 'limit' | 'empty'
  }
}

/** Dịch một câu từ ngôn ngữ nguồn (vi|en|zh) sang ngôn ngữ đích. fetchImpl cho phép thay fetch khi test. */
export async function translateText(text, from, to, fetchImpl = fetch) {
  const trimmed = String(text).trim();
  if (!trimmed) return '';
  if (from === to) return trimmed;

  const url = `${ENDPOINT}?q=${encodeURIComponent(trimmed)}&langpair=${LANGPAIR[from]}|${LANGPAIR[to]}`;
  let res;
  try {
    res = await fetchImpl(url);
  } catch (e) {
    throw new TranslateError('net');
  }
  if (!res.ok) throw new TranslateError(res.status === 429 ? 'limit' : 'server');

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new TranslateError('server');
  }

  if (data.responseStatus && Number(data.responseStatus) !== 200) throw new TranslateError('limit');
  const out = data && data.responseData && data.responseData.translatedText;
  if (!out) throw new TranslateError('empty');
  return out;
}

/** Dịch một câu sang cả 3 ngôn ngữ Việt, Anh, Trung, giữ nguyên bản ở ngôn ngữ nguồn. Trả về { vi, en, zh }. */
export async function translateToAll(text, from, fetchImpl = fetch) {
  const trimmed = String(text).trim();
  const targets = ['vi', 'en', 'zh'].filter((l) => l !== from);
  const pairs = await Promise.all(targets.map(async (to) => [to, await translateText(trimmed, from, to, fetchImpl)]));
  const result = { [from]: trimmed };
  for (const [lang, val] of pairs) result[lang] = val;
  return result;
}

/** Dịch nhiều dòng (mỗi dòng một câu) sang cả 3 ngôn ngữ. Trả về mảng [{ vi, en, zh }, ...].
 *  Dịch TUẦN TỰ từng dòng (không bắn hết cùng lúc): dịch vụ MyMemory miễn phí sẽ chặn nếu nhận
 *  quá nhiều request dồn dập cùng lúc — dễ gặp khi video dài, Whisper tách ra rất nhiều câu ngắn. */
export async function translateLines(lines, from, fetchImpl = fetch) {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let n = 0; n < clean.length; n += 1) {
    out.push(await translateToAll(clean[n], from, fetchImpl));
    if (n < clean.length - 1) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return out;
}
