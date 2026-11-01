-- Dubchef - SQL cho khu Quản trị (3 trang: Tổng quan, Người dùng, Mã QR khách)
-- Chạy trên DubchefDB, SAU KHI đã chạy 01-create-database.sql và 02-schema.sql.
-- Chạy lại nhiều lần vẫn an toàn (CREATE OR ALTER).
-- Ngày tính theo múi giờ lệch @TzHours so với UTC (Việt Nam = 7), giống STATS_TZ_HOURS của API.
USE DubchefDB;
GO

/* =====================================================================
   TRANG 1 + TRANG 3: Tổng quan truy cập (UC10) và Người quét mã QR (UC13)
   Hai trang cùng một cách tính, chỉ khác bảng nguồn:
     @Nguon = 'visits' -> dbo.LuotTruyCap   (trang Tổng quan)
     @Nguon = 'qr'     -> dbo.LuotQuetQR  (trang Mã QR khách)
   visitors = số MaKhach không trùng, views = số dòng (lượt xem / lượt quét)
   Trả về 3 kết quả: (1) các ô số liệu, (2) chuỗi theo ngày cho biểu đồ, (3) ngày cao nhất.
   ===================================================================== */
CREATE OR ALTER PROCEDURE dbo.usp_Admin_ThongKe
    @Nguon   VARCHAR(10) = 'visits',
    @Days    INT = 7,          -- chỉ nhận 7, 14, 30
    @TzHours INT = 7
AS
BEGIN
    SET NOCOUNT ON;
    IF @Days NOT IN (7, 14, 30) SET @Days = 7;
    IF @Nguon NOT IN ('visits', 'qr') SET @Nguon = 'visits';

    DECLARE @Now   DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @Today DATE = CAST(DATEADD(HOUR, @TzHours, @Now) AS DATE);
    DECLARE @C0 DATE = DATEADD(DAY, -(@Days - 1),     @Today);  -- đầu kỳ này
    DECLARE @P0 DATE = DATEADD(DAY, -(@Days * 2 - 1), @Today);  -- đầu kỳ trước
    DECLARE @P1 DATE = DATEADD(DAY, -@Days,           @Today);  -- cuối kỳ trước
    DECLARE @From DATETIME2(0) = DATEADD(DAY, -(@Days * 2 + 1), @Now);
    DECLARE @TongNguoi INT, @TongLuot INT, @DangHoatDong INT;

    CREATE TABLE #v (MaKhach VARCHAR(64) NOT NULL, d DATE NOT NULL);

    IF @Nguon = 'visits'
    BEGIN
        INSERT #v SELECT MaKhach, CAST(DATEADD(HOUR, @TzHours, NgayTruyCap) AS DATE)
                  FROM dbo.LuotTruyCap WHERE NgayTruyCap >= @From;
        SELECT @TongNguoi = COUNT(DISTINCT MaKhach), @TongLuot = COUNT(*) FROM dbo.LuotTruyCap;
        SELECT @DangHoatDong = COUNT(DISTINCT MaKhach) FROM dbo.LuotTruyCap
         WHERE NgayTruyCap >= DATEADD(MINUTE, -5, @Now);
    END
    ELSE
    BEGIN
        INSERT #v SELECT MaKhach, CAST(DATEADD(HOUR, @TzHours, NgayQuet) AS DATE)
                  FROM dbo.LuotQuetQR WHERE NgayQuet >= @From;
        SELECT @TongNguoi = COUNT(DISTINCT MaKhach), @TongLuot = COUNT(*) FROM dbo.LuotQuetQR;
        SELECT @DangHoatDong = COUNT(DISTINCT MaKhach) FROM dbo.LuotQuetQR
         WHERE NgayQuet >= DATEADD(MINUTE, -5, @Now);
    END

    -- (1) Các ô số liệu: đang hoạt động, hôm nay / hôm qua, kỳ này / kỳ trước, tổng cộng
    SELECT
        @DangHoatDong AS DangHoatDong,                                   -- trong 5 phút gần nhất
        COUNT(DISTINCT CASE WHEN d = @Today THEN MaKhach END)                 AS HomNay_Nguoi,
        ISNULL(SUM(CASE WHEN d = @Today THEN 1 END), 0)                         AS HomNay_Luot,
        COUNT(DISTINCT CASE WHEN d = DATEADD(DAY, -1, @Today) THEN MaKhach END) AS HomQua_Nguoi,
        ISNULL(SUM(CASE WHEN d = DATEADD(DAY, -1, @Today) THEN 1 END), 0)       AS HomQua_Luot,
        COUNT(DISTINCT CASE WHEN d BETWEEN @C0 AND @Today THEN MaKhach END)   AS KyNay_Nguoi,
        ISNULL(SUM(CASE WHEN d BETWEEN @C0 AND @Today THEN 1 END), 0)           AS KyNay_Luot,
        COUNT(DISTINCT CASE WHEN d BETWEEN @P0 AND @P1 THEN MaKhach END)      AS KyTruoc_Nguoi,
        ISNULL(SUM(CASE WHEN d BETWEEN @P0 AND @P1 THEN 1 END), 0)              AS KyTruoc_Luot,
        @TongNguoi AS TongCong_Nguoi,
        @TongLuot  AS TongCong_Luot
    FROM #v;

    -- (2) Biểu đồ theo ngày (ngày không có dữ liệu = 0)
    CREATE TABLE #s (Ngay DATE NOT NULL, NguoiTruyCap INT NOT NULL, LuotXem INT NOT NULL);
    ;WITH n AS (
        SELECT 0 AS i
        UNION ALL SELECT i + 1 FROM n WHERE i < @Days - 1
    )
    INSERT #s
    SELECT DATEADD(DAY, -n.i, @Today), COUNT(DISTINCT v.MaKhach), COUNT(v.MaKhach)
    FROM n
    LEFT JOIN #v v ON v.d = DATEADD(DAY, -n.i, @Today)
    GROUP BY n.i;

    SELECT Ngay, NguoiTruyCap, LuotXem FROM #s ORDER BY Ngay;

    -- (3) Ngày cao nhất (nhiều người nhất; hòa thì lấy ngày gần đây hơn)
    SELECT TOP (1) Ngay, NguoiTruyCap FROM #s ORDER BY NguoiTruyCap DESC, Ngay DESC;

    DROP TABLE #s;
    DROP TABLE #v;
END;
GO

/* =====================================================================
   TRANG 2: Quản lý người dùng (UC11) - chỉ người dùng vai trò 'user'
   ===================================================================== */

-- Ba ô trên cùng: Tổng người dùng / Hoạt động / Đã khóa
CREATE OR ALTER PROCEDURE dbo.usp_Admin_NguoiDung_ThongKe
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*)                                          AS TongNguoiDung,
           ISNULL(SUM(CASE WHEN TrangThai = 'active' THEN 1 END), 0) AS HoatDong,
           ISNULL(SUM(CASE WHEN TrangThai = 'locked' THEN 1 END), 0) AS DaKhoa
    FROM dbo.NguoiDung
    WHERE VaiTro = 'user';
END;
GO

-- Bảng danh sách: tìm theo tên/email, sắp xếp, phân trang 8 người/trang
--   @Sort: 'newest' (Mới nhất, mặc định) | 'oldest' | 'name'
-- Kết quả 1: tổng số dòng sau khi lọc (để chia trang). Kết quả 2: các dòng của trang.
CREATE OR ALTER PROCEDURE dbo.usp_Admin_NguoiDung_DanhSach
    @Search   NVARCHAR(100) = NULL,
    @Sort     VARCHAR(10)   = 'newest',
    @Page     INT           = 1,
    @PageSize INT           = 8
AS
BEGIN
    SET NOCOUNT ON;
    IF @Page < 1 SET @Page = 1;
    IF @PageSize < 1 SET @PageSize = 8;
    DECLARE @Kw NVARCHAR(102) = N'%' + ISNULL(LTRIM(RTRIM(@Search)), N'') + N'%';

    SELECT COUNT(*) AS TongSauLoc
    FROM dbo.NguoiDung
    WHERE VaiTro = 'user' AND (HoTen LIKE @Kw OR Email LIKE @Kw);

    SELECT MaNguoiDung, HoTen, Email, TrangThai, NgayTao
    FROM dbo.NguoiDung
    WHERE VaiTro = 'user' AND (HoTen LIKE @Kw OR Email LIKE @Kw)
    ORDER BY CASE WHEN @Sort = 'name'   THEN HoTen      END ASC,
             CASE WHEN @Sort = 'oldest' THEN NgayTao END ASC,
             CASE WHEN @Sort NOT IN ('name', 'oldest') THEN NgayTao END DESC,
             MaNguoiDung DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- Khóa / mở khóa (@TrangThai = 'locked' | 'active'). Không đụng tới quản trị viên.
CREATE OR ALTER PROCEDURE dbo.usp_Admin_NguoiDung_DoiTrangThai
    @Email  NVARCHAR(254),
    @TrangThai VARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    IF @TrangThai NOT IN ('active', 'locked')
    BEGIN
        RAISERROR(N'Trạng thái chỉ nhận active hoặc locked.', 16, 1);
        RETURN;
    END
    UPDATE dbo.NguoiDung SET TrangThai = @TrangThai WHERE Email = @Email AND VaiTro = 'user';
    SELECT @@ROWCOUNT AS SoDongDoi;   -- 0 nghĩa là không tìm thấy (API trả 404)
END;
GO

-- Xóa tài khoản (UI đã hỏi xác nhận trước khi gọi). Không xóa được quản trị viên.
CREATE OR ALTER PROCEDURE dbo.usp_Admin_NguoiDung_Xoa
    @Email NVARCHAR(254)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.NguoiDung WHERE Email = @Email AND VaiTro = 'user';
    SELECT @@ROWCOUNT AS SoDongXoa;
END;
GO

-- Nút "Xuất CSV": toàn bộ danh sách (không phân trang), có thể lọc giống danh sách
CREATE OR ALTER PROCEDURE dbo.usp_Admin_NguoiDung_XuatCsv
    @Search NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Kw NVARCHAR(102) = N'%' + ISNULL(LTRIM(RTRIM(@Search)), N'') + N'%';
    SELECT HoTen, Email, TrangThai, NgayTao
    FROM dbo.NguoiDung
    WHERE VaiTro = 'user' AND (HoTen LIKE @Kw OR Email LIKE @Kw)
    ORDER BY NgayTao DESC, MaNguoiDung DESC;
END;
GO
