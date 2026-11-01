import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';

export default function NotFound() {
  const { t } = useI18n();
  usePageTitle('nf_title');
  return (
    <div className="wrap nf">
      <h1>{t('nf_title')}</h1>
      <p>{t('nf_d')}</p>
      <Link className="btn btn-primary" to="/">{t('nf_btn')}</Link>
    </div>
  );
}
