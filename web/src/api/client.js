/** SQL Server is accessed through the API. Only the signed session is kept locally. */
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const HAS_API = true;
export const SHARED = true;
const K_SESSION = 'dubchef-session';

export class ApiError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function errorKey(err) {
  if (err?.code === 'exists') return 'e_exists';
  if (err?.code === 'invalid' || err?.code === 'auth') return 'e_login';
  if (err?.code === 'locked') return 'e_locked';
  return 'e_net';
}

export const session = {
  load() {
    try {
      const value = JSON.parse(localStorage.getItem(K_SESSION));
      return value && typeof value.token === 'string' && value.token ? value : null;
    } catch { return null; }
  },
  save(user) {
    try {
      if (user?.token) localStorage.setItem(K_SESSION, JSON.stringify(user));
    } catch { /* A disabled storage must not prevent an in-memory session. */ }
  },
  clear() {
    try { localStorage.removeItem(K_SESSION); } catch { /* no storage */ }
  },
};

export async function request(path, { method = 'GET', body, token, headers = {}, raw = false, blob = false, signal } = {}) {
  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers: {
        ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('net');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.code || 'server', response.status);
  }
  if (blob) return response.blob();
  if (response.status === 204) return {};
  return response.json();
}

// Display hint only; permissions are checked from the active database user by the API.
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@dubchef.vn';
export const ADMIN_PASSWORD = '';
export const isAdmin = (user) => Boolean(user?.token && user.role === 'admin');

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  me: (token) => request('/api/auth/me', { token }),
  contact: (body) => request('/api/contact', { method: 'POST', body, token: session.load()?.token }),
};
