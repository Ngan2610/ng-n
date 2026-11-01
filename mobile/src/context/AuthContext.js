import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, session } from '../api/client';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    session.load().then((u) => { if (u) setUser(u); });
  }, []);

  const finish = useCallback(async (res) => {
    setUser(res.user);
    await session.save(res.user);
    return res.user;
  }, []);

  const login = useCallback(async (data) => finish(await api.login(data)), [finish]);
  const register = useCallback(async (data) => finish(await api.register(data)), [finish]);
  const logout = useCallback(async () => {
    setUser(null);
    await session.clear();
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
