import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../context/I18nContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import { QR_SHARED, guestUrl, isLocalAddress, qrStats } from '../api/qr.js';
import { qrSvg } from '../utils/qr.js';
import QrCode from '../components/QrCode.jsx';
import { Chart, Kpi, Trend, num, shortDate } from '../components/AdminWidgets.jsx';

const RANGES = [7, 14, 30];
const QR_CHART = { chart: 'aq_chart', legendV: 'aq_legend_v', legendP: 'aq_legend_p', people: 'aq_people', views: 'aq_scans' };

/** Quản trị: mã QR dành cho khách và số người đã quét mã (người không trùng + số lượt quét). */
export default function AdminQr() {
  const { t, L } = useI18n();
  const { user } = useAuth();
  usePageTitle('aq_title');
  const [span, setSpan] = useState(7);
  const [st, setSt] = useState(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  const url = guestUrl();

  const load = useCallback(() => {
    setFailed(false);
    qrStats.load(user, span).then((r) => setSt(r.stats)).catch(() => setFailed(true));
  }, [user, span]);
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      load();
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* trình duyệt không cho sao chép: bỏ qua */ }
  }

  function download() {
    const blob = new Blob([qrSvg(url)], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'dubchef-guest-qr.svg';
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{t('aq_title')}</h1>
          <p>{t('aq_sub')}</p>
        </div>
        <div className="adm-tools">
          <div className="seg" role="group" aria-label={t('ad_range')}>
            {RANGES.map((n) => (
              <button key={n} type="button" aria-pressed={span === n} onClick={() => setSpan(n)}>{t('ad_r' + n)}</button>
            ))}
          </div>
          <button type="button" className="btn btn-sm" onClick={load}>{t('ad_refresh')}</button>
          {!QR_SHARED ? (
            <>
              <button type="button" className="btn btn-sm" onClick={() => { qrStats.seed(); load(); }}>{t('ad_seed')}</button>
              <button type="button" className="btn btn-sm" onClick={() => { qrStats.reset(); load(); }}>{t('ad_reset')}</button>
            </>
          ) : null}
        </div>
      </div>
      {!QR_SHARED ? <p className="adm-note">{t('aq_local')}</p> : null}

      <section className="panel" aria-labelledby="aq-code-h">
        <div className="qr-card">
          <QrCode value={url} label={t('qh_alt')} size={168} testId="aq-qrcode" />
          <div className="qr-info">
            <h2 id="aq-code-h">{t('aq_code_title')}</h2>
            <p>{t('aq_code_d')}</p>
            <p className="fine-i" style={{ marginTop: 10 }}>{t('aq_link')}:</p>
            <p><code className="qr-url" data-testid="aq-url">{url}</code></p>
            {isLocalAddress(url) ? <p className="fine-i" role="note" style={{ marginTop: 8 }}>{t('aq_localhost')}</p> : null}
            <p style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm" onClick={copy}>{copied ? t('aq_copied') : t('aq_copy')}</button>
              <button type="button" className="btn btn-sm" onClick={download}>{t('aq_download')}</button>
            </p>
          </div>
        </div>
      </section>

      {failed ? <p role="alert">{t('ad_fail')}</p> : null}
      {!st && !failed ? <p role="status">{t('ad_loading')}</p> : null}

      {st ? (
        <>
          <div className="kpis">
            <Kpi id="aq-today" label={t('aq_today')} value={num(L, st.today.visitors)}>
              <Trend id="aq-today-trend" cur={st.today.visitors} prev={st.yesterday.visitors} label={t('ad_vs_yday')} />
            </Kpi>
            <Kpi id="aq-period" label={t('aq_period') + ' (' + t('ad_r' + st.span) + ')'} value={num(L, st.period.visitors)}>
              <Trend id="aq-period-trend" cur={st.period.visitors} prev={st.prev.visitors} label={t('ad_vs_prev')} />
            </Kpi>
            <Kpi id="aq-total" label={t('aq_total')} value={num(L, st.total.visitors)}>
              {num(L, st.total.views)} {t('aq_scans')}
            </Kpi>
            <Kpi id="aq-now" label={t('aq_now')} value={num(L, st.activeNow)}>{t('ad_now_d')}</Kpi>
          </div>

          <section className="panel" aria-labelledby="aq-chart-h">
            <div className="panel-head">
              <h2 id="aq-chart-h">{t('aq_chart')}</h2>
              <p className="fine-i">
                {t('ad_peak')}: <strong>{shortDate(st.peak.date)}</strong> ({num(L, st.peak.visitors)} {t('aq_people')})
              </p>
            </div>
            <Chart series={st.series} L={L} t={t} keys={QR_CHART} />
          </section>
        </>
      ) : null}
    </>
  );
}
