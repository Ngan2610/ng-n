import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';
import { openRepo } from './db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@dubchef.vn').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
if (!process.env.DB_PASSWORD) throw new Error('Thiếu DB_PASSWORD. Chạy npm run setup:local hoặc cấu hình .env.');
if (!adminPassword || adminPassword.length < 12) throw new Error('ADMIN_PASSWORD cần ít nhất 12 ký tự.');
if (production && (!process.env.TOKEN_SECRET || process.env.TOKEN_SECRET.length < 32)) {
  throw new Error('TOKEN_SECRET cần ít nhất 32 ký tự trong production.');
}
const secret = process.env.TOKEN_SECRET || randomBytes(32).toString('hex');
const repo = await openRepo();
if (await repo.ensureAdmin(adminEmail, adminPassword)) console.log('Đã tạo tài khoản quản trị từ cấu hình.');
const app = createApp(repo, {
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173',
  secret,
  tz: Number(process.env.STATS_TZ_HOURS || 7),
});
if (process.env.SERVE_WEB === 'true') {
  app.use(express.static(join(root, 'web', 'dist'), { index: 'index.html' }));
}
app.use('/api', (req, res) => res.status(404).json({ code: 'not_found' }));
const server = app.listen(port, '0.0.0.0', () => console.log(`Dubchef đang chạy trên cổng ${port}.`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(async () => { await repo.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
