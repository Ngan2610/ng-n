import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatMoney } from '../shared/format.js';
import { CURRENCIES, HAS_PAYMENT_API, METHODS, orderAmount, orders, paymentPayload } from '../api/orders.js';
import QrCode from './QrCode.jsx';

/** Nút Thanh toán và khung thanh toán cho số video đang chọn ở phần tính giá. */
export default function Checkout({ uploads, outs, total, autoOpen = false }) {
  const { t, L } = useI18n();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(autoOpen);
  const [method, setMethod] = useState('card');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const [done, setDone] = useState(null);
  const [recent, setRecent] = useState([]);
  const [pending, setPending] = useState(null); // đơn đã tạo, đang chờ khách quét mã QR
  const [step, setStep] = useState('form'); // 'form' hoặc 'qr'

  const refresh = useCallback(() => {
    if (user) orders.list(user.email).then(setRecent).catch(() => setRecent([]));
  }, [user]);
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFailed('');
    try {
      if (method === 'qr') {
        // Đổi phương thức rồi quay lại thì dùng lại đơn cũ nếu số video và loại tiền không đổi, tránh tạo đơn trùng.
        const same = pending && pending.uploads === uploads && pending.outs === outs && pending.currency === CURRENCIES[L];
        setPending(same ? pending : await orders.create({ name: user.name, email: user.email, uploads, outs, L }));
        setStep('qr');
        refresh();
        return;
      }
      const order = await orders.create({ name: user.name, email: user.email, uploads, outs, L });
      const res = await orders.pay(order.id, method);
      setDone(res.order);
      refresh();
    } catch (err) {
      setFailed(err.code === 'payment_unavailable' ? 'Cổng thanh toán chưa được cấu hình. Đơn đã được lưu ở trạng thái chờ; chưa ghi nhận thu tiền.' : t('co_fail'));
    } finally {
      setBusy(false);
    }
  }

  /** Khách đã quét mã và chuyển tiền: ghi nhận thanh toán bằng QR (giả lập, chưa nối ngân hàng thật). */
  async function confirmQr() {
    setBusy(true);
    setFailed('');
    try {
      const res = await orders.pay(pending.id, 'qr');
      setDone(res.order);
      setPending(null);
      setStep('form');
      refresh();
    } catch (err) {
      setFailed(err.code === 'payment_unavailable' ? 'Cổng thanh toán chưa được cấu hình. Đơn đã được lưu ở trạng thái chờ; chưa ghi nhận thu tiền.' : t('co_fail'));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setDone(null);
    setFailed('');
    setPending(null);
    setStep('form');
  }

  if (!open) {
    return (
      <p style={{ marginTop: 20 }}>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>{t('co_btn')}</button>
      </p>
    );
  }

  return (
    <section className="checkout" aria-labelledby="co-h">
      <h3 id="co-h">{t('co_title')}</h3>

      {!user ? (
        <>
          <p role="alert">{t('co_need_login')}</p>
          <p style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/login" state={{ from: pathname, resume: { uploads, outs } }}>{t('nav_login')}</Link>
            <button type="button" className="btn" onClick={close}>{t('co_close')}</button>
          </p>
        </>
      ) : done ? (
        <div role="status">
          <p className="co-ok">✓ {t('co_ok')}</p>
          <dl className="co-sum">
            <dt>{t('co_code')}</dt><dd data-testid="co-order">#{done.id}</dd>
            <dt>{t('co_ref')}</dt><dd data-testid="co-ref">{done.ref}</dd>
            <dt>{t('pc_amount')}</dt><dd>{formatMoney(CURRENCIES.indexOf(done.currency), orderAmount(done))}</dd>
          </dl>
          <p style={{ marginTop: 14 }}><button type="button" className="btn" onClick={close}>{t('co_close')}</button></p>
        </div>
      ) : step === 'qr' && pending ? (
        <div className="co-qr" data-testid="co-qr-step">
          <p>{t('co_qr_scan')}</p>
          <QrCode value={paymentPayload(pending)} label={t('co_qr_alt')} size={220} testId="co-qrcode" />
          <dl className="co-sum">
            <dt>{t('co_code')}</dt><dd data-testid="co-qr-order">#{pending.id}</dd>
            <dt>{t('pc_amount')}</dt><dd>{formatMoney(CURRENCIES.indexOf(pending.currency), orderAmount(pending))}</dd>
            <dt>{t('co_qr_memo')}</dt><dd>DUBCHEF{pending.id}</dd>
          </dl>
          <p className="fine" style={{ marginTop: 12 }}>{t('co_qr_demo')}</p>
          {failed ? <p className="err" role="alert">{failed}</p> : null}
          <p style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={confirmQr} disabled={busy}>{busy ? t('co_busy') : t('co_qr_done')}</button>
            <button type="button" className="btn" onClick={() => { setStep('form'); setFailed(''); }} disabled={busy}>{t('co_qr_back')}</button>
            <button type="button" className="btn" onClick={close} disabled={busy}>{t('co_close')}</button>
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <dl className="co-sum">
            <dt>{t('co_sum')}</dt>
            <dd>{uploads} / {outs} {t('co_sum_line')}</dd>
            <dt>{t('pc_total')}</dt>
            <dd><strong data-testid="co-total">{formatMoney(L, total)}</strong></dd>
          </dl>
          <fieldset className="co-methods">
            <legend>{t('co_method')}</legend>
            {METHODS.map((m) => (
              <label key={m}>
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} />
                {t('co_' + m)}
              </label>
            ))}
          </fieldset>
          <p className="fine" style={{ marginTop: 12 }}>Thanh toán trực tuyến cần cổng thanh toán được cấu hình. Chế độ thử nghiệm không thu tiền thật.</p>
          {!HAS_PAYMENT_API ? <p className="fine" style={{ marginTop: 6 }}>{t('co_local')}</p> : null}
          {failed ? <p className="err" role="alert">{failed}</p> : null}
          <p style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('co_busy') : t(method === 'qr' ? 'co_qr_make' : 'co_pay')}</button>
            <button type="button" className="btn" onClick={close} disabled={busy}>{t('co_close')}</button>
          </p>
        </form>
      )}

      {user && recent.length ? (
        <div className="co-recent">
          <h4>{t('co_orders')}</h4>
          <ul>
            {recent.map((o) => (
              <li key={o.id}>
                <span>#{o.id}</span>
                <span>{formatMoney(CURRENCIES.indexOf(o.currency), orderAmount(o))}</span>
                <span className={'chip ' + (o.status === 'paid' ? 'active' : 'locked')}>{t(o.status === 'paid' ? 'co_paid' : 'co_pending')}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
