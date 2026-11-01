import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';

const FEATURES = ['fa', 'fb', 'fc', 'fd', 'fe', 'ff'];
const EXPORTS = ['ex_mp4', 'ex_srt', 'ex_mp3'];

export default function Features() {
  const { t } = useI18n();
  usePageTitle('ft_title');
  return (
    <>
      <div className="wrap page-head">
        <h1>{t('ft_title')}</h1>
        <p>{t('ft_sub')}</p>
      </div>
      <div className="wrap">
        <div className="rows">
          {FEATURES.map((k) => (
            <div className="row" key={k}>
              <h3>{t(k + '_t')}</h3>
              <p>{t(k + '_d')}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="section">
        <div className="wrap">
          <h2 className="sec">{t('ex_title')}</h2>
          <ul className="exports">
            {EXPORTS.map((k) => <li key={k}>{t(k)}</li>)}
          </ul>
          <div className="cta-row">
            <Link className="btn btn-primary" to="/demo">{t('h_cta1')}</Link>
          </div>
        </div>
      </div>
    </>
  );
}
