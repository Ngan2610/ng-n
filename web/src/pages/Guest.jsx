import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import { trackScan } from '../api/qr.js';
export default function Guest() {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const started = useRef(false);
  usePageTitle('pt_guest');
  async function recordScan() {
    setStatus('loading');
    setError('');
    try {
      await trackScan(lang);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Không thể ghi nhận lượt quét.');
      setStatus('error');
    }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    recordScan();
    // Chỉ ghi khi trang được mở lần đầu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="hero">
      <div className="wrap hero-center">
        {status === 'loading' && (
          <p role="status">
            Đang xác nhận lượt quét QR...
          </p>
        )}
        {status === 'success' && (
          <div
            role="status"
            style={{
              padding: 20,
              marginBottom: 20,
              borderRadius: 12,
              background: '#e8f5e9',
              color: '#176b38'
            }}
          >
            <h2>✓ Quét mã QR thành công!</h2>
            <p>
              Chào mừng bạn đến với Dubchef.
              Lượt quét đã được ghi nhận.
            </p>
          </div>
        )}
        {status === 'error' && (
          <div role="alert">
            <h2>Không thể ghi nhận lượt quét</h2>
            <p>{error}</p>
            <button
              type="button"
              className="btn"
              onClick={recordScan}
            >
              Thử lại
            </button>
          </div>
        )}
        <h1>{t('gu_title')}</h1>
        <p className="lead">{t('gu_sub')}</p>
        <div className="cta-row">
          <Link className="btn btn-primary" to="/demo">
            {t('gu_go')}
          </Link>
          <Link className="btn" to="/features">
            {t('h_cta2')}
          </Link>
          <Link className="btn" to="/register">
            {t('gu_signup')}
          </Link>
        </div>
      </div>
    </div>
  );
}