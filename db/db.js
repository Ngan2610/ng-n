// Kết nối SQL Server, tạo CSDL và bảng khi khởi động, và các câu lệnh cho đơn hàng / thanh toán.
import sql from 'mssql';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVE_MINUTES, dayKey } from './stats.js';
import { hashPassword } from './auth.js';

const DB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db');

function config(database) {
  return {
    server: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 1433),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Dubchef@12345',
    database,
    options: { encrypt: true, trustServerCertificate: true }, // chứng chỉ tự ký của container
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** SQL Server cần vài chục giây để khởi động, nên thử lại cho đến khi kết nối được. */
async function connect(database, tries = 60) {
  for (let n = 1; ; n++) {
    try {
      return await new sql.ConnectionPool(config(database)).connect();
    } catch (e) {
      if (n >= tries) throw e;
      console.log(`Chờ SQL Server (${n}/${tries}): ${e.message}`);
      await sleep(2000);
    }
  }
}

/** Chạy một file .sql, tách các lô bằng dòng GO. */
async function runScript(pool, file) {
  const text = await readFile(join(DB_DIR, file), 'utf8');
  for (const batch of text.split(/^\s*GO\s*$/im)) {
    if (batch.trim()) await pool.request().batch(batch);
  }
}

const mapOrder = (r) => ({
  id: r.MaDonHang,
  name: r.TenKhachHang,
  email: r.EmailKhachHang,
  uploads: r.SoVideoDang,
  outs: r.SoVideoDich,
  currency: r.LoaiTien.trim(),
  amountMinor: Number(r.SoTien), // BIGINT trả về dạng chuỗi
  status: r.TrangThai,
  createdAt: new Date(r.NgayTao).toISOString(),
  ref: r.MaThamChieu || null,
});

const mapUser = (r) => ({
  name: r.HoTen,
  email: r.Email,
  role: r.VaiTro,
  status: r.TrangThai,
  at: new Date(r.NgayTao).toISOString(),
  hash: r.MatKhauBam,
});

/**
 * Gộp số liệu theo ngày cho một bảng có cột MaKhach và một cột thời gian (`table`, `col` là hằng số trong mã, không lấy từ người dùng).
 * Dùng chung cho lượt truy cập (LuotTruyCap) và lượt quét QR (LuotQuetQR).
 */
async function aggregate(pool, table, col, span, tz, now = Date.now()) {
  const DAY = 86400000;
  const key = (i) => dayKey(now - i * DAY, tz);
  const from = new Date(now - (span * 2 + 1) * DAY);
  const k = `CONVERT(char(10), DATEADD(HOUR, @tz, ${col}), 23)`;
  const days = await pool.request()
    .input('tz', sql.Int, tz).input('from', sql.DateTime2, from)
    .query(`SELECT ${k} AS d, COUNT(DISTINCT MaKhach) AS visitors, COUNT(*) AS views
            FROM ${table} WHERE ${col} >= @from GROUP BY ${k}`);
  const win = await pool.request()
    .input('tz', sql.Int, tz).input('from', sql.DateTime2, from)
    .input('c0', sql.Char(10), key(span - 1)).input('c1', sql.Char(10), key(0))
    .input('p0', sql.Char(10), key(span * 2 - 1)).input('p1', sql.Char(10), key(span))
    .query(`SELECT
              COUNT(DISTINCT CASE WHEN d BETWEEN @c0 AND @c1 THEN MaKhach END) AS cv,
              SUM(CASE WHEN d BETWEEN @c0 AND @c1 THEN 1 ELSE 0 END) AS cw,
              COUNT(DISTINCT CASE WHEN d BETWEEN @p0 AND @p1 THEN MaKhach END) AS pv,
              SUM(CASE WHEN d BETWEEN @p0 AND @p1 THEN 1 ELSE 0 END) AS pw
            FROM (SELECT MaKhach, ${k} AS d FROM ${table} WHERE ${col} >= @from) x`);
  const tot = await pool.request().query(`SELECT COUNT(DISTINCT MaKhach) AS visitors, COUNT(*) AS views FROM ${table}`);
  const act = await pool.request().input('m', sql.Int, ACTIVE_MINUTES)
    .query(`SELECT COUNT(DISTINCT MaKhach) AS n FROM ${table} WHERE ${col} >= DATEADD(MINUTE, -@m, SYSUTCDATETIME())`);
  const w = win.recordset[0];
  return {
    days: days.recordset.map((r) => ({ date: r.d, visitors: r.visitors, views: r.views })),
    period: { visitors: w.cv || 0, views: w.cw || 0 },
    prev: { visitors: w.pv || 0, views: w.pw || 0 },
    totals: { visitors: tot.recordset[0].visitors, views: tot.recordset[0].views },
    activeNow: act.recordset[0].n,
  };
}

/** Tạo CSDL + bảng (nếu chưa có) rồi trả về các hàm thao tác dữ liệu. */
export async function openRepo() {
  const master = await connect('master');
  await runScript(master, '01-create-database.sql');
  await master.close();

  const pool = await connect(process.env.DB_NAME || 'DubchefDB');
  await runScript(pool, '02-schema.sql');
  console.log('SQL Server sẵn sàng.');

  const repo = {
    async ping() {
      await pool.request().query('SELECT 1 AS ok');
    },

    async createOrder(o) {
      const r = await pool.request()
        .input('name', sql.NVarChar(100), o.name)
        .input('email', sql.NVarChar(254), o.email)
        .input('up', sql.Int, o.uploads)
        .input('out', sql.Int, o.outs)
        .input('cur', sql.Char(3), o.currency)
        .input('amt', sql.BigInt, o.amountMinor)
        .query(`INSERT INTO dbo.DonHang (TenKhachHang, EmailKhachHang, SoVideoDang, SoVideoDich, LoaiTien, SoTien)
                OUTPUT inserted.*
                VALUES (@name, @email, @up, @out, @cur, @amt)`);
      return mapOrder(r.recordset[0]);
    },

    /** Đánh dấu đơn đã trả và ghi giao dịch trong cùng một transaction. Trả null nếu đơn không tồn tại hoặc đã trả. */
    async payOrder(id, { method, ref }) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        const upd = await new sql.Request(tx)
          .input('id', sql.Int, id)
          .query(`UPDATE dbo.DonHang SET TrangThai = 'paid' OUTPUT inserted.* WHERE MaDonHang = @id AND TrangThai = 'pending'`);
        if (!upd.recordset.length) {
          await tx.rollback();
          return null;
        }
        const order = upd.recordset[0];
        await new sql.Request(tx)
          .input('id', sql.Int, id)
          .input('method', sql.VarChar(10), method)
          .input('amt', sql.BigInt, order.SoTien)
          .input('cur', sql.Char(3), order.LoaiTien)
          .input('ref', sql.VarChar(40), ref)
          .query(`INSERT INTO dbo.GiaoDich (MaDonHang, PhuongThuc, SoTien, LoaiTien, TrangThai, MaThamChieu)
                  VALUES (@id, @method, @amt, @cur, 'success', @ref)`);
        await tx.commit();
        return { order: mapOrder({ ...order, MaThamChieu: ref }), payment: { method, ref } };
      } catch (e) {
        await tx.rollback().catch(() => {});
        throw e;
      }
    },

    async listOrders(email, limit = 20) {
      const r = await pool.request()
        .input('email', sql.NVarChar(254), email)
        .input('n', sql.Int, limit)
        .query(`SELECT TOP (@n) o.*, p.MaThamChieu
                FROM dbo.DonHang o
                LEFT JOIN dbo.GiaoDich p ON p.MaDonHang = o.MaDonHang AND p.TrangThai = 'success'
                WHERE o.EmailKhachHang = @email
                ORDER BY o.NgayTao DESC, o.MaDonHang DESC`);
      return r.recordset.map(mapOrder);
    },

    // ---- Tài khoản ----
    async findUser(email) {
      const r = await pool.request().input('email', sql.NVarChar(254), email)
        .query('SELECT * FROM dbo.NguoiDung WHERE Email = @email');
      return r.recordset[0] ? mapUser(r.recordset[0]) : null;
    },

    /** Trả null nếu email đã có. */
    async createUser({ name, email, passwordHash, role = 'user' }) {
      try {
        const r = await pool.request()
          .input('name', sql.NVarChar(100), name)
          .input('email', sql.NVarChar(254), email)
          .input('hash', sql.VarChar(200), passwordHash)
          .input('role', sql.VarChar(10), role)
          .query(`INSERT INTO dbo.NguoiDung (HoTen, Email, MatKhauBam, VaiTro) OUTPUT inserted.*
                  VALUES (@name, @email, @hash, @role)`);
        return mapUser(r.recordset[0]);
      } catch (e) {
        if (e.number === 2627 || e.number === 2601) return null; // trùng UNIQUE
        throw e;
      }
    },

    async listUsers() {
      const r = await pool.request().query('SELECT * FROM dbo.NguoiDung ORDER BY NgayTao DESC, MaNguoiDung DESC');
      return r.recordset.map(mapUser);
    },

    /** Chỉ đổi người dùng thường (không đụng tới quản trị viên). Trả true nếu có dòng được đổi. */
    async setUserStatus(email, status) {
      const r = await pool.request()
        .input('email', sql.NVarChar(254), email)
        .input('st', sql.VarChar(10), status)
        .query(`UPDATE dbo.NguoiDung SET TrangThai = @st WHERE Email = @email AND VaiTro = 'user'`);
      return r.rowsAffected[0] > 0;
    },

    async deleteUser(email) {
      const r = await pool.request().input('email', sql.NVarChar(254), email)
        .query(`DELETE FROM dbo.NguoiDung WHERE Email = @email AND VaiTro = 'user'`);
      return r.rowsAffected[0] > 0;
    },

    /** Tạo tài khoản quản trị nếu chưa có (đọc từ biến môi trường khi khởi động). */
    async ensureAdmin(email, password) {
      if (await repo.findUser(email)) return false;
      await repo.createUser({ name: 'Admin', email, passwordHash: hashPassword(password), role: 'admin' });
      return true;
    },

    async addMessage({ name, email, body }) {
      await pool.request()
        .input('name', sql.NVarChar(100), name)
        .input('email', sql.NVarChar(254), email)
        .input('body', sql.NVarChar(2000), body)
        .query('INSERT INTO dbo.LienHe (HoTen, Email, NoiDung) VALUES (@name, @email, @body)');
    },

    // ---- Lượt truy cập ----
    async addVisit({ visitorId, path, lang }) {
      await pool.request()
        .input('vid', sql.VarChar(64), visitorId)
        .input('path', sql.NVarChar(200), path)
        .input('lang', sql.VarChar(8), lang)
        .query('INSERT INTO dbo.LuotTruyCap (MaKhach, DuongDan, NgonNgu) VALUES (@vid, @path, @lang)');
    },

    /** Số liệu thô cho trang Admin: theo ngày, kỳ này / kỳ trước, tổng, đang online. Ngày tính theo múi giờ `tz`. */
    visitStats: (span, tz, now) => aggregate(pool, 'dbo.LuotTruyCap', 'NgayTruyCap', span, tz, now),

    // ---- Lượt quét mã QR của khách ----
    async addQrScan({ visitorId, lang }) {
      await pool.request()
        .input('vid', sql.VarChar(64), visitorId)
        .input('lang', sql.VarChar(8), lang)
        .query('INSERT INTO dbo.LuotQuetQR (MaKhach, NgonNgu) VALUES (@vid, @lang)');
    },

    /** Cùng dạng với visitStats: visitors = số người quét (không trùng), views = số lượt quét. */
    qrStats: (span, tz, now) => aggregate(pool, 'dbo.LuotQuetQR', 'NgayQuet', span, tz, now),
  };
  return repo;
}
