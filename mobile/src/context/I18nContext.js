import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I, LANGS } from '../shared/i18n';

const Ctx = createContext(null);

export function I18nProvider({ children }) {
  const [L, setLState] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('dubchef-lang')
      .then((v) => {
        const i = LANGS.indexOf(v);
        if (i > -1) setLState(i);
      })
      .catch(() => {});
  }, []);

  const setL = useCallback((n) => {
    setLState(n);
    AsyncStorage.setItem('dubchef-lang', LANGS[n]).catch(() => {});
  }, []);

  const t = useCallback((key) => (I[key] ? I[key][L] : key), [L]);
  const value = useMemo(() => ({ L, lang: LANGS[L], setL, t }), [L, setL, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
