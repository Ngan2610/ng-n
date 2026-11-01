import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';

const ITEMS = [1, 2, 3, 4, 5, 6];

export default function Faq() {
  const { t } = useI18n();
  usePageTitle('fq_title');
  return (
    <>
      <div className="wrap page-head">
        <h1>{t('fq_title')}</h1>
      </div>
      <div className="wrap">
        <div className="faq">
          {ITEMS.map((n) => (
            <details key={n}>
              <summary>{t('q' + n)}</summary>
              <p>{t('a' + n)}</p>
            </details>
          ))}
        </div>
        <div style={{ margin: '40px 0 88px' }}>
          <p style={{ marginBottom: 14, fontWeight: 600 }}>{t('fq_more')}</p>
          <Link className="btn" to="/contact">{t('nav_contact')}</Link>
        </div>
      </div>
    </>
  );
}
