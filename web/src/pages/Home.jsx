import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import QrCode from '../components/QrCode.jsx';
import { guestUrl } from '../api/qr.js';

const STEPS = ['s1', 's2', 's3', 's4'];
const BANDS = [
  ['vi', 'Tiếng Việt', 'l_vi_d'],
  ['en', 'English', 'l_en_d'],
  ['zh', '中文', 'l_zh_d'],
];

export default function Home() {
  const { t } = useI18n();
  usePageTitle('pt_home');

  return (
    <>
      <div className="hero">
        <div className="wrap hero-center">
          <h1>{t('h_title')}</h1>
          <p className="lead">{t('h_sub')}</p>
          <div className="cta-row">
            <Link className="btn btn-primary" to="/demo">{t('h_cta1')}</Link>
            <Link className="btn" to="/features">{t('h_cta2')}</Link>
          </div>
        </div>
      </div>

      <div className="section alt">
        <div className="wrap">
          <h2 className="sec">{t('how_title')}</h2>
          <ol className="steps">
            {STEPS.map((k, n) => (
              <li key={k}>
                <div className="n">{n + 1}</div>
                <h3>{t(k + 't')}</h3>
                <p>{t(k + 'd')}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <h2 className="sec">{t('langs_title')}</h2>
          <div className="bands">
            {BANDS.map(([lang, name, key]) => (
              <div className={'band ' + lang} key={lang}>
                <div className="name" lang={lang === 'zh' ? 'zh-CN' : lang}>{name}</div>
                <p>{t(key)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap qr-home">
          <QrCode value={guestUrl()} label={t('qh_alt')} size={176} testId="home-qr" />
          <div>
            <h2 className="sec">{t('qh_title')}</h2>
            <p className="lead">{t('qh_sub')}</p>
          </div>
        </div>
      </div>

      <div className="section alt cta-band">
        <div className="wrap">
          <h2>{t('cta_title')}</h2>
          <p>{t('cta_sub')}</p>
          <Link className="btn btn-primary" to="/register">{t('cta_btn')}</Link>
        </div>
      </div>
    </>
  );
}
