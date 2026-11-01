import { vi } from 'vitest';

export const ADMIN = { name: 'Admin', email: 'admin@example.com', role: 'admin', status: 'active', token: 'admin-token' };
export const CUSTOMER = { name: 'An', email: 'an@example.com', role: 'user', status: 'active', token: 'customer-token' };

export function saveSession(user = CUSTOMER) {
  localStorage.setItem('dubchef-session', JSON.stringify(user));
}

/** Network fixture for UI tests. Application code never uses this in-memory data. */
export function installMockBackend({ users = [], paymentDemo = true } = {}) {
  const state = {
    users: [
      { ...ADMIN, password: 'admin-password' },
      ...users,
    ],
    orders: [], messages: [], visits: [], scans: [], failures: new Map(), calls: [],
  };
  const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
  const publicUser = ({ password: _password, ...user }) => user;
  const stats = (span, qr = false) => {
    const n = qr ? state.scans.length : 20;
    const views = qr ? n : 35;
    const series = Array.from({ length: span }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, visitors: i === span - 1 ? n : 0, views: i === span - 1 ? views : 0 }));
    return { span, today: { visitors: n, views }, yesterday: { visitors: 0, views: 0 }, period: { visitors: n, views }, prev: { visitors: 10, views: 10 }, total: { visitors: n, views }, activeNow: n, series, peak: { date: series.at(-1).date, visitors: n } };
  };
  state.fetch = vi.fn(async (input, options = {}) => {
    const url = new URL(String(input), 'http://test.local');
    const path = url.pathname;
    const method = options.method || 'GET';
    const headers = new Headers(options.headers || {});
    const token = (headers.get('Authorization') || '').replace(/^Bearer /, '');
    const who = state.users.find((u) => u.token === token);
    const body = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : null;
    state.calls.push({ path, url, method, headers, body });
    if (state.failures.has(path)) return response({ code: 'server' }, state.failures.get(path));
    if (path === '/api/auth/register') {
      const email = body.email.toLowerCase();
      if (state.users.some((u) => u.email === email)) return response({ code: 'exists' }, 409);
      const user = { ...body, email, role: 'user', status: 'active', token: `token-${email}`, at: new Date().toISOString() };
      state.users.push(user);
      return response({ user: publicUser(user) }, 201);
    }
    if (path === '/api/auth/login') {
      const user = state.users.find((u) => u.email === body.email.toLowerCase() && u.password === body.password);
      if (!user) return response({ code: 'invalid' }, 401);
      if (user.status === 'locked') return response({ code: 'locked' }, 403);
      return response({ user: publicUser(user) });
    }
    if (path === '/api/auth/me') {
      if (!who) return response({ code: 'auth' }, 401);
      if (who.status === 'locked') return response({ code: 'locked' }, 403);
      return response({ user: publicUser(who) });
    }
    if (path === '/api/contact') { state.messages.push(body); return response({ ok: true }, 201); }
    if (path === '/api/track') { state.visits.push(body); return response({}, 204); }
    if (path === '/api/qr-scan') { state.scans.push(body); return response({}, 204); }
    if (path.startsWith('/api/admin/')) {
      if (!who) return response({ code: 'auth' }, 401);
      if (who.role !== 'admin') return response({ code: 'forbidden' }, 403);
      if (path === '/api/admin/users') {
        if (method === 'PATCH') {
          const user = state.users.find((u) => u.email === body.email && u.role === 'user');
          if (!user) return response({ code: 'not_found' }, 404);
          user.status = body.status;
          return response({ ok: true });
        }
        if (method === 'DELETE') { state.users = state.users.filter((u) => u.email !== url.searchParams.get('email')); return response({ ok: true }); }
        return response({ users: state.users.filter((u) => u.role === 'user').map(publicUser) });
      }
      if (path === '/api/admin/overview' || path === '/api/admin/qr') return response({ stats: stats(Number(url.searchParams.get('days')) || 7, path.endsWith('/qr')) });
      if (path === '/api/admin/statistics') return response({ statistics: { totalUsers: state.users.length, totalVideos: 2, totalLanguages: 3, totalQrScans: state.scans.length, totalVisits: 35 } });
    }
    if (path === '/api/orders' || /^\/api\/orders\/\d+\/pay$/.test(path)) {
      if (!who) return response({ code: 'auth' }, 401);
      if (method === 'GET') return response({ orders: state.orders.filter((o) => o.email === who.email) });
      if (path === '/api/orders') {
        const prices = [20000, 80, 600];
        const translationPrices = [10000, 40, 300];
        const order = { ...body, name: who.name, email: who.email, id: state.orders.length + 1, status: 'pending', currency: ['VND', 'USD', 'CNY'][body.L], amountMinor: body.uploads * prices[body.L] + body.outs * translationPrices[body.L], createdAt: new Date().toISOString() };
        state.orders.push(order);
        return response({ order }, 201);
      }
      if (!paymentDemo) return response({ code: 'payment_unavailable' }, 503);
      const order = state.orders.find((o) => o.id === Number(path.split('/')[3]) && o.email === who.email);
      if (!order || order.status !== 'pending') return response({ code: 'not_payable' }, 409);
      order.status = 'paid'; order.ref = body.method.toUpperCase() + '-TEST-REFERENCE';
      return response({ order, payment: { method: body.method, ref: order.ref } });
    }
    throw new Error(`Unexpected API call: ${method} ${path}`);
  });
  vi.stubGlobal('fetch', state.fetch);
  return state;
}
