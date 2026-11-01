import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, session } from '../api/client.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(session.load()));
  const [authError, setAuthError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sessionGeneration = useRef(0);

  useEffect(() => {
    const saved = session.load();
    if (!saved) { setLoading(false); return undefined; }
    let live = true;
    const generation = sessionGeneration.current;
    setLoading(true);
    api.me(saved.token).then(({ user: current }) => {
      if (!live || generation !== sessionGeneration.current) return;
      const checked = { ...current, token: saved.token };
      setUser(checked);
      session.save(checked);
      setAuthError(false);
    }).catch((error) => {
      if (!live || generation !== sessionGeneration.current) return;
      setUser(null);
      if ([401, 403].includes(error.status)) session.clear();
      else setAuthError(true);
    }).finally(() => { if (live && generation === sessionGeneration.current) setLoading(false); });
    return () => { live = false; };
  }, [attempt]);

  const finish = useCallback((res) => {
    sessionGeneration.current += 1;
    setLoading(false);
    setUser(res.user);
    session.save(res.user);
    setAuthError(false);
    return res.user;
  }, []);
  const login = useCallback(async (data) => finish(await api.login(data)), [finish]);
  const register = useCallback(async (data) => finish(await api.register(data)), [finish]);
  const logout = useCallback(() => { sessionGeneration.current += 1; setLoading(false); setUser(null); session.clear(); setAuthError(false); }, []);
  const retrySession = useCallback(() => setAttempt((n) => n + 1), []);
  const value = useMemo(() => ({ user, loading, authError, retrySession, login, register, logout }),
    [user, loading, authError, retrySession, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
