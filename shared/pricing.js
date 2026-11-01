// Tính giá theo số video đăng lên và số video dịch ra. Dùng chung cho web và mobile.
// Sửa ở đây rồi chạy: npm run sync

/** Số video tối đa cho mỗi ô nhập. */
export const MAX_VIDEOS = 500;
/** Mỗi video đăng lên được dịch ra tối đa 3 ngôn ngữ (Việt, Anh, Trung). */
export const OUT_PER_VIDEO = 3;

// Đơn giá minh họa tính theo đơn vị nhỏ nhất của từng loại tiền (đồng, cent, xu)
// để cộng trừ không bị sai số số thực. Thứ tự: [đăng lên, dịch ra].
// L = 0 Việt (VND), 1 Anh (USD), 2 Trung (CNY).
const UNIT_MINOR = [[20000, 10000], [80, 40], [600, 300]];
const MINOR_PER_UNIT = [1, 100, 100];

/** Đơn giá của một video đăng lên (kind = 0) hoặc một video dịch ra (kind = 1), theo tiền của ngôn ngữ L. */
export function unitPrice(L, kind) {
  return UNIT_MINOR[L][kind] / MINOR_PER_UNIT[L];
}

/** Các gói mẫu: số video đăng lên và số video dịch ra. Giá được tính bằng calcPrice, không ghi cứng. */
export const SAMPLE_PACKS = [
  { id: 1, uploads: 3, outs: 3 }, // mỗi video dịch ra 1 ngôn ngữ
  { id: 2, uploads: 10, outs: 20 }, // mỗi video dịch ra 2 ngôn ngữ
  { id: 3, uploads: 30, outs: 90 }, // mỗi video dịch ra đủ 3 ngôn ngữ
  { id: 4, uploads: 100, outs: 300 },
];

/** Đọc số nguyên từ chuỗi người dùng nhập (0..MAX_VIDEOS). Trả null nếu không hợp lệ. */
export function parseCount(text) {
  const s = String(text).trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n <= MAX_VIDEOS ? n : null;
}

/** Kiểm tra cặp số lượng. Trả về null nếu hợp lệ, hoặc khóa lỗi: 'pc_bad' | 'pc_over'. */
export function checkCounts(uploads, outs) {
  if (uploads === null || outs === null) return 'pc_bad';
  if (outs > uploads * OUT_PER_VIDEO) return 'pc_over';
  return null;
}

/** Giá tạm tính: { up, out, total } theo tiền của ngôn ngữ L. */
export function calcPrice(L, uploads, outs) {
  const per = MINOR_PER_UNIT[L];
  const upMinor = uploads * UNIT_MINOR[L][0];
  const outMinor = outs * UNIT_MINOR[L][1];
  return { up: upMinor / per, out: outMinor / per, total: (upMinor + outMinor) / per };
}
