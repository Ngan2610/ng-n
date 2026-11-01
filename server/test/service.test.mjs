import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { makeToken, hashPassword, verifyPassword, readToken } from '../src/auth.js';
import { validateProject } from '../src/serviceRoutes.js';

async function fixture(options = {}) {
  const users = [
    { id: 1, email: 'one@example.com', name: 'One', role: 'user', status: 'active' },
    { id: 2, email: 'two@example.com', name: 'Two', role: 'user', status: 'active' },
    { id: 3, email: 'admin@example.com', name: 'Admin', role: 'admin', status: 'active' },
  ];
  const projects = [], orders = [], messages = [];
  const repo = {
    findUser: async (email) => users.find((u) => u.email === email),
    recordLogin: async (email) => { users.find((u) => u.email === email).lastLogin = 'now'; },
    createOrder: async (o) => { const value = { ...o, ownerId: users.find((u) => u.email === o.email).id, id: orders.length + 1, status: 'pending' }; orders.push(value); return value; },
    getOrder: async (id) => orders.find((o) => o.id === id),
    listOrders: async (email) => orders.filter((o) => o.email === email),
    payOrder: async (id, { email }) => {
      const order = orders.find((o) => o.id === id && o.email === email && o.status === 'pending');
      if (!order) return null;
      order.status = 'paid'; return { order };
    },
    createProject: async (email, p) => { const value = { ...p, email, id: projects.length + 1 }; projects.push(value); return value; },
    listProjects: async (email) => projects.filter((p) => p.email === email),
    addMessage: async (m) => { messages.push(m); },
    listMessages: async (email) => messages.filter((m) => m.ownerEmail === email),
    listNarrations: async () => [{ id: 1, text: 'Gốc', status: 'draft' }],
    updateNarration: async (id, v) => id === 1 ? { id, ...v } : null,
    listSubtitles: async () => [{ id: 1, text: 'Gốc', start: null, end: null }],
    updateSubtitle: async (id, v) => id === 1 ? { id, ...v } : null,
    listFeedback: async () => messages,
    replyFeedback: async (id, v) => id === 1 ? { id, ...v } : null,
  };
  const uploadDir = await mkdtemp(join(tmpdir(), 'dubchef-api-'));
  const server = createApp(repo, { secret: 'test', uploadDir, ...options }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const tokens = users.map((u) => makeToken(u, 'test'));
  const call = async (method, path, body, user = 0, raw = false, extra = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(user !== null ? { Authorization: 'Bearer ' + tokens[user] } : {}), 'Content-Type': raw ? 'video/mp4' : 'application/json', ...extra },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return { repo, users, projects, orders, messages, tokens, call, base, uploadDir, close: async () => {
    await new Promise((resolve) => server.close(resolve)); await rm(uploadDir, { recursive: true, force: true });
  } };
}
const project = { title: 'Nấu cơm', originalLanguage: 'vi', sourceName: 'com.mp4', segments: [{ vi: 'Xin chào', en: 'Hello', start: 0, end: 3 }] };

test('project validation rejects oversized, invalid timestamps and empty transcripts', () => {
  assert.equal(validateProject({ ...project, segments: [] }), null);
  assert.equal(validateProject({ ...project, originalLanguage: 'bad' }), null);
  assert.equal(validateProject({ ...project, segments: [{ vi: 'a', start: 3, end: 2 }] }), null);
  assert.equal(validateProject({ ...project, segments: [{ vi: 'a'.repeat(4001) }] }), null);
  assert.equal(validateProject({ ...project, segments: Array.from({ length: 1001 }, () => ({ vi: 'a' })) }), null);
  assert.ok(validateProject(project));
});

test('projects are scoped to authenticated SQL user; locked, deleted and demoted tokens stop working', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('POST', '/api/projects', project, null)).status, 401);
    assert.equal((await f.call('POST', '/api/projects', project)).status, 201);
    assert.equal((await f.call('GET', '/api/projects', undefined, 1)).data.projects.length, 0);
    assert.equal((await f.call('GET', '/api/projects?email=one@example.com', undefined, 1)).data.projects.length, 0);
    assert.equal((await f.call('GET', '/api/admin/narrations')).status, 403);
    assert.equal((await f.call('GET', '/api/admin/narrations', undefined, 2)).status, 200);
    f.users[2].role = 'user';
    assert.equal((await f.call('GET', '/api/admin/narrations', undefined, 2)).status, 403);
    f.users[0].status = 'locked';
    assert.equal((await f.call('GET', '/api/projects')).status, 403);
    f.users.splice(0, 1);
    assert.equal((await f.call('GET', '/api/projects')).status, 401);
    f.users.push({ id: 99, email: 'one@example.com', name: 'Recreated', role: 'user', status: 'active' });
    assert.equal((await f.call('GET', '/api/projects')).status, 401);
  } finally { await f.close(); }
});

test('uploaded video remains private and only its owner can attach it to a project', async () => {
  const f = await fixture();
  try {
    const upload = await f.call('POST', '/api/uploads', Buffer.from('test-video'), 0, true, { 'X-File-Name': encodeURIComponent('cơm.mp4') });
    assert.equal(upload.status, 201);
    assert.equal(upload.data.filename, 'cơm.mp4');
    const own = await fetch(f.base + upload.data.url, { headers: { Authorization: 'Bearer ' + f.tokens[0] } });
    assert.equal(own.status, 200); assert.equal(await own.text(), 'test-video');
    assert.equal((await f.call('GET', upload.data.url, undefined, 1)).status, 404);
    assert.equal((await f.call('GET', upload.data.url, undefined, null)).status, 401);
    assert.equal((await f.call('POST', '/api/projects', { ...project, videoUrl: upload.data.url }, 1)).status, 400);
    assert.equal((await f.call('POST', '/api/projects', { ...project, videoUrl: upload.data.url })).status, 201);
    assert.equal((await f.call('POST', '/api/projects', { ...project, videoUrl: 'https://evil.test/v.mp4' })).status, 400);
    assert.equal((await f.call('POST', '/api/uploads', Buffer.from('html'), 0, true, { 'Content-Type': 'text/html' })).status, 415);
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(0), 0, true)).status, 400);
  } finally { await f.close(); }
});

test('order identity cannot be forged and payment simulation is opt-in', async () => {
  const f = await fixture({ paymentDemo: false });
  try {
    const order = await f.call('POST', '/api/orders', { name: 'Someone', email: 'two@example.com', uploads: 1, outs: 1, L: 0 });
    assert.equal(order.status, 201); assert.equal(order.data.order.email, 'one@example.com');
    assert.equal((await f.call('GET', '/api/orders?email=one@example.com', undefined, 1)).data.orders.length, 0);
    assert.equal((await f.call('POST', '/api/orders/1/pay', { method: 'qr' }, 1)).status, 404);
    const disabled = await f.call('POST', '/api/orders/1/pay', { method: 'qr' });
    assert.equal(disabled.status, 503); assert.equal(disabled.data.code, 'payment_unavailable');
    assert.equal(f.orders[0].status, 'pending');
  } finally { await f.close(); }
  const demo = await fixture({ paymentDemo: true });
  try {
    await demo.call('POST', '/api/orders', { uploads: 1, outs: 1, L: 0 });
    assert.equal((await demo.call('POST', '/api/orders/1/pay', { method: 'qr' })).data.order.status, 'paid');
    assert.equal((await demo.call('POST', '/api/orders/1/pay', { method: 'qr' })).status, 409);
  } finally { await demo.close(); }
});

test('admin validates changes and customer feedback uses authenticated identity', async () => {
  const f = await fixture();
  try {
    await f.call('POST', '/api/contact', { name: 'Forged', email: 'two@example.com', message: 'Hỗ trợ' });
    assert.equal(f.messages[0].email, 'one@example.com');
    assert.equal((await f.call('GET', '/api/account/messages', undefined, 1)).data.messages.length, 0);
    assert.equal((await f.call('GET', '/api/account/messages')).data.messages.length, 1);
    await f.call('POST', '/api/contact', { name: 'Anonymous', email: 'one@example.com', message: 'Unverified' }, null);
    assert.equal((await f.call('GET', '/api/account/messages')).data.messages.length, 1);
    assert.equal((await f.call('PATCH', '/api/admin/narrations/1', { text: 'Mới', status: 'ready' }, 2)).status, 200);
    assert.equal((await f.call('PATCH', '/api/admin/narrations/1', { text: '', status: 'ready' }, 2)).status, 400);
    assert.equal((await f.call('PATCH', '/api/admin/narrations/2', { text: 'Mới', status: 'ready' }, 2)).status, 404);
    assert.equal((await f.call('PATCH', '/api/admin/subtitles/1', { text: 'Mới', start: 2, end: 1 }, 2)).status, 400);
    assert.equal((await f.call('PATCH', '/api/admin/subtitles/1', { text: 'Mới', start: null, end: null }, 2)).status, 200);
    assert.equal((await f.call('PATCH', '/api/admin/feedback/1', { reply: '', status: 'replied' }, 2)).status, 400);
    assert.equal((await f.call('PATCH', '/api/admin/feedback/1', { reply: 'Đã sửa', status: 'replied' }, 2)).status, 200);
  } finally { await f.close(); }
});

test('malformed stored password and malformed token fail closed', () => {
  for (const value of ['', 'xx:yy', '0:123', hashPassword('secret') + ':junk']) {
    assert.equal(verifyPassword('secret', value), false);
  }
  assert.equal(readToken(makeToken({ email: 'a@b.co', role: 'admin' }, 's') + '.extra', 's'), null);
});


test('bad JSON, oversized transcripts and repeated login attempts return actionable status codes', async () => {
  const f = await fixture();
  try {
    const malformed = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400); assert.equal((await malformed.json()).code, 'invalid_json');
    const oversized = await f.call('POST', '/api/projects', { ...project, title: 'a'.repeat(1024 * 1024 + 1) });
    assert.equal(oversized.status, 413); assert.equal(oversized.data.code, 'too_large');
    for (let i = 0; i < 60; i++) assert.equal((await f.call('POST', '/api/auth/login', { email: 'missing@example.com', password: 'wrong' })).status, 401);
    assert.equal((await f.call('POST', '/api/auth/login', { email: 'missing@example.com', password: 'wrong' })).status, 429);
  } finally { await f.close(); }
});


test('streamed uploads enforce per-file and aggregate quotas and leave no failed files', async () => {
  const f = await fixture({ uploadQuotaBytes: 12, totalUploadQuotaBytes: 20, maxUploadBytes: 10 });
  try {
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(11), 0, true)).data.code, 'too_large');
    const chunked = await fetch(f.base + '/api/uploads', { method: 'POST', headers: { Authorization: 'Bearer ' + f.tokens[0], 'Content-Type': 'video/mp4' }, body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(11)); c.close(); } }), duplex: 'half' });
    assert.equal(chunked.status, 413); assert.equal((await chunked.json()).code, 'too_large');
    assert.equal((await readdir(f.uploadDir)).length, 0);
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(8), 0, true)).status, 201);
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(5), 0, true)).data.code, 'upload_quota');
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(4), 0, true)).status, 201);
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(1), 0, true)).data.code, 'upload_quota');
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(9), 1, true)).data.code, 'upload_quota');
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(8), 1, true)).status, 201);
    assert.equal((await f.call('POST', '/api/uploads', Buffer.alloc(1), 2, true)).data.code, 'upload_quota');
  } finally { await f.close(); }
});


test('legacy SQL UTF16LE password hash verifies then upgrades to scrypt at login', async () => {
  const legacy = 'sha256$00112233445566778899AABBCCDDEEFF$932491FFDA2442710160111D14336F73872960894BD05D50EA6EF6C8CB0A28B9';
  assert.equal(verifyPassword('mậtKhẩu123!', legacy), true);
  assert.equal(verifyPassword('wrong', legacy), false);
  const f = await fixture();
  try {
    f.users[0].hash = legacy;
    let updated = false;
    f.repo.updatePasswordHash = async (email, newHash, oldHash) => {
      assert.equal(email, f.users[0].email); assert.equal(oldHash, legacy);
      assert.equal(verifyPassword('mậtKhẩu123!', newHash), true);
      assert.equal(newHash.startsWith('sha256$'), false);
      f.users[0].hash = newHash; updated = true; return true;
    };
    assert.equal((await f.call('POST', '/api/auth/login', { email: f.users[0].email, password: 'mậtKhẩu123!' })).status, 200);
    assert.equal(updated, true);
    assert.equal((await f.call('POST', '/api/auth/login', { email: f.users[0].email, password: 'mậtKhẩu123!' })).status, 200);
  } finally { await f.close(); }
});


test('corrupt upload metadata denies access while further uploads remain available', async () => {
  const f = await fixture();
  try {
    const upload = await f.call('POST', '/api/uploads', Buffer.from('video'), 0, true);
    assert.equal(upload.status, 201);
    const filename = upload.data.url.split('/').at(-1);
    await writeFile(join(f.uploadDir, filename + '.json'), '{');
    assert.equal((await f.call('GET', upload.data.url)).status, 404);
    assert.equal((await f.call('POST', '/api/uploads', Buffer.from('next'), 0, true)).status, 201);
  } finally { await f.close(); }
});
