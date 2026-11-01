import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I, LANGS } from '../shared/i18n.js';

const Ctx = createContext(null);
const HTML_LANG = ['vi', 'en', 'zh-CN'];

export function I18nProvider({ children }) {
  const [L, setL] = useState(() => {
    try {
      const i = LANGS.indexOf(localStorage.getItem('dubchef-lang'));
      return i > -1 ? i : 0;
    } catch (e) {
      return 0;
    }
  });

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[L];
    try { localStorage.setItem('dubchef-lang', LANGS[L]); } catch (e) { /* bỏ qua */ }
  }, [L]);

  const t = useCallback((key) => (I[key] ? I[key][L] : key), [L]);
  const value = useMemo(() => ({ L, lang: LANGS[L], setL, t }), [L, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
