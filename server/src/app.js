// Các đường dẫn API. `repo` là lớp truy cập CSDL (db.js), tách ra để dễ thay khi kiểm thử.
import express from 'express';
import cors from 'cors';
import { METHODS, newTransactionRef, priceOrder, validateOrder } from './orders.js';
import { hashPassword, makeToken, readToken, verifyPassword } from './auth.js';
import { buildStats } from './stats.js';
import { installServiceRoutes } from './serviceRoutes.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const publicUser = (u, secret) => ({ name: u.name, email: u.email, role: u.role, token: makeToken(u, secret) });

export function createApp(repo, { corsOrigin = '*', secret = 'dev-secret', tz = 7, paymentDemo = process.env.PAYMENT_DEMO === 'true', uploadDir, uploadQuotaBytes, totalUploadQuotaBytes, maxUploadBytes, maxConcurrentUploads } = {}) {
  const app = express();
  app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()) }));
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Quyền luôn đọc lại từ SQL: token của tài khoản bị khóa/xóa không còn sử dụng được.
  const authenticated = wrap(async (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    const who = m && readToken(m[1], secret);
    if (!who) return res.status(401).json({ code: 'auth' });
    const user = await repo.findUser(who.email);
    if (!user || (user.id != null && user.id !== who.id)) return res.status(401).json({ code: 'auth' });
    if (user.status !== 'active') return res.status(403).json({ code: 'locked' });
    req.user = user;
    next();
  });
  const adminOnly = [authenticated, (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ code: 'forbidden' });
    next();
  }];

  installServiceRoutes(app, repo, { authenticated, adminOnly, uploadDir, uploadQuotaBytes, totalUploadQuotaBytes, maxUploadBytes, maxConcurrentUploads });

  app.get('/api/auth/me', authenticated, (req, res) => {
    const { name, email, role, status, at, lastLogin } = req.user;
    res.json({ user: { name, email, role, status, at, lastLogin } });
  });

  app.get('/api/health', wrap(async (req, res) => {
    try {
      await repo.ping();
      res.json({ ok: true, db: true });
    } catch (e) {
      res.status(503).json({ ok: false, db: false });
    }
  }));

  // Tạo đơn: giá do máy chủ tính, trạng thái "pending"
  app.post('/api/orders', authenticated, wrap(async (req, res) => {
    const v = validateOrder({ ...req.body, name: req.user.name, email: req.user.email });
    if (v.error) return res.status(400).json({ code: v.error });
    const order = await repo.createOrder({ ...v.value, ...priceOrder(v.value) });
    res.status(201).json({ order });
  }));

  // Thanh toán giả lập: không nhận số thẻ, chỉ ghi phương thức và mã giao dịch
  app.post('/api/orders/:id/pay', authenticated, wrap(async (req, res) => {
    const id = Number(req.params.id);
    const method = req.body && req.body.method;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ code: 'invalid' });
    if (!METHODS.includes(method)) return res.status(400).json({ code: 'method' });
    const order = await repo.getOrder(id);
    if (!order || order.email !== req.user.email || (req.user.id != null && order.ownerId !== req.user.id)) return res.status(404).json({ code: 'not_found' });
    if (!paymentDemo) return res.status(503).json({ code: 'payment_unavailable' });
    const result = await repo.payOrder(id, { method, ref: newTransactionRef(method), email: req.user.email });
    if (!result) return res.status(409).json({ code: 'not_payable' });
    res.json(result);
  }));

  // Không chấp nhận email do client gửi để đọc dữ liệu người khác.
  app.get('/api/orders', authenticated, wrap(async (req, res) => {
    const email = req.user.email;
    res.json({ orders: await repo.listOrders(email) });
  }));

  // Giới hạn thử mật khẩu trong bộ nhớ của API; không tin X-Forwarded-For do client tự gửi.
  const attempts = new Map();
  const authLimit = (req, res, next) => {
    const now = Date.now();
    if (attempts.size > 10000) for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
    const key = req.ip;
    const old = attempts.get(key);
    const item = old && old.until > now ? old : { count: 0, until: now + 15 * 60000 };
    item.count++;
    attempts.set(key, item);
    if (item.count > 60) {
      res.set('Retry-After', String(Math.ceil((item.until - now) / 1000)));
      return res.status(429).json({ code: 'rate_limited' });
    }
    next();
  };

  // ---- Tài khoản ----
  app.post('/api/auth/register', authLimit, wrap(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (typeof b.name !== 'string' || typeof b.email !== 'string' || typeof b.password !== 'string' || !name || name.length > 100 || !EMAIL.test(email) || email.length > 254 || password.length < 8 || password.length > 200) {
      return res.status(400).json({ code: 'invalid' });
    }
    const user = await repo.createUser({ name, email, passwordHash: hashPassword(password) });
    if (!user) return res.status(409).json({ code: 'exists' });
    res.status(201).json({ user: publicUser(user, secret) });
  }));

  app.post('/api/auth/login', authLimit, wrap(async (req, res) => {
    const b = req.body || {};
    if (typeof b.email !== 'string' || b.email.length > 254 || typeof b.password !== 'string' || b.password.length > 200) return res.status(400).json({ code: 'invalid' });
    const user = await repo.findUser(b.email.trim().toLowerCase());
    if (!user || !verifyPassword(String(b.password || ''), user.hash)) return res.status(401).json({ code: 'invalid' });
    if (user.status !== 'active') return res.status(403).json({ code: 'locked' });
    if (/^sha256\$/i.test(user.hash) && repo.updatePasswordHash) await repo.updatePasswordHash(user.email, hashPassword(b.password), user.hash);
    await repo.recordLogin(user.email);
    res.json({ user: publicUser(user, secret) });
  }));

  app.post('/api/contact', (req, res, next) => req.get('authorization') ? authenticated(req, res, next) : next(), wrap(async (req, res) => {
    const b = req.body || {};
    const name = req.user ? req.user.name : String(b.name || '').trim();
    const email = req.user ? req.user.email : String(b.email || '').trim().toLowerCase();
    const body = String(b.message || '').trim();
    if (typeof b.message !== 'string' || (!req.user && (typeof b.name !== 'string' || typeof b.email !== 'string')) || !name || name.length > 100 || !EMAIL.test(email) || email.length > 254 || !body || body.length > 2000) return res.status(400).json({ code: 'invalid' });
    await repo.addMessage({ name, email, body, ownerEmail: req.user ? req.user.email : null });
    res.status(201).json({ ok: true });
  }));

  // ---- Đếm truy cập ----
  app.post('/api/track', wrap(async (req, res) => {
    const b = req.body || {};
    const visitorId = String(b.visitorId || '');
    const path = String(b.path || '');
    const lang = String(b.lang || '');
    if (!/^[\w-]{1,64}$/.test(visitorId) || !path.startsWith('/') || path.length > 200 || !/^[a-z]{2,8}$/.test(lang)) {
      return res.status(400).json({ code: 'invalid' });
    }
    if (path.startsWith('/admin')) return res.status(204).end();
    await repo.addVisit({ visitorId, path, lang });
    res.status(204).end();
  }));

  // ---- Đếm lượt quét mã QR của khách (trang /guest) ----
  app.post('/api/qr-scan', wrap(async (req, res) => {
    const b = req.body || {};
    const visitorId = String(b.visitorId || '');
    const lang = String(b.lang || '');
    if (!/^[\w-]{1,64}$/.test(visitorId) || !/^[a-z]{2,8}$/.test(lang)) return res.status(400).json({ code: 'invalid' });
    await repo.addQrScan({ visitorId, lang });
    res.status(204).end();
  }));

  // ---- Trang quản trị ----
  app.get('/api/admin/overview', adminOnly, wrap(async (req, res) => {
    const span = [7, 14, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    const raw = await repo.visitStats(span, tz);
    res.json({ stats: buildStats(raw, Date.now(), span, tz) });
  }));

  // Số người quét mã QR của khách: cùng dạng với /overview (visitors = người quét, views = lượt quét)
  app.get('/api/admin/qr', adminOnly, wrap(async (req, res) => {
    const span = [7, 14, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    const raw = await repo.qrStats(span, tz);
    res.json({ stats: buildStats(raw, Date.now(), span, tz) });
  }));

  app.get('/api/admin/users', adminOnly, wrap(async (req, res) => {
    const users = (await repo.listUsers()).filter((u) => u.role === 'user');
    res.json({ users: users.map(({ name, email, at, status }) => ({ name, email, at, status })) });
  }));

  // API thống kê tổng quan Admin từ SQL Server
  app.get('/api/admin/statistics', adminOnly, wrap(async (req, res) => {
    const statistics = await repo.adminStatistics();

    res.json({
      success: true,
      statistics
    });
  }));

  app.get('/api/admin/videos', adminOnly, wrap(async (req, res) => {
    const videos = await repo.listVideos();
    res.json({
      videos
    });
  }));

  app.patch('/api/admin/users', adminOnly, wrap(async (req, res) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const status = req.body && req.body.status;
    if (!['active', 'locked'].includes(status)) return res.status(400).json({ code: 'invalid' });
    if (!(await repo.setUserStatus(email, status))) return res.status(404).json({ code: 'not_found' });
    res.json({ ok: true });
  }));

  app.delete('/api/admin/users', adminOnly, wrap(async (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!(await repo.deleteUser(email))) return res.status(404).json({ code: 'not_found' });
    res.json({ ok: true });
  }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.publicCode && err.status >= 400 && err.status < 500) return res.status(err.status).json({ code: err.publicCode });
    if (err.type === 'entity.too.large') return res.status(413).json({ code: 'too_large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ code: 'invalid_json' });
    if (err.number === 547) return res.status(409).json({ code: 'in_use' });
    // Không ghi nội dung query / dữ liệu người dùng / mật khẩu ra log.
    console.error('API error:', err.code || err.name || 'server');
    res.status(500).json({ code: 'server' });
  });
  return app;
}
