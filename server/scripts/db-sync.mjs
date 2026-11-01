// Đồng bộ dữ liệu SQL Server qua Git.
//   node server/scripts/db-sync.mjs export   -> ghi dữ liệu mọi bảng ra db/data/*.json
//   node server/scripts/db-sync.mjs import   -> thay dữ liệu trong CSDL bằng nội dung db/data/*.json
// Kết nối bằng biến môi trường DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (mặc định: SQL Server Docker trên máy này).
import sql from 'mssql';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'data');
// Bảng cha trước, bảng con sau (GiaoDich tham chiếu DonHang). Xóa theo thứ tự ngược lại.
const TABLES = ['NguoiDung', 'DonHang', 'GiaoDich', 'LuotTruyCap', 'LienHe', 'LuotQuetQR'];

const pool = await new sql.ConnectionPool({
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Dubchef@12345',
  database: process.env.DB_NAME || 'DubchefDB',
  options: { encrypt: true, trustServerCertificate: true },
  requestTimeout: 120000,
}).connect();

/** Danh sách cột của bảng cùng kiểu dữ liệu (để SQL Server tự chuyển đổi khi nạp JSON). */
async function columns(table) {
  const r = await pool.request().input('t', sql.NVarChar, 'dbo.' + table).query(`
    SELECT c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_identity
    FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(@t) ORDER BY c.column_id`);
  return r.recordset.map((c) => {
    const n = c.type.startsWith('n') ? c.max_length / 2 : c.max_length; // nchar/nvarchar: 2 byte mỗi ký tự
    let type = c.type;
    if (/char$/.test(c.type)) type += `(${c.max_length === -1 ? 'max' : n})`;
    else if (c.type === 'datetime2') type += `(${c.scale})`;
    else if (c.type === 'decimal' || c.type === 'numeric') type += `(${c.precision},${c.scale})`;
    return { name: c.name, type, identity: Boolean(c.is_identity) };
  });
}

const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : v);

async function exportAll() {
  await mkdir(DATA_DIR, { recursive: true });
  for (const t of TABLES) {
    const cols = await columns(t);
    const key = cols.find((c) => c.identity)?.name;
    const r = await pool.request().query(`SELECT * FROM dbo.${t}${key ? ' ORDER BY ' + key : ''}`);
    const rows = r.recordset.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, iso(v)])));
    await writeFile(join(DATA_DIR, t + '.json'), JSON.stringify(rows, null, 2) + '\n');
    console.log(`Đã xuất ${t}: ${rows.length} dòng`);
  }
}

async function importAll() {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const t of [...TABLES].reverse()) await new sql.Request(tx).query(`DELETE FROM dbo.${t}`);
    for (const t of TABLES) {
      const rows = JSON.parse(await readFile(join(DATA_DIR, t + '.json'), 'utf8'));
      if (!rows.length) { console.log(`Đã nạp ${t}: 0 dòng`); continue; }
      const cols = await columns(t);
      const list = cols.map((c) => `[${c.name}]`).join(', ');
      const withCols = cols.map((c) => `[${c.name}] ${c.type} '$.${c.name}'`).join(', ');
      const hasId = cols.some((c) => c.identity);
      await new sql.Request(tx).input('j', sql.NVarChar(sql.MAX), JSON.stringify(rows)).query(`
        ${hasId ? `SET IDENTITY_INSERT dbo.${t} ON;` : ''}
        INSERT INTO dbo.${t} (${list}) SELECT ${list} FROM OPENJSON(@j) WITH (${withCols});
        ${hasId ? `SET IDENTITY_INSERT dbo.${t} OFF;` : ''}`);
      console.log(`Đã nạp ${t}: ${rows.length} dòng`);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

try {
  const mode = process.argv[2];
  if (mode === 'export') await exportAll();
  else if (mode === 'import') await importAll();
  else { console.error('Dùng: db-sync.mjs export | import'); process.exitCode = 1; }
} catch (e) {
  console.error('Lỗi:', e.message);
  process.exitCode = 1;
} finally {
  await pool.close();
}
