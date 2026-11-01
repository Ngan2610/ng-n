/** Mã QR dành cho khách; dữ liệu quét lưu dùng chung qua SQL Server. */
import { visitorId } from './analytics.js';

const BASE = ((import.meta.env && import.meta.env.VITE_API_URL) || '').replace(/\/+$/, '');
const PUBLIC_URL = (import.meta.env && import.meta.env.VITE_PUBLIC_URL) || '';
const TZ_HOURS = 7;
const K_SEEN = 'dubchef-qr-seen';
let pendingScan = null;
export const QR_SHARED = true;

const p2 = (n) => String(n).padStart(2, '0');
/** Ngày YYYY-MM-DD theo múi giờ lệch TZ_HOURS so với UTC. */
function tzDay(ms) {
  const d = new Date(ms + TZ_HOURS * 3600000);
  return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
}

/** Ghép số liệu thô từ API thành cùng dạng với summarize(). */
export function buildStats({ days, period, prev, totals, activeNow }, now, span) {
  const byDate = new Map((days || []).map((d) => [d.date, d]));
  const at = (i) => {
    const key = tzDay(now - i * 86400000);
    const d = byDate.get(key);
    return { date: key, visitors: d ? d.visitors : 0, views: d ? d.views : 0 };
  };
  const series = [];
  for (let i = span - 1; i >= 0; i--) series.push(at(i));
  const today = series[series.length - 1];
  const yesterday = at(1);
  const peak = series.reduce((a, b) => (b.visitors > a.visitors ? b : a), series[0]);
  return {
    span,
    today: { visitors: today.visitors, views: today.views },
    yesterday: { visitors: yesterday.visitors, views: yesterday.views },
    period, prev, total: totals, activeNow,
    series, peak: { date: peak.date, visitors: peak.visitors },
  };
}

/** Đường dẫn trang đích của mã QR (trong HashRouter). */
export const GUEST_PATH = '/guest';

/**
 * Địa chỉ nằm trong mã QR. Mặc định là địa chỉ web đang mở; đặt VITE_PUBLIC_URL khi chạy trên máy
 * cá nhân để điện thoại (không truy cập được localhost) quét vào đúng địa chỉ đã đăng.
 */
export function guestUrl(href = window.location.href, publicUrl = PUBLIC_URL) {
  return (publicUrl || href).split(/[?#]/)[0] + '#' + GUEST_PATH;
}

/** Địa chỉ chỉ mở được trên chính máy này (điện thoại quét sẽ không vào được). */
export const isLocalAddress = (url) => /^(https?:\/\/)?(localhost|127\.|\[::1\]|0\.0\.0\.0)/i.test(url) || url.startsWith('file:');

/** Chỉ đánh dấu đã quét trong phiên sau khi SQL Server chấp nhận yêu cầu. */
export async function trackScan(lang) {
  if (sessionStorage.getItem(K_SEEN) === '1') {
    return { success: true, alreadyScanned: true };
  }
  // Hai hiệu ứng khởi tạo đồng thời dùng chung một yêu cầu đang gửi.
  if (pendingScan) return pendingScan;
  pendingScan = (async () => {
    const res = await fetch(BASE + '/api/qr-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: visitorId(), lang }),
    });
    if (!res.ok) throw new Error('Không thể lưu lượt quét vào SQL Server');
    sessionStorage.setItem(K_SEEN, '1');
    return { success: true, alreadyScanned: false };
  })();
  try {
    return await pendingScan;
  } finally {
    pendingScan = null;
  }
}

export const qrStats = {
  async load(user, span = 7) {
    const res = await fetch(BASE + '/api/admin/qr?days=' + span, {
      headers: user?.token ? { Authorization: 'Bearer ' + user.token } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.code || 'server');
    if (!data.stats) throw new Error('server');
    return data;
  },
  seed() {},
  reset() {},
};
