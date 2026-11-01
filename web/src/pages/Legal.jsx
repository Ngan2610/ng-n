import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';

function LegalPage({ titleKey, prefix, count }) {
  const { t } = useI18n();
  usePageTitle(titleKey);
  const items = Array.from({ length: count }, (_, n) => prefix + (n + 1));
  return (
    <div className="wrap legal">
      <h1>{t(titleKey)}</h1>
      <p className="upd">{t('upd')}</p>
      {items.map((k) => (
        <section key={k}>
          <h2>{t(k + '_t')}</h2>
          <p>{t(k + '_d')}</p>
        </section>
      ))}
    </div>
  );
}

export const Terms = () => <LegalPage titleKey="tm_title" prefix="tm" count={4} />;
export const Privacy = () => <LegalPage titleKey="pv_title" prefix="pv" count={4} />;
