// Tổng hợp số liệu truy cập cho trang Admin. Hàm thuần, cùng dạng với `summarize` ở web/src/api/analytics.js.
export const ACTIVE_MINUTES = 5;

const p2 = (n) => String(n).padStart(2, '0');

/** Ngày YYYY-MM-DD theo múi giờ lệch `tzHours` so với UTC (Việt Nam = 7). */
export function dayKey(ms, tzHours) {
  const d = new Date(ms + tzHours * 3600000);
  return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
}

/**
 * days: [{ date, visitors, views }] (mỗi ngày đã gộp ở SQL), period / prev: { visitors, views } của kỳ này / kỳ trước
 * (người truy cập không trùng trong cả kỳ, tính ở SQL), totals: { visitors, views }, activeNow: số.
 * Ngày không có dữ liệu được tính là 0.
 */
export function buildStats({ days, period, prev, totals, activeNow }, now, span, tzHours = 7) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const at = (i) => {
    const key = dayKey(now - i * 86400000, tzHours);
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
    period,
    prev,
    total: totals,
    activeNow,
    series,
    peak: { date: peak.date, visitors: peak.visitors },
  };
}
