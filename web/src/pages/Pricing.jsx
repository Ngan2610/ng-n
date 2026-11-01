import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import Field from '../components/Field.jsx';
import Checkout from '../components/Checkout.jsx';
import { formatMoney, planPrice } from '../shared/format.js';
import { calcPrice, checkCounts, parseCount, SAMPLE_PACKS, unitPrice } from '../shared/pricing.js';

const PLANS = [1, 2, 3];

export default function Pricing() {
  const { t, L } = useI18n();
  usePageTitle('pr_title');
  // Quay lại từ trang đăng nhập/đăng ký: khôi phục số video đã chọn và mở lại khung thanh toán.
  const { state } = useLocation();
  const resume = state && state.resume;
  const initial = (n) => (Number.isInteger(n) && n > 0 ? String(n) : '3');
  const [uploads, setUploads] = useState(() => initial(resume && resume.uploads));
  const [outs, setOuts] = useState(() => initial(resume && resume.outs));
  const [yearly, setYearly] = useState(false);

  const u = parseCount(uploads);
  const o = parseCount(outs);
  const err = checkCounts(u, o);
  const price = err ? null : calcPrice(L, u, o);
  // Lỗi "nhập sai số" gắn vào ô bị sai; lỗi "dịch ra quá nhiều" gắn vào ô số video dịch ra.
  const upErr = u === null ? 'pc_bad' : null;
  const outErr = o === null ? 'pc_bad' : err === 'pc_over' ? 'pc_over' : null;

  function applyPack(pack) {
    setUploads(String(pack.uploads));
    setOuts(String(pack.outs));
    const el = document.getElementById('pc-up');
    if (el) el.focus();
  }

  return (
    <>
      <div className="wrap page-head">
        <h1>{t('pr_title')}</h1>
        <p>{t('pr_sub')}</p>
      </div>

      <div className="wrap">
        <h2 className="sec">{t('pc_title')}</h2>
        <div className="calc">
          <div>
            <Field id="pc-up" label={t('pc_up')} error={upErr && t(upErr)}>
              <input
                id="pc-up"
                inputMode="numeric"
                autoComplete="off"
                value={uploads}
                onChange={(e) => setUploads(e.target.value)}
                aria-invalid={upErr ? 'true' : undefined}
              />
            </Field>
            <Field id="pc-out" label={t('pc_out')} error={outErr && t(outErr)}>
              <input
                id="pc-out"
                inputMode="numeric"
                autoComplete="off"
                value={outs}
                onChange={(e) => setOuts(e.target.value)}
                aria-invalid={outErr ? 'true' : undefined}
                aria-describedby="pc-hint"
              />
            </Field>
            <p className="fine" id="pc-hint" style={{ marginTop: 0 }}>{t('pc_hint')}</p>
          </div>
          <div className="plan" aria-live="polite">
            {price ? (
              <>
                <table className="quote">
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">{t('pc_title')}</span></th>
                      <th scope="col">{t('pc_qty')}</th>
                      <th scope="col">{t('pc_unit')}</th>
                      <th scope="col">{t('pc_amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">{t('pc_row_up')}</th>
                      <td>{u}</td>
                      <td>{formatMoney(L, unitPrice(L, 0))}</td>
                      <td>{formatMoney(L, price.up)}</td>
                    </tr>
                    <tr>
                      <th scope="row">{t('pc_row_out')}</th>
                      <td>{o}</td>
                      <td>{formatMoney(L, unitPrice(L, 1))}</td>
                      <td>{formatMoney(L, price.out)}</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  <span>{t('pc_total')}</span>
                  <br />
                  <strong className="price" data-testid="pc-total">{formatMoney(L, price.total)}</strong>
                </p>
              </>
            ) : (
              <p className="fine" style={{ margin: 0 }}>{t(err)}</p>
            )}
          </div>
        </div>
        {price ? <Checkout uploads={u} outs={o} total={price.total} autoOpen={Boolean(resume)} /> : null}
      </div>

      <div className="section">
        <div className="wrap">
          <h2 className="sec">{t('pk_title')}</h2>
          <p className="fine" style={{ marginTop: 12 }}>{t('pk_sub')}</p>
          <div className="plans packs">
            {SAMPLE_PACKS.map((pack) => (
              <section className="plan" key={pack.id} aria-labelledby={'pk-' + pack.id}>
                <h3 id={'pk-' + pack.id}>{t('pk' + pack.id + '_n')}</h3>
                <p>{t('pk' + pack.id + '_d')}</p>
                <ul>
                  <li>{pack.uploads} {t('pk_vid')}</li>
                  <li>{pack.outs} {t('pk_out')}</li>
                </ul>
                <p className="price" data-testid={'pk-price-' + pack.id}>
                  {formatMoney(L, calcPrice(L, pack.uploads, pack.outs).total)}
                </p>
                <button type="button" className="btn" onClick={() => applyPack(pack)}>
                  {t('pk_use')}
                  <span className="sr-only"> – {t('pk' + pack.id + '_n')}</span>
                </button>
              </section>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingBottom: 96 }}>
        <h2 className="sec">{t('pl_title')}</h2>
        <div className="toggle" role="group" aria-label={t('pl_title')}>
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>{t('pr_monthly')}</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>{t('pr_yearly')}</button>
        </div>
        <div className="plans">
          {PLANS.map((n, p) => {
            const pick = p === 1;
            return (
              <section className={'plan' + (pick ? ' pick' : '')} key={n} aria-labelledby={'pl-' + n}>
                <h3 id={'pl-' + n}>
                  {t('pl' + n)}
                  {pick ? <span className="badge">{t('pl_pick')}</span> : null}
                </h3>
                <p className="price">
                  {formatMoney(L, planPrice(L, p, yearly))} <small>{t('pr_per')}</small>
                </p>
                <ul>
                  {[1, 2, 3].map((k) => <li key={k}>{t('pl' + n + '_' + k)}</li>)}
                </ul>
                <Link className={'btn' + (pick ? ' btn-primary' : '')} to="/register">
                  {p === 0 ? t('pl_c1') : t('pl_c')}
                </Link>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
