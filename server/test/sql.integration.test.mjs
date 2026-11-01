import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import sql from 'mssql';
import { openRepo } from '../src/db.js';
import { createApp } from '../src/app.js';

const sqlConfig = (database) => ({
  server: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'sa', password: process.env.DB_PASSWORD, database,
  options: { encrypt: process.env.DB_ENCRYPT !== 'false', trustServerCertificate: process.env.DB_TRUST_CERT == null
    ? process.env.NODE_ENV !== 'production' : process.env.DB_TRUST_CERT === 'true' },
});

// Opt in only: DB_HOST/DB_PORT/DB_USER/DB_PASSWORD point at a development SQL Server.
// Always creates a fresh randomized database; never uses or drops DB_NAME supplied by the user.
test('SQL Server: dữ liệu khách hàng, nội dung admin, quyền truy cập và khởi động lại', {
  skip: process.env.DB_INTEGRATION !== 'true', timeout: 180000,
}, async () => {
  assert.ok(process.env.DB_PASSWORD, 'DB_INTEGRATION=true yêu cầu DB_PASSWORD của SQL Server phát triển.');
  const database = `DubchefIntegration_${process.pid}_${randomBytes(6).toString('hex')}`;
  const priorName = process.env.DB_NAME;
  const priorSkipCreate = process.env.DB_SKIP_CREATE;
  process.env.DB_NAME = database;
  delete process.env.DB_SKIP_CREATE;
  let repo;
  let server;
  const stop = async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
      server = null;
    }
    if (repo) { await repo.close(); repo = null; }
  };
  let base;
  const start = async () => {
    repo = await openRepo();
    server = createApp(repo, { secret: 'integration-test-secret-32-characters' }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body == null ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  try {
    await start();
    assert.equal((await call('GET', '/api/health')).data.db, true);
    await repo.ensureAdmin('admin@integration.example', 'AdminIntegration123!');
    const adminLogin = await call('POST', '/api/auth/login', { email: 'admin@integration.example', password: 'AdminIntegration123!' });
    assert.equal(adminLogin.status, 200);
    const admin = adminLogin.data.user;
    const registration = await call('POST', '/api/auth/register', { name: 'Khách Việt', email: 'KHACH@integration.example', password: 'KhachIntegration123!' });
    assert.equal(registration.status, 201);
    const customer = registration.data.user;
    assert.equal(customer.email, 'khach@integration.example');
    assert.equal((await repo.findUser(customer.email)).hash.includes('KhachIntegration123!'), false);
    assert.equal((await call('POST', '/api/auth/register', { name: 'Trùng', email: customer.email, password: 'KhachIntegration123!' })).status, 409);
    assert.equal((await call('POST', '/api/auth/login', { email: customer.email, password: 'wrong-password' })).status, 401);
    assert.equal((await call('POST', '/api/auth/login', { email: customer.email, password: 'KhachIntegration123!' })).status, 200);
    assert.ok((await repo.findUser(customer.email)).lastLogin);
    // Tài khoản do 05-sqlserver-tai-khoan.sql tạo phải đăng nhập được và được nâng cấp băm.
    const salt = randomBytes(16);
    const legacyPassword = 'MậtKhẩuIntegration123!';
    const legacyPool = await new sql.ConnectionPool(sqlConfig(database)).connect();
    let legacyHash;
    try {
      const generated = await legacyPool.request().input('salt', sql.VarBinary(16), salt)
        .input('password', sql.NVarChar(200), legacyPassword)
        .query(`SELECT 'sha256$' + CONVERT(VARCHAR(32), @salt, 2) + '$' +
          CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @salt + CONVERT(VARBINARY(400), @password)), 2) AS hash`);
      legacyHash = generated.recordset[0].hash;
    } finally { await legacyPool.close(); }
    assert.equal(legacyHash, `sha256$${salt.toString('hex').toUpperCase()}$${createHash('sha256').update(salt)
      .update(Buffer.from(legacyPassword, 'utf16le')).digest('hex').toUpperCase()}`);
    await repo.createUser({ name: 'Tài khoản SQL cũ', email: 'legacy@integration.example', passwordHash: legacyHash });
    assert.equal((await call('POST', '/api/auth/login', { email: 'legacy@integration.example', password: legacyPassword })).status, 200);
    assert.match((await repo.findUser('legacy@integration.example')).hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.equal((await call('POST', '/api/contact', { name: 'Khách vãng lai', email: 'other@integration.example', message: 'Email chưa được xác minh.' })).status, 201);
    const otherReg = await call('POST', '/api/auth/register', { name: 'Khách khác', email: 'other@integration.example', password: 'OtherIntegration123!' });
    const other = otherReg.data.user;
    const created = await call('POST', '/api/projects', {
      title: 'Món phở Việt', originalLanguage: 'vi', sourceName: 'pho.mp4',
      segments: [{ vi: 'Đun nước dùng.', en: 'Boil the broth.', start: 0, end: 3 }, { vi: 'Thêm bánh phở.', en: 'Add noodles.', start: 3, end: 6 }],
    }, customer.token);
    assert.equal(created.status, 201);
    const projectId = created.data.project.id;
    assert.equal((await repo.listProjects(customer.email)).length, 1);
    assert.equal((await call('GET', '/api/projects', null, other.token)).data.projects.length, 0);
    assert.equal((await call('GET', '/api/admin/subtitles', null, customer.token)).status, 403);

    const narration = (await call('GET', '/api/admin/narrations', null, admin.token)).data.narrations.find((n) => n.language === 'vi');
    assert.equal(narration.projectId, projectId);
    assert.equal((await call('PATCH', `/api/admin/narrations/${narration.id}`, { text: 'Lời thuyết minh đã duyệt.', status: 'ready' }, admin.token)).status, 200);
    const subtitle = (await call('GET', '/api/admin/subtitles', null, admin.token)).data.subtitles.find((s) => s.language === 'vi');
    assert.equal((await call('PATCH', `/api/admin/subtitles/${subtitle.id}`, { text: 'Đun nước dùng thật nóng.', start: 0.25, end: 3 }, admin.token)).status, 200);
    assert.equal((await call('PATCH', `/api/admin/subtitles/${subtitle.id}`, { text: 'Lỗi', start: 5, end: 1 }, admin.token)).status, 400);

    assert.equal((await call('POST', '/api/contact', { name: customer.name, email: customer.email, message: 'Xin kiểm tra bản dịch.' }, customer.token)).status, 201);
    const message = (await call('GET', '/api/admin/feedback', null, admin.token)).data.feedback[0];
    assert.equal(message.status, 'open');
    assert.equal((await call('PATCH', `/api/admin/feedback/${message.id}`, { reply: 'Chúng tôi đã cập nhật phụ đề.', status: 'replied' }, admin.token)).status, 200);
    assert.equal((await call('GET', '/api/account/messages', null, other.token)).data.messages.length, 0);
    assert.equal((await call('GET', '/api/account/messages', null, customer.token)).data.messages[0].reply, 'Chúng tôi đã cập nhật phụ đề.');

    const order = await call('POST', '/api/orders', { name: customer.name, email: customer.email, uploads: 1, outs: 1, L: 0 }, customer.token);
    assert.equal(order.status, 201);
    assert.equal((await call('POST', `/api/orders/${order.data.order.id}/pay`, { method: 'bank' }, other.token)).status, 404);
    assert.equal(await repo.payOrder(order.data.order.id, { method: 'bank', ref: 'NOT-AN-OWNER', email: other.email }), null);
    assert.equal((await repo.getOrder(order.data.order.id)).status, 'pending');
    assert.equal((await call('POST', `/api/orders/${order.data.order.id}/pay`, { method: 'bank' }, customer.token)).status, 503);
    assert.equal((await call('GET', '/api/orders', null, other.token)).data.orders.length, 0);

    // Reopen repository: migrations are repeatable and all records survive process/pool restart.
    await stop();
    await start();
    const saved = (await call('GET', '/api/projects', null, customer.token)).data.projects[0];
    assert.equal(saved.id, projectId);
    assert.equal(saved.segments[0].vi, 'Đun nước dùng thật nóng.');
    assert.equal(saved.segments[0].start, 0.25);
    assert.equal(saved.narrations.find((n) => n.language === 'vi').text, 'Lời thuyết minh đã duyệt.');
    assert.equal((await call('GET', '/api/account/messages', null, customer.token)).data.messages[0].status, 'replied');
    assert.equal((await repo.listOrders(customer.email)).length, 1);
    assert.equal((await repo.adminStatistics()).totalSubtitles, 4);
    assert.equal((await call('PATCH', '/api/admin/users', { email: customer.email, status: 'locked' }, admin.token)).status, 200);
    assert.equal((await call('GET', '/api/projects', null, customer.token)).status, 403);
    assert.equal((await call('POST', '/api/auth/login', { email: customer.email, password: 'KhachIntegration123!' })).status, 403);
    assert.equal((await call('DELETE', '/api/admin/users?email=' + encodeURIComponent(customer.email), null, admin.token)).status, 200);
    const recreated = await call('POST', '/api/auth/register', { name: 'Tài khoản mới', email: customer.email, password: 'NewAccountIntegration123!' });
    assert.equal(recreated.status, 201);
    assert.equal((await call('GET', '/api/projects', null, customer.token)).status, 401);
    assert.equal((await call('GET', '/api/account/messages', null, recreated.data.user.token)).data.messages.length, 0);
    assert.equal((await call('GET', '/api/orders', null, recreated.data.user.token)).data.orders.length, 0);
    assert.equal((await call('POST', `/api/orders/${order.data.order.id}/pay`, { method: 'bank' }, recreated.data.user.token)).status, 404);
    assert.equal(await repo.payOrder(order.data.order.id, { method: 'bank', ref: 'REUSED-EMAIL', email: customer.email }), null);
  } finally {
    await stop();
    try {
      // Identifier is generated above, validated again, never based on arbitrary env input.
      assert.match(database, /^DubchefIntegration_\d+_[a-f0-9]{12}$/);
      const master = await new sql.ConnectionPool(sqlConfig('master')).connect();
      try {
        await master.request().query(`IF DB_ID(N'${database}') IS NOT NULL BEGIN
          ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${database}]; END`);
      } finally { await master.close(); }
    } finally {
      if (priorName == null) delete process.env.DB_NAME; else process.env.DB_NAME = priorName;
      if (priorSkipCreate == null) delete process.env.DB_SKIP_CREATE; else process.env.DB_SKIP_CREATE = priorSkipCreate;
    }
  }
});
