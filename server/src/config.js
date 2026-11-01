import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENV_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');

export function loadLocalEnvironment(file = ENV_FILE) {
  const inherited = Object.keys(process.env).filter((name) => name.startsWith('DB_'));
  const found = existsSync(file);
  if (found) process.loadEnvFile(file);
  return { file, found, inherited, textFileExists: !found && existsSync(file + '.txt') };
}

export function databaseConfig(database) {
  if (!process.env.DB_PASSWORD) throw new Error('Thiếu DB_PASSWORD trong .env hoặc biến môi trường.');
  const port = Number(process.env.DB_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT phải là số từ 1 đến 65535.');
  return {
    server: process.env.DB_HOST || 'localhost', port,
    user: process.env.DB_USER || 'sa', password: process.env.DB_PASSWORD, database,
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_CERT == null
        ? process.env.NODE_ENV !== 'production' : process.env.DB_TRUST_CERT === 'true',
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

export function printDatabaseSettings(loaded, out = console.log) {
  out('File cấu hình: ' + loaded.file);
  if (!loaded.found) out(loaded.textFileExists
    ? 'Đang có .env.txt; hãy đổi tên thành .env (Windows có thể đang ẩn đuôi .txt).'
    : 'Chưa có file .env ở thư mục gốc CNPM.');
  if (loaded.inherited.length) out('Biến từ terminal/hệ thống được ưu tiên trước .env: ' + loaded.inherited.join(', '));
  out('SQL: ' + (process.env.DB_HOST || 'localhost') + ',' + (process.env.DB_PORT || '1433'));
  out('Tài khoản SQL: ' + (process.env.DB_USER || 'sa'));
  out('Database đích: ' + (process.env.DB_NAME || 'DubchefDB'));
  out('DB_PASSWORD: ' + (process.env.DB_PASSWORD ? 'đã đặt (không hiển thị)' : 'CHƯA ĐẶT'));
}

export function connectionErrorMessage(error) {
  if (error.code === 'ELOGIN') return 'SQL Server từ chối đăng nhập. Kiểm tra cùng host/cổng, tài khoản và mật khẩu bằng cửa sổ Connect của SQL Server Management Studio. Nếu ứng dụng SQL cũng từ chối, cần kiểm tra cấu hình đăng nhập của SQL Server. Nếu ứng dụng SQL đăng nhập được, kiểm tra CNPM/.env và các biến DB_* đang được terminal ưu tiên.';
  if (['ESOCKET', 'ETIMEOUT', 'EINSTLOOKUP'].includes(error.code)) return 'Chưa kết nối được SQL Server. Kiểm tra SQL đang chạy, DB_HOST và DB_PORT.';
  return 'Kiểm tra SQL thất bại (' + (error.code || 'configuration') + '). Kiểm tra cấu hình và quyền truy cập database.';
}
