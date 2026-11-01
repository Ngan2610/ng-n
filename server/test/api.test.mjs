import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/auth.js';
import { createApp } from '../src/app.js';

// Repo giả trong bộ nhớ để thử các API mà không cần SQL Server.
function fakeRepo() {
  const users = [{ name: 'Admin', email: 'admin@x.vn', role: 'admin', status: 'active', at: new Date().toISOString(), hash: hashPassword('admin12345') }];
  const visits = [];
  const qrScans = [];
  return {
    visits,
    qrScans,
    findUser: async (e) => users.find((u) => u.email === e) || null,
    createUser: async ({ name, email, passwordHash, role = 'user' }) => {
      if (users.some((u) => u.email === email)) return null;
      const u = { name, email, role, status: 'active', at: new Date().toISOString(), hash: passwordHash };
      users.push(u);
      return u;
    },
    listUsers: async () => users,
    recordLogin: async () => {},
    setUserStatus: async (e, s) => { const u = users.find((x) => x.email === e && x.role === 'user'); if (u) u.status = s; return !!u; },
    deleteUser: async (e) => { const i = users.findIndex((x) => x.email === e && x.role === 'user'); if (i >= 0) users.splice(i, 1); return i >= 0; },
    addVisit: async (v) => { visits.push(v); },
    addQrScan: async (v) => { qrScans.push(v); },
    qrStats: async () => ({ days: [], period: { visitors: 3, views: 5 }, prev: { visitors: 0, views: 0 }, totals: { visitors: 4, views: 9 }, activeNow: 1 }),
    addMessage: async () => {},
    visitStats: async () => ({ days: [], period: { visitors: 1, views: 2 }, prev: { visitors: 0, views: 0 }, totals: { visitors: 1, views: 2 }, activeNow: 1 }),
  };
}

async function start() {
  const repo = fakeRepo();
  const server = createApp(repo, { secret: 's' }).listen(0);
  const base = 'http://localhost:' + server.address().port;
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  return { repo, call, close: () => server.close() };
}

test('đăng ký, đăng nhập, khóa, xóa và quyền quản trị', async () => {
  const { call, close } = await start();
  try {
    const reg = await call('POST', '/api/auth/register', { name: 'An', email: 'AN@x.vn', password: 'matkhau123' });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.role, 'user');
    assert.equal((await call('POST', '/api/auth/register', { name: 'An', email: 'an@x.vn', password: 'matkhau123' })).status, 409);
    assert.equal((await call('POST', '/api/auth/register', { name: 'An', email: 'b@x.vn', password: '123' })).status, 400);
    assert.equal((await call('POST', '/api/auth/login', { email: 'an@x.vn', password: 'sai' })).status, 401);

    const admin = (await call('POST', '/api/auth/login', { email: 'admin@x.vn', password: 'admin12345' })).data.user;
    assert.equal(admin.role, 'admin');

    // Không token hoặc token người thường thì không vào được
    assert.equal((await call('GET', '/api/admin/users')).status, 401);
    assert.equal((await call('GET', '/api/admin/users', null, reg.data.user.token)).status, 403);

    const list = await call('GET', '/api/admin/users', null, admin.token);
    assert.deepEqual(list.data.users.map((u) => u.email), ['an@x.vn']); // không lộ quản trị viên, không lộ mật khẩu
    assert.equal(Object.keys(list.data.users[0]).includes('hash'), false);

    assert.equal((await call('PATCH', '/api/admin/users', { email: 'an@x.vn', status: 'locked' }, admin.token)).status, 200);
    assert.equal((await call('POST', '/api/auth/login', { email: 'an@x.vn', password: 'matkhau123' })).data.code, 'locked');
    assert.equal((await call('PATCH', '/api/admin/users', { email: 'admin@x.vn', status: 'locked' }, admin.token)).status, 404);
    assert.equal((await call('DELETE', '/api/admin/users?email=an@x.vn', null, admin.token)).status, 200);
  } finally { close(); }
});

test('ghi lượt truy cập, bỏ qua trang admin, đọc tổng quan', async () => {
  const { repo, call, close } = await start();
  try {
    assert.equal((await call('POST', '/api/track', { visitorId: 'v1', path: '/pricing', lang: 'vi' })).status, 204);
    assert.equal((await call('POST', '/api/track', { visitorId: 'v1', path: '/admin', lang: 'vi' })).status, 204);
    assert.equal((await call('POST', '/api/track', { visitorId: '', path: '/x', lang: 'vi' })).status, 400);
    assert.equal(repo.visits.length, 1);

    const admin = (await call('POST', '/api/auth/login', { email: 'admin@x.vn', password: 'admin12345' })).data.user;
    assert.equal((await call('GET', '/api/admin/overview?days=7')).status, 401);
    const ov = await call('GET', '/api/admin/overview?days=14', null, admin.token);
    assert.equal(ov.status, 200);
    assert.equal(ov.data.stats.span, 14);
    assert.equal(ov.data.stats.series.length, 14);
  } finally { close(); }
});

test('ghi lượt quét mã QR của khách và chỉ admin mới xem được số liệu', async () => {
  const { repo, call, close } = await start();
  try {
    assert.equal((await call('POST', '/api/qr-scan', { visitorId: 'v1', lang: 'vi' })).status, 204);
    assert.equal((await call('POST', '/api/qr-scan', { visitorId: '', lang: 'vi' })).status, 400);
    assert.equal((await call('POST', '/api/qr-scan', { visitorId: 'v1', lang: 'VI!' })).status, 400);
    assert.equal((await call('POST', '/api/qr-scan', { visitorId: 'a b', lang: 'vi' })).status, 400);
    assert.deepEqual(repo.qrScans, [{ visitorId: 'v1', lang: 'vi' }]);

    const admin = (await call('POST', '/api/auth/login', { email: 'admin@x.vn', password: 'admin12345' })).data.user;
    const user = (await call('POST', '/api/auth/register', { name: 'An', email: 'an@x.vn', password: 'matkhau123' })).data.user;
    assert.equal((await call('GET', '/api/admin/qr?days=7')).status, 401);
    assert.equal((await call('GET', '/api/admin/qr?days=7', null, user.token)).status, 403);
    const qr = await call('GET', '/api/admin/qr?days=30', null, admin.token);
    assert.equal(qr.status, 200);
    assert.equal(qr.data.stats.series.length, 30);
    assert.deepEqual(qr.data.stats.period, { visitors: 3, views: 5 });
    assert.deepEqual(qr.data.stats.total, { visitors: 4, views: 9 });
  } finally { close(); }
});
