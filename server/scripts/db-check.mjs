// Chẩn đoán chỉ đọc; không tạo database, đổi mật khẩu hoặc in mật khẩu.
import sql from 'mssql';
import { loadLocalEnvironment, printDatabaseSettings, databaseConfig, connectionErrorMessage } from '../src/config.js';

printDatabaseSettings(loadLocalEnvironment());
let pool;
try {
  const target = process.env.DB_NAME || 'DubchefDB';
  const database = process.env.DB_SKIP_CREATE === 'true' ? target : 'master';
  const options = databaseConfig(database);
  pool = new sql.ConnectionPool({ ...options, connectionTimeout: 10000, requestTimeout: 10000 });
  await pool.connect();
  const result = await pool.request().input('target', sql.NVarChar(128), target)
    .query("SELECT DB_NAME() AS currentDatabase, DB_ID(@target) AS targetId");
  console.log('Đăng nhập SQL thành công. Database đang kiểm tra: ' + result.recordset[0].currentDatabase);
  console.log(result.recordset[0].targetId == null
    ? 'Database đích chưa có hoặc tài khoản chưa được quyền nhìn thấy; lệnh này không tự tạo database.'
    : 'Tài khoản nhìn thấy database đích. Có thể tiếp tục npm start để kiểm tra khởi động ứng dụng.');
} catch (error) {
  console.error(connectionErrorMessage(error));
  process.exitCode = 1;
} finally {
  if (pool) await pool.close().catch(() => {});
}
