// Luật nghiệp vụ của đơn hàng. Không dùng thư viện ngoài nên kiểm thử được bằng `node --test`.
// Giá luôn được tính lại ở máy chủ bằng đúng công thức của trang Bảng giá (shared/pricing.js),
// không tin con số do trình duyệt gửi lên.
import { randomBytes } from 'node:crypto';
import { calcPrice, checkCounts, parseCount } from '../../shared/pricing.js';

/** Thứ tự khớp với L của giao diện: 0 Việt, 1 Anh, 2 Trung. */
export const CURRENCIES = ['VND', 'USD', 'CNY'];
export const METHODS = ['card', 'momo', 'bank', 'qr'];
const MINOR_PER_UNIT = [1, 100, 100];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kiểm tra dữ liệu tạo đơn. Trả { value } hoặc { error } với mã lỗi ngắn. */
export function validateOrder(body) {
  if (!body || typeof body !== 'object') return { error: 'invalid' };
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  if (!name || name.length > 100) return { error: 'name' };
  if (!EMAIL.test(email) || email.length > 254) return { error: 'email' };
  const uploads = parseCount(body.uploads);
  const outs = parseCount(body.outs);
  const err = checkCounts(uploads, outs);
  if (err) return { error: err === 'pc_over' ? 'over' : 'count' };
  if (outs === 0) return { error: 'empty' };
  const L = Number(body.L);
  if (![0, 1, 2].includes(L)) return { error: 'currency' };
  return { value: { name, email, uploads, outs, L } };
}

/** Tính tiền đơn: loại tiền và số tiền theo đơn vị nhỏ nhất (đồng, cent, xu). */
export function priceOrder({ L, uploads, outs }) {
  const total = calcPrice(L, uploads, outs).total;
  return { currency: CURRENCIES[L], amountMinor: Math.round(total * MINOR_PER_UNIT[L]) };
}

/** Mã giao dịch giả lập, ví dụ CARD-LK3F9A-1B2C3D4E. */
export function newTransactionRef(method, now = Date.now(), rnd = () => randomBytes(4).toString('hex')) {
  return method.toUpperCase() + '-' + now.toString(36).toUpperCase() + '-' + rnd().toUpperCase();
}
