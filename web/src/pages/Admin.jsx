import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../context/I18nContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import { HAS_API } from '../api/client.js';
import { stats as statsApi } from '../api/analytics.js';
import { adminApi } from '../api/admin.js';
import { Chart, Kpi, Trend, num, shortDate } from '../components/AdminWidgets.jsx';

const RANGES = [7, 14, 30];

export default function Admin() {
  const { t, L } = useI18n();
  const { user } = useAuth();
  usePageTitle('ad_title');
  const [span, setSpan] = useState(7);
  const [st, setSt] = useState(null);
  const [failed, setFailed] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    statsApi.load(user, span).then((r) => setSt(r.stats)).catch(() => setFailed(true));
  }, [user, span]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!HAS_API) {
      setSummaryLoading(false);
      return;
    }

    if (!user?.token) {
      setSummaryError('Chưa có phiên đăng nhập Admin hợp lệ.');
      setSummaryLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadSummary() {
      try {
        setSummaryLoading(true);
        setSummaryError('');

        const base = import.meta.env.VITE_API_URL || '';

        const response = await fetch(`${base}/api/admin/statistics`, {
          headers: {
            Authorization: `Bearer ${user.token}`
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Lỗi API: ${response.status}`);
        }

        const data = await response.json();
        setSummary(data.statistics);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSummaryError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSummaryLoading(false);
        }
      }
    }

    loadSummary();

    return () => controller.abort();
  }, [user?.token]);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{t('ad_title')}</h1>
          <p>{t('ad_sub')}</p>
        </div>
        <div className="adm-tools">
          <div className="seg" role="group" aria-label={t('ad_range')}>
            {RANGES.map((n) => (
              <button key={n} type="button" aria-pressed={span === n} onClick={() => setSpan(n)}>{t('ad_r' + n)}</button>
            ))}
          </div>
          <button type="button" className="btn btn-sm" onClick={load}>{t('ad_refresh')}</button>
          {!HAS_API ? (
            <>
              <button type="button" className="btn btn-sm" onClick={() => { statsApi.seed(); adminApi.seed(); load(); }}>{t('ad_seed')}</button>
              <button type="button" className="btn btn-sm" onClick={() => { statsApi.reset(); adminApi.clearSamples(); load(); }}>{t('ad_reset')}</button>
            </>
          ) : null}
        </div>
      </div>
      {!HAS_API ? <p className="adm-note">{t('ad_local')}</p> : null}

      {failed ? <p role="alert">{t('ad_fail')}</p> : null}
      {!st && !failed ? <p role="status">{t('ad_loading')}</p> : null}

      {/* Thống kê tổng quan từ SQL Server */}
      <section className="panel" aria-labelledby="summary-title">
        <div className="panel-head">
          <h2 id="summary-title">Thống kê hệ thống Dubchef</h2>
          <p className="fine-i">
            Dữ liệu được lấy trực tiếp từ SQL Server
          </p>
        </div>

        {summaryLoading && (
          <p role="status">Đang tải thống kê...</p>
        )}

        {summaryError && (
          <p role="alert">
            Không thể tải thống kê: {summaryError}
          </p>
        )}

        {summary && (
          <div className="kpis">
            <Kpi
              id="total-users"
              label="Tổng người dùng"
              value={num(L, summary.totalUsers)}
            >
              Tài khoản đã đăng ký
            </Kpi>

            <Kpi
              id="total-videos"
              label="Tổng video"
              value={num(L, summary.totalVideos)}
            >
              Video đã tải lên
            </Kpi>

            <Kpi
              id="total-languages"
              label="Tổng ngôn ngữ"
              value={num(L, summary.totalLanguages)}
            >
              Ngôn ngữ được hỗ trợ
            </Kpi>

            <Kpi
              id="total-qr"
              label="Tổng lượt quét QR"
              value={num(L, summary.totalQrScans)}
            >
              Lượt quét mã QR
            </Kpi>

            <Kpi
              id="total-visits"
              label="Tổng lượt truy cập"
              value={num(L, summary.totalVisits)}
            >
              Lượt truy cập được ghi nhận
            </Kpi>
          </div>
        )}
      </section>

      {st ? (
        <>
          <div className="kpis">
            <Kpi id="ad-now" label={t('ad_now')} value={num(L, st.activeNow)}>{t('ad_now_d')}</Kpi>
            <Kpi id="ad-today" label={t('ad_today')} value={num(L, st.today.visitors)}>
              <Trend id="ad-today-trend" cur={st.today.visitors} prev={st.yesterday.visitors} label={t('ad_vs_yday')} />
            </Kpi>
            <Kpi id="ad-period" label={t('ad_period') + ' (' + t('ad_r' + st.span) + ')'} value={num(L, st.period.visitors)}>
              <Trend id="ad-period-trend" cur={st.period.visitors} prev={st.prev.visitors} label={t('ad_vs_prev')} />
            </Kpi>
            <Kpi id="ad-total" label={t('ad_total')} value={num(L, st.total.visitors)}>
              {num(L, st.total.views)} {t('ad_views')}
            </Kpi>
          </div>

          <section className="panel" aria-labelledby="ad-chart-h">
            <div className="panel-head">
              <h2 id="ad-chart-h">{t('ad_chart')}</h2>
              <p className="fine-i">
                {t('ad_peak')}: <strong>{shortDate(st.peak.date)}</strong> ({num(L, st.peak.visitors)} {t('ad_people')})
              </p>
            </div>
            <Chart series={st.series} L={L} t={t} />
          </section>
        </>
      ) : null}
    </>
  );
}
