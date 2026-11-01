import { useState } from 'react';
import { change } from '../api/analytics.js';

/** Định dạng số theo ngôn ngữ đang chọn (1.234 / 1,234). */
export const num = (L, n) => new Intl.NumberFormat(['vi-VN', 'en-US', 'zh-CN'][L]).format(n);
/** 2026-10-22 -> 22/10 */
export const shortDate = (key) => key.slice(8) + '/' + key.slice(5, 7);

/** Mũi tên và phần trăm thay đổi (không chỉ dựa vào màu). */
export function Trend({ cur, prev, label, id }) {
  const pct = change(cur, prev);
  if (pct === null) return <span className="trend flat" data-testid={id}>–</span>;
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '■';
  return (
    <span className={'trend ' + dir} data-testid={id}>
      {arrow} {pct > 0 ? '+' : ''}{pct}% <span className="trend-l">{label}</span>
    </span>
  );
}

export function Kpi({ label, value, id, children }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-num" data-testid={id}>{value}</p>
      <p className="kpi-note">{children}</p>
    </div>
  );
}

/** Bộ khóa dịch mặc định của biểu đồ lượt truy cập; trang QR truyền bộ khác. */
export const CHART_KEYS = { chart: 'ad_chart', legendV: 'ad_legend_v', legendP: 'ad_legend_p', people: 'ad_people', views: 'ad_views' };

/** Biểu đồ đường + vùng tô: người truy cập (nét liền) và lượt xem (nét đứt). */
export function Chart({ series, L, t, keys = CHART_KEYS }) {
  const [hover, setHover] = useState(null);
  const W = 720, H = 260, padL = 44, padR = 12, padT = 16, padB = 30;
  const top = Math.max(4, ...series.map((d) => d.views));
  const niceTop = Math.ceil(top / 4) * 4;
  const x = (i) => padL + (series.length === 1 ? 0 : (i * (W - padL - padR)) / (series.length - 1));
  const y = (v) => padT + (1 - v / niceTop) * (H - padT - padB);
  const line = (key) => series.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[key]).toFixed(1)).join(' ');
  const area = line('visitors') + ` L${x(series.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const ticks = [0, 1, 2, 3, 4].map((k) => (niceTop * k) / 4);
  const every = Math.ceil(series.length / 8);
  const h = hover === null ? null : series[hover];

  return (
    <div className="chart">
      <div className="legend" aria-hidden="true">
        <span><i className="sw v" />{t(keys.legendV)}</span>
        <span><i className="sw p" />{t(keys.legendP)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(keys.chart)} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} />
            <text className="axis" x={padL - 8} y={y(v) + 4} textAnchor="end">{num(L, Math.round(v))}</text>
          </g>
        ))}
        <path className="area" d={area} />
        <path className="ln-p" d={line('views')} />
        <path className="ln-v" d={line('visitors')} />
        {series.map((d, i) => (
          i % every === 0 || i === series.length - 1 ? (
            <text key={d.date} className="axis" x={x(i)} y={H - 8} textAnchor="middle">{shortDate(d.date)}</text>
          ) : null
        ))}
        {h ? (
          <g>
            <line className="cross" x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} />
            <circle className="dot" cx={x(hover)} cy={y(h.visitors)} r="5" />
          </g>
        ) : null}
        {series.map((d, i) => (
          <rect key={d.date} x={x(i) - (W - padL - padR) / series.length / 2} y={padT} width={(W - padL - padR) / series.length} height={H - padT - padB} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <p className="tip" aria-live="polite">
        {h ? <><strong>{shortDate(h.date)}</strong> · {num(L, h.visitors)} {t(keys.people)} · {num(L, h.views)} {t(keys.views)}</> : ' '}
      </p>
      <table className="sr-only">
        <caption>{t(keys.chart)}</caption>
        <thead><tr><th scope="col">{t('ad_date')}</th><th scope="col">{t(keys.people)}</th><th scope="col">{t(keys.views)}</th></tr></thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.date}><th scope="row">{shortDate(d.date)}</th><td>{d.visitors}</td><td>{d.views}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
