import { describe, expect, it } from 'vitest';
import { mergeChunks } from '../utils/segments.js';

describe('mergeChunks', () => {
  it('gộp các mảnh ngắn đứt giữa câu thành câu trọn vẹn, giữ mốc thời gian đầu/cuối', () => {
    const out = mergeChunks([
      { text: 'Lột gà không nước trong vòng', timestamp: [0, 2] },
      { text: '3 phút là xong.', timestamp: [2, 4] },
      { text: 'Đầu tiên chuẩn bị nước.', timestamp: [4, 6] },
    ]);
    expect(out).toEqual([
      { text: 'Lột gà không nước trong vòng 3 phút là xong.', start: 0, end: 4 },
      { text: 'Đầu tiên chuẩn bị nước.', start: 4, end: 6 },
    ]);
  });

  it('bỏ mảnh rỗng và tự cắt khi đoạn quá dài dù không có dấu câu', () => {
    const long = 'từ '.repeat(40).trim(); // 119 ký tự > maxLen 110
    const out = mergeChunks([{ text: '  ', timestamp: [0, 1] }, { text: long, timestamp: [1, 5] }, { text: long, timestamp: [5, 9] }]);
    expect(out.length).toBe(2);
  });
});
