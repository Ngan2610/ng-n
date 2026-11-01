import sql from 'mssql';

const iso = (value) => value == null ? null : new Date(value).toISOString();
const project = (r) => ({
  id: r.MaVideo, title: r.TieuDe, originalLanguage: r.NgonNguGoc,
  sourceName: r.TenTepGoc || '', videoUrl: r.DuongDan || '', status: r.TrangThai,
  createdAt: iso(r.NgayTaiLen),
});
const feedback = (r) => ({
  id: r.MaLienHe, name: r.HoTen, email: r.Email, message: r.NoiDung,
  reply: r.TraLoi || '', status: r.TrangThai, createdAt: iso(r.NgayTao), repliedAt: iso(r.NgayTraLoi),
});
const narration = (r) => ({
  id: r.MaThuyetMinh, projectId: r.MaVideo, title: r.TieuDe, userEmail: r.Email,
  language: r.MaNgonNgu, text: r.NoiDung, status: r.TrangThai, createdAt: iso(r.NgayTao),
});
const subtitle = (r) => ({
  id: r.MaPhuDe, projectId: r.MaVideo, title: r.TieuDe, userEmail: r.Email,
  language: r.MaNgonNgu, text: r.NoiDung,
  start: r.BatDau == null ? null : Number(r.BatDau), end: r.KetThuc == null ? null : Number(r.KetThuc),
  createdAt: iso(r.NgayTao),
});

/** Dữ liệu dịch vụ luôn đọc/ghi SQL Server, không dùng JSON hoặc localStorage làm CSDL. */
export function createServiceRepo(pool) {
  async function projects(email, id = null) {
    const r = await pool.request().input('email', sql.NVarChar(254), email).input('id', sql.Int, id)
      .query(`SELECT v.* FROM dbo.Video v JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung
              WHERE u.Email = @email AND (@id IS NULL OR v.MaVideo = @id)
              ORDER BY v.NgayTaiLen DESC, v.MaVideo DESC;
              SELECT p.* FROM dbo.PhuDe p JOIN dbo.Video v ON v.MaVideo = p.MaVideo
              JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung
              WHERE u.Email = @email AND (@id IS NULL OR v.MaVideo = @id)
              ORDER BY p.ThuTu, p.MaNgonNgu;
              SELECT t.* FROM dbo.ThuyetMinh t JOIN dbo.Video v ON v.MaVideo = t.MaVideo
              JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung
              WHERE u.Email = @email AND (@id IS NULL OR v.MaVideo = @id)
              ORDER BY t.MaNgonNgu;`);
    const byId = new Map(r.recordsets[0].map((row) => [row.MaVideo, { ...project(row), segments: [], narrations: [], subtitles: [] }]));
    for (const row of r.recordsets[1]) {
      const item = byId.get(row.MaVideo);
      if (!item) continue;
      const segment = item.segments[row.ThuTu] || {};
      segment[row.MaNgonNgu] = row.NoiDung;
      // Giữ mốc phát lại của ngôn ngữ gốc; từng bản dịch có thể được admin chỉnh mốc riêng.
      if (row.BatDau != null && (segment.start == null || row.MaNgonNgu === item.originalLanguage)) segment.start = Number(row.BatDau);
      if (row.KetThuc != null && (segment.end == null || row.MaNgonNgu === item.originalLanguage)) segment.end = Number(row.KetThuc);
      item.segments[row.ThuTu] = segment;
      item.subtitles.push({ id: row.MaPhuDe, index: row.ThuTu, language: row.MaNgonNgu, text: row.NoiDung,
        start: row.BatDau == null ? null : Number(row.BatDau), end: row.KetThuc == null ? null : Number(row.KetThuc) });
    }
    for (const row of r.recordsets[2]) {
      byId.get(row.MaVideo)?.narrations.push({ id: row.MaThuyetMinh, language: row.MaNgonNgu, text: row.NoiDung, status: row.TrangThai });
    }
    return [...byId.values()].map((p) => ({ ...p, segments: p.segments.filter(Boolean) }));
  }

  return {
    listProjects: (email) => projects(email),
    async getProject(id, email) { return (await projects(email, id))[0] || null; },

    async createProject(email, input) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      let id;
      try {
        const created = await new sql.Request(tx)
          .input('email', sql.NVarChar(254), email)
          .input('title', sql.NVarChar(200), input.title)
          .input('language', sql.VarChar(8), input.originalLanguage)
          .input('source', sql.NVarChar(255), input.sourceName || '')
          .input('url', sql.NVarChar(1000), input.videoUrl || '')
          .query(`INSERT INTO dbo.Video(MaNguoiDung, TieuDe, NgonNguGoc, TenTepGoc, DuongDan, TrangThai)
                  OUTPUT inserted.MaVideo
                  SELECT MaNguoiDung, @title, @language, @source, @url, 'ready'
                  FROM dbo.NguoiDung WHERE Email = @email AND TrangThai = 'active'`);
        id = created.recordset[0]?.MaVideo;
        if (!id) { await tx.rollback(); return null; }

        const rows = [];
        for (const [index, segment] of input.segments.entries()) {
          for (const language of ['vi', 'en', 'zh']) {
            if (segment[language]) rows.push({ index, language, text: segment[language], start: segment.start ?? null, end: segment.end ?? null });
          }
        }
        await new sql.Request(tx).input('id', sql.Int, id).input('rows', sql.NVarChar(sql.MAX), JSON.stringify(rows))
          .query(`INSERT INTO dbo.PhuDe(MaVideo, MaNgonNgu, ThuTu, NoiDung, BatDau, KetThuc)
                  SELECT @id, language, [index], [text], [start], [end] FROM OPENJSON(@rows)
                  WITH ([index] INT, language VARCHAR(8), [text] NVARCHAR(4000), [start] DECIMAL(12,3), [end] DECIMAL(12,3))`);
        for (const language of ['vi', 'en', 'zh']) {
          const text = input.segments.map((s) => s[language]).filter(Boolean).join('\n');
          if (!text) continue;
          await new sql.Request(tx).input('id', sql.Int, id).input('lang', sql.VarChar(8), language)
            .input('text', sql.NVarChar(sql.MAX), text)
            .query(`INSERT INTO dbo.ThuyetMinh(MaVideo, MaNgonNgu, NoiDung, TrangThai) VALUES (@id, @lang, @text, 'draft')`);
        }
        await tx.commit();
      } catch (error) {
        await tx.rollback().catch(() => {});
        throw error;
      }
      return (await projects(email, id))[0];
    },

    async listNarrations() {
      const r = await pool.request().query(`SELECT t.*, v.TieuDe, u.Email FROM dbo.ThuyetMinh t
        JOIN dbo.Video v ON v.MaVideo = t.MaVideo JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung
        ORDER BY t.NgayTao DESC, t.MaThuyetMinh DESC`);
      return r.recordset.map(narration);
    },
    async updateNarration(id, { text, status }) {
      const r = await pool.request().input('id', sql.Int, id).input('text', sql.NVarChar(sql.MAX), text)
        .input('status', sql.VarChar(10), status)
        .query(`UPDATE dbo.ThuyetMinh SET NoiDung = @text, TrangThai = @status, NgayCapNhat = SYSUTCDATETIME()
                WHERE MaThuyetMinh = @id;
                SELECT t.*, v.TieuDe, u.Email FROM dbo.ThuyetMinh t JOIN dbo.Video v ON v.MaVideo = t.MaVideo
                JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung WHERE t.MaThuyetMinh = @id`);
      return r.recordset[0] ? narration(r.recordset[0]) : null;
    },
    async listSubtitles() {
      const r = await pool.request().query(`SELECT p.*, v.TieuDe, u.Email FROM dbo.PhuDe p
        JOIN dbo.Video v ON v.MaVideo = p.MaVideo JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung
        ORDER BY v.NgayTaiLen DESC, p.MaVideo DESC, p.ThuTu, p.MaNgonNgu`);
      return r.recordset.map(subtitle);
    },
    async updateSubtitle(id, { text, start, end }) {
      const r = await pool.request().input('id', sql.Int, id).input('text', sql.NVarChar(4000), text)
        .input('start', sql.Decimal(12, 3), start ?? null).input('end', sql.Decimal(12, 3), end ?? null)
        .query(`UPDATE dbo.PhuDe SET NoiDung = @text, BatDau = @start, KetThuc = @end, NgayCapNhat = SYSUTCDATETIME()
                WHERE MaPhuDe = @id;
                SELECT p.*, v.TieuDe, u.Email FROM dbo.PhuDe p JOIN dbo.Video v ON v.MaVideo = p.MaVideo
                JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung WHERE p.MaPhuDe = @id`);
      return r.recordset[0] ? subtitle(r.recordset[0]) : null;
    },
    async listFeedback() {
      const r = await pool.request().query('SELECT * FROM dbo.LienHe ORDER BY NgayTao DESC, MaLienHe DESC');
      return r.recordset.map(feedback);
    },
    async listMessages(email) {
      const r = await pool.request().input('email', sql.NVarChar(254), email)
        .query(`SELECT l.* FROM dbo.LienHe l JOIN dbo.NguoiDung u ON u.MaNguoiDung = l.MaNguoiDung
                WHERE u.Email = @email ORDER BY l.NgayTao DESC, l.MaLienHe DESC`);
      return r.recordset.map(feedback);
    },
    async replyFeedback(id, { reply, status }) {
      const r = await pool.request().input('id', sql.Int, id).input('reply', sql.NVarChar(2000), reply)
        .input('status', sql.VarChar(10), status)
        .query(`UPDATE dbo.LienHe SET TraLoi = @reply, TrangThai = @status, NgayTraLoi = SYSUTCDATETIME()
                OUTPUT inserted.* WHERE MaLienHe = @id`);
      return r.recordset[0] ? feedback(r.recordset[0]) : null;
    },
  };
}
