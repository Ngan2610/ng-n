/** Lượt truy cập được ghi và đọc qua API SQL Server. */
const BASE = ((import.meta.env && import.meta.env.VITE_API_URL) || '').replace(/\/+$/, '');

const K_VID = 'dubchef-vid';
export const ACTIVE_MINUTES = 5; // "đang online" = có hoạt động trong 5 phút gần nhất
export const KEEP_DAYS = 90; // chỉ giữ số liệu 90 ngày gần nhất cho nhẹ

const EMPTY = () => ({ visitors: {}, days: {} });

/** Ngày dạng YYYY-MM-DD theo giờ máy. */
export function dayKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
}

/** Mã khách của trình duyệt này (dùng chung cho lượt truy cập và lượt quét QR). */
export function visitorId() {
  try {
    let id = localStorage.getItem(K_VID);
    if (!id) {
      id = 'v' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(K_VID, id);
    }
    return id;
  } catch (e) {
    return 'v-anon';
  }
}

/** Ghi một lượt xem trang vào dữ liệu `data` (hàm thuần, dễ kiểm thử). */
export function addVisit(data, { id, path, lang, at }) {
  const key = dayKey(at);
  const day = data.days[key] || (data.days[key] = { views: 0, ids: [], pages: {}, langs: {} });
  day.views += 1;
  if (!day.ids.includes(id)) day.ids.push(id);
  day.pages[path] = (day.pages[path] || 0) + 1;
  day.langs[lang] = (day.langs[lang] || 0) + 1;
  const v = data.visitors[id] || (data.visitors[id] = { first: at.getTime(), last: 0 });
  v.last = at.getTime();
  // Bỏ ngày quá cũ.
  const keys = Object.keys(data.days).sort();
  keys.slice(0, Math.max(0, keys.length - KEEP_DAYS)).forEach((k) => delete data.days[k]);
  return data;
}

/** Số người (không trùng) và lượt xem của các ngày [offset, offset+span) tính lùi từ hôm nay. */
function windowStats(data, now, span, offset) {
  const series = [];
  const ids = new Set();
  let views = 0;
  for (let i = offset + span - 1; i >= offset; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const day = data.days[dayKey(d)];
    series.push({ date: dayKey(d), visitors: day ? day.ids.length : 0, views: day ? day.views : 0 });
    if (day) {
      day.ids.forEach((x) => ids.add(x));
      views += day.views;
    }
  }
  return { series, visitors: ids.size, views };
}

/** Tổng hợp số liệu cho trang Admin trong `span` ngày gần nhất (hàm thuần). */
export function summarize(data, now = new Date(), span = 7) {
  const cur = windowStats(data, now, span, 0);
  const prev = windowStats(data, now, span, span);
  const yesterday = windowStats(data, now, 1, 1);
  const today = cur.series[cur.series.length - 1];
  let totalViews = 0;
  for (const day of Object.values(data.days)) totalViews += day.views;
  const since = now.getTime() - ACTIVE_MINUTES * 60000;
  const peak = cur.series.reduce((a, b) => (b.visitors > a.visitors ? b : a), cur.series[0]);
  return {
    span,
    today: { visitors: today.visitors, views: today.views },
    yesterday: { visitors: yesterday.visitors, views: yesterday.views },
    period: { visitors: cur.visitors, views: cur.views },
    prev: { visitors: prev.visitors, views: prev.views },
    total: { visitors: Object.keys(data.visitors).length, views: totalViews },
    activeNow: Object.values(data.visitors).filter((v) => v.last >= since).length,
    series: cur.series,
    peak: { date: peak.date, visitors: peak.visitors },
  };
}

/** Phần trăm thay đổi so với kỳ trước; null nếu kỳ trước bằng 0 (không so sánh được). */
export function change(cur, prev) {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

/** Dữ liệu mẫu 60 ngày để thử giao diện (id bắt đầu bằng "demo-"). Cùng một kết quả mỗi lần. */
export function sampleData(now = new Date()) {
  const data = EMPTY();
  const paths = ['/', '/features', '/demo', '/pricing', '/about', '/contact', '/faq'];
  const langs = ['vi', 'vi', 'vi', 'en', 'en', 'zh'];
  let seed = 7;
  const rnd = (n) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * n);
  };
  for (let back = 59; back >= 0; back--) {
    const visitors = 8 + rnd(20) + (59 - back); // tăng dần theo thời gian
    for (let n = 0; n < visitors; n++) {
      const id = 'demo-' + rnd(260);
      const views = 1 + rnd(4);
      for (let k = 0; k < views; k++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 8 + rnd(14), rnd(60));
        addVisit(data, { id, path: paths[rnd(paths.length)], lang: langs[rnd(langs.length)], at });
      }
    }
  }
  return data;
}

/** Gửi lượt truy cập lên SQL Server; lỗi thống kê không chặn việc sử dụng trang. */
export function trackVisit(path, lang) {
  if (path.startsWith('/admin')) return;
  return fetch(BASE + '/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: visitorId(), path, lang }),
  }).then((res) => res.ok).catch(() => false);
}

export const stats = {
  async load(user, span = 7) {
    const res = await fetch(BASE + '/api/admin/overview?days=' + span, {
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
