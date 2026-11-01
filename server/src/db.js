// Kết nối SQL Server, tạo CSDL và bảng khi khởi động, và các câu lệnh cho đơn hàng / thanh toán.
import sql from 'mssql';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVE_MINUTES, dayKey } from './stats.js';
import { hashPassword } from './auth.js';
import { createServiceRepo } from './serviceRepo.js';

const DB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db');

function config(database) {
  if (!process.env.DB_PASSWORD) throw new Error('Thiếu DB_PASSWORD. Hãy cấu hình mật khẩu SQL Server trong .env hoặc biến môi trường.');
  return {
    server: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 1433),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    database,
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_CERT == null
        ? process.env.NODE_ENV !== 'production' : process.env.DB_TRUST_CERT === 'true',
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** SQL Server cần vài chục giây để khởi động, nên thử lại cho đến khi kết nối được. */
async function connect(database, tries = Number(process.env.DB_CONNECT_TRIES || 60)) {
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
  ownerId: r.MaNguoiDung ?? null,
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
  id: r.MaNguoiDung,
  name: r.HoTen,
  email: r.Email,
  role: r.VaiTro,
  status: r.TrangThai,
  at: new Date(r.NgayTao).toISOString(),
  lastLogin: r.LanDangNhapCuoi ? new Date(r.LanDangNhapCuoi).toISOString() : null,
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
  if (!process.env.DB_PASSWORD) throw new Error('Thiếu DB_PASSWORD. Hãy cấu hình mật khẩu SQL Server trong .env hoặc biến môi trường.');
  const database = process.env.DB_NAME || 'DubchefDB';
  if (process.env.DB_SKIP_CREATE !== 'true') {
    const master = await connect('master');
    try {
      // QUOTENAME-style escaping: database name never becomes executable SQL.
      await master.request().input('name', sql.NVarChar(128), database)
        .query(`IF DB_ID(@name) IS NULL
                BEGIN
                  DECLARE @stmt NVARCHAR(300) = N'CREATE DATABASE ' + QUOTENAME(@name);
                  EXEC sp_executesql @stmt;
                END`);
    } finally { await master.close(); }
  }

  const pool = await connect(database);
  try {
    await runScript(pool, '02-schema.sql');
    await runScript(pool, '06-service.sql');
  } catch (error) {
    await pool.close();
    throw error;
  }
  console.log('SQL Server sẵn sàng.');

  const repo = {
    ...createServiceRepo(pool),
    close: () => pool.close(),
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
        .query(`DECLARE @owner INT = (SELECT MaNguoiDung FROM dbo.NguoiDung WHERE Email = @email AND TrangThai = 'active');
                IF @owner IS NULL THROW 51001, N'Tài khoản không còn hoạt động.', 1;
                INSERT INTO dbo.DonHang (TenKhachHang, EmailKhachHang, SoVideoDang, SoVideoDich, LoaiTien, SoTien, MaNguoiDung)
                OUTPUT inserted.*
                VALUES (@name, @email, @up, @out, @cur, @amt, @owner)`);
      return mapOrder(r.recordset[0]);
    },

    /** Đánh dấu đơn đã trả và ghi giao dịch trong cùng một transaction. Trả null nếu đơn không tồn tại hoặc đã trả. */
    async payOrder(id, { method, ref, email }) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        const upd = await new sql.Request(tx)
          .input('id', sql.Int, id)
          .input('email', sql.NVarChar(254), email || null)
          .query(`UPDATE o SET TrangThai = 'paid' OUTPUT inserted.*
                  FROM dbo.DonHang o JOIN dbo.NguoiDung u ON u.MaNguoiDung = o.MaNguoiDung
                  WHERE o.MaDonHang = @id AND o.TrangThai = 'pending' AND u.Email = @email AND u.TrangThai = 'active'`);
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
                JOIN dbo.NguoiDung u ON u.MaNguoiDung = o.MaNguoiDung
                LEFT JOIN dbo.GiaoDich p ON p.MaDonHang = o.MaDonHang AND p.TrangThai = 'success'
                WHERE u.Email = @email
                ORDER BY o.NgayTao DESC, o.MaDonHang DESC`);
      return r.recordset.map(mapOrder);
    },

    async getOrder(id) {
      const r = await pool.request().input('id', sql.Int, id)
        .query('SELECT * FROM dbo.DonHang WHERE MaDonHang = @id');
      return r.recordset[0] ? mapOrder(r.recordset[0]) : null;
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

    async recordLogin(email) {
      await pool.request().input('email', sql.NVarChar(254), email)
        .query('UPDATE dbo.NguoiDung SET LanDangNhapCuoi = SYSUTCDATETIME() WHERE Email = @email');
    },

    /** Chuyển băm mật khẩu cũ sang scrypt sau khi đã xác thực, không ghi đè một lần đổi mật khẩu đồng thời. */
    async updatePasswordHash(email, newHash, expectedOldHash = null) {
      const r = await pool.request().input('email', sql.NVarChar(254), email)
        .input('newHash', sql.VarChar(200), newHash).input('oldHash', sql.VarChar(200), expectedOldHash)
        .query(`UPDATE dbo.NguoiDung SET MatKhauBam = @newHash
                WHERE Email = @email AND (@oldHash IS NULL OR MatKhauBam = @oldHash)`);
      return r.rowsAffected[0] > 0;
    },

    // Quản lý danh sách video
    async listVideos() {
      const r = await pool.request().query(`
        SELECT
          v.MaVideo AS id,
          v.TieuDe AS title,
          v.TrangThai AS status,
          v.NgonNguGoc AS originalLanguage,
          v.DuongDan AS videoUrl,
          v.NgayTaiLen AS createdAt,
          u.HoTen AS userName,
          u.Email AS userEmail
        FROM dbo.Video v
        INNER JOIN dbo.NguoiDung u
          ON v.MaNguoiDung = u.MaNguoiDung
        ORDER BY v.NgayTaiLen DESC
      `);

      return r.recordset;
    },

    // Thống kê tổng quan Admin từ SQL Server
    async adminStatistics() {
      const result = await pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM dbo.NguoiDung)
            AS totalUsers,

          (SELECT COUNT(*) FROM dbo.Video)
            AS totalVideos,

          (SELECT COUNT(*) FROM dbo.NgonNgu)
            AS totalLanguages,

          (SELECT COUNT(*) FROM dbo.LuotQuetQR)
            AS totalQrScans,

          (SELECT COUNT(*) FROM dbo.LuotTruyCap)
            AS totalVisits,

          (SELECT COUNT(*) FROM dbo.ThuyetMinh) AS totalNarrations,
          (SELECT COUNT(*) FROM dbo.PhuDe) AS totalSubtitles,
          (SELECT COUNT(*) FROM dbo.LienHe) AS totalFeedback,
          (SELECT COUNT(*) FROM dbo.LienHe WHERE TrangThai = 'open') AS openFeedback
      `);

      return result.recordset[0];
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

    async addMessage({ name, email, body, ownerEmail = null }) {
      await pool.request()
        .input('name', sql.NVarChar(100), name)
        .input('email', sql.NVarChar(254), email)
        .input('body', sql.NVarChar(2000), body)
        .input('ownerEmail', sql.NVarChar(254), ownerEmail)
        .query(`DECLARE @owner INT = (SELECT MaNguoiDung FROM dbo.NguoiDung WHERE Email = @ownerEmail AND TrangThai = 'active');
                IF @ownerEmail IS NOT NULL AND @owner IS NULL THROW 51001, N'Tài khoản không còn hoạt động.', 1;
                INSERT INTO dbo.LienHe (HoTen, Email, NoiDung, MaNguoiDung) VALUES (@name, @email, @body, @owner)`);
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
