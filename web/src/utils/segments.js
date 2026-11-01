// Whisper hay cắt lời nói thành các mảnh rất ngắn, đứt giữa câu ("Lột gà không nước trong vòng," / "3 ví dậy").
// Gộp các mảnh liên tiếp lại thành câu/đoạn trọn vẹn để giọng đọc chạy liền một mạch.
const END = /[.!?…。！？]["')\]]?$/;

/** @param {{ text: string, timestamp?: [number, number|null] }[]} chunks
 *  @returns {{ text: string, start: number, end: number|null }[]} */
export function mergeChunks(chunks, { minSentence = 20, maxLen = 110 } = {}) {
  const out = [];
  let cur = null;
  const flush = () => { if (cur && cur.text) out.push(cur); cur = null; };
  for (const c of chunks) {
    const text = (c.text || '').trim();
    if (!text) continue;
    const start = c.timestamp?.[0] ?? 0;
    const end = c.timestamp?.[1] ?? null;
    if (!cur) cur = { text, start, end };
    else { cur.text += ' ' + text; cur.end = end ?? cur.end; }
    if ((END.test(cur.text) && cur.text.length >= minSentence) || cur.text.length >= maxLen) flush();
  }
  flush();
  return out;
}
