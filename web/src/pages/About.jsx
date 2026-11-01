import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';

const VALUES = ['v1', 'v2', 'v3'];

export default function About() {
  const { t } = useI18n();
  usePageTitle('a_title');
  return (
    <>
      <div className="wrap page-head">
        <h1>{t('a_title')}</h1>
      </div>
      <div className="wrap">
        <div className="prose">
          <p>{t('a_p1')}</p>
          <p>{t('a_p2')}</p>
        </div>
        <div className="values">
          <h2 className="sec" style={{ marginBottom: 20 }}>{t('a_v_title')}</h2>
          <div className="rows">
            {VALUES.map((k) => (
              <div className="row" key={k}>
                <h3>{t(k + '_t')}</h3>
                <p>{t(k + '_d')}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="cta-row" style={{ margin: '36px 0 88px' }}>
          <Link className="btn btn-primary" to="/demo">{t('a_cta')}</Link>
        </div>
      </div>
    </>
  );
}
