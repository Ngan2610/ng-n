import { randomBytes } from 'node:crypto';
import { writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../.env', import.meta.url));
try {
  await access(target);
  console.log('.env đã có sẵn, giữ nguyên cấu hình của bạn.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const content = [
    'DB_HOST=127.0.0.1', 'DB_PORT=1433', 'DB_USER=sa', 'DB_NAME=DubchefDB', 'DB_TRUST_CERT=true',
    'DB_PASSWORD=Db!' + randomBytes(24).toString('hex'),
    'ADMIN_EMAIL=admin@dubchef.vn', 'ADMIN_PASSWORD=Admin!' + randomBytes(24).toString('hex'),
    'TOKEN_SECRET=' + randomBytes(48).toString('hex'),
    'CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173',
    'PAYMENT_DEMO=false', 'SERVE_WEB=false', '',
  ].join('\n');
  await writeFile(target, content, { flag: 'wx', mode: 0o600 });
  console.log('Đã tạo .env với mật khẩu ngẫu nhiên. Xem ADMIN_EMAIL và ADMIN_PASSWORD trong .env để đăng nhập admin.');
}
