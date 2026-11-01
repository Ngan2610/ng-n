-- Dubchef - Bản SQL Server của db/supabase-accounts.sql và db/supabase-qr.sql (PostgreSQL)
-- Chạy trên DubchefDB, SAU 01, 02, 03. Chạy lại nhiều lần vẫn an toàn.
--
-- Đối chiếu Supabase -> SQL Server:
--   app_users / app_messages / qr_scans  -> dbo.NguoiDung / dbo.LienHe / dbo.LuotQuetQR (đã có ở 02-schema.sql)
--   app_register / app_login / app_contact -> usp_DangKy / usp_DangNhap / usp_LienHe
--   qr_track                              -> usp_QrScan_Ghi
--   qr_stats                              -> usp_Admin_ThongKe 'qr' (ở 03-admin.sql)
--   admin_users / admin_set_status / admin_remove -> usp_AdminUsers / usp_AdminSetStatus / usp_AdminRemove
--   token HMAC (pgcrypto)                 -> bảng dbo.PhienDangNhap (token ngẫu nhiên, hạn 7 ngày)
--   bcrypt (crypt/gen_salt)               -> SHA2_256 + muối ngẫu nhiên (SQL Server không có bcrypt)
--   RLS + grant cho role anon             -> không có; SQL Server truy cập qua API/tài khoản đăng nhập, không có role anon
USE DubchefDB;
GO

-- Phiên đăng nhập của Admin (thay cho token ký HMAC của Supabase)
IF OBJECT_ID(N'dbo.PhienDangNhap', N'U') IS NULL
CREATE TABLE dbo.PhienDangNhap (
    MaPhien     CHAR(64)     NOT NULL CONSTRAINT PK_PhienDangNhap PRIMARY KEY,
    MaNguoiDung    INT          NOT NULL CONSTRAINT FK_PhienDangNhap_NguoiDung REFERENCES dbo.NguoiDung(MaNguoiDung) ON DELETE CASCADE,
    HetHan DATETIME2(0) NOT NULL
);
GO

-- Băm mật khẩu: 'sha256$<muối hex 32>$<băm hex 64>'
-- Khác định dạng scrypt của API Node.js ('muối:băm'), nên tài khoản tạo bằng SQL và tài khoản tạo bằng API KHÔNG đăng nhập chéo được.
CREATE OR ALTER FUNCTION dbo.fn_BamMatKhau (@Password NVARCHAR(200), @Salt VARBINARY(16))
RETURNS VARCHAR(200)
AS
BEGIN
    RETURN 'sha256$' + CONVERT(VARCHAR(32), @Salt, 2) + '$'
         + CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @Salt + CONVERT(VARBINARY(400), @Password)), 2);
END;
GO

-- Trả email Admin nếu token đúng, còn hạn và tài khoản vẫn là admin đang hoạt động; ngược lại NULL
CREATE OR ALTER FUNCTION dbo.fn_AdminCuaToken (@MaPhien CHAR(64))
RETURNS NVARCHAR(254)
AS
BEGIN
    DECLARE @em NVARCHAR(254);
    SELECT @em = u.Email
    FROM dbo.PhienDangNhap s
    JOIN dbo.NguoiDung u ON u.MaNguoiDung = s.MaNguoiDung
    WHERE s.MaPhien = @MaPhien AND s.HetHan > SYSUTCDATETIME()
      AND u.VaiTro = 'admin' AND u.TrangThai = 'active';
    RETURN @em;
END;
GO

/* ---------- Hàm cho web ---------- */

-- Đăng ký (UC1). Code: ok | invalid | exists
CREATE OR ALTER PROCEDURE dbo.usp_DangKy
    @HoTen     NVARCHAR(400),
    @Email    NVARCHAR(400),
    @Password NVARCHAR(400)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @nm NVARCHAR(400) = LTRIM(RTRIM(ISNULL(@HoTen, N'')));
    DECLARE @em NVARCHAR(400) = LOWER(LTRIM(RTRIM(ISNULL(@Email, N''))));

    IF LEN(@nm) NOT BETWEEN 1 AND 100
       OR LEN(@em) > 254 OR @em NOT LIKE N'%_@_%._%' OR @em LIKE N'% %'
       OR LEN(ISNULL(@Password, N'')) NOT BETWEEN 8 AND 200
    BEGIN
        SELECT 'invalid' AS Code, CAST(NULL AS NVARCHAR(100)) AS HoTen, CAST(NULL AS NVARCHAR(254)) AS Email;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.NguoiDung WHERE Email = @em)
    BEGIN
        SELECT 'exists' AS Code, CAST(NULL AS NVARCHAR(100)) AS HoTen, CAST(NULL AS NVARCHAR(254)) AS Email;
        RETURN;
    END

    BEGIN TRY
        INSERT dbo.NguoiDung (HoTen, Email, MatKhauBam)
        VALUES (@nm, @em, dbo.fn_BamMatKhau(@Password, CRYPT_GEN_RANDOM(16)));
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() IN (2627, 2601)   -- trùng UNIQUE(Email) do hai người đăng ký cùng lúc
        BEGIN
            SELECT 'exists' AS Code, CAST(NULL AS NVARCHAR(100)) AS HoTen, CAST(NULL AS NVARCHAR(254)) AS Email;
            RETURN;
        END
        THROW;
    END CATCH

    SELECT 'ok' AS Code, @nm AS HoTen, @em AS Email;
END;
GO

-- Đăng nhập (UC2). Code: ok | invalid | locked. Admin nhận thêm MaPhien (hạn 7 ngày).
CREATE OR ALTER PROCEDURE dbo.usp_DangNhap
    @Email    NVARCHAR(400),
    @Password NVARCHAR(400)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @em NVARCHAR(400) = LOWER(LTRIM(RTRIM(ISNULL(@Email, N''))));
    DECLARE @id INT, @name NVARCHAR(100), @mail NVARCHAR(254), @hash VARCHAR(200), @role VARCHAR(10), @status VARCHAR(10);

    SELECT @id = MaNguoiDung, @name = HoTen, @mail = Email, @hash = MatKhauBam, @role = VaiTro, @status = TrangThai
    FROM dbo.NguoiDung WHERE Email = @em;

    DECLARE @ok BIT = 0;
    IF @id IS NOT NULL AND @hash LIKE 'sha256$%' AND LEN(@hash) = 104
       AND LEN(ISNULL(@Password, N'')) <= 200
       AND dbo.fn_BamMatKhau(@Password, CONVERT(VARBINARY(16), SUBSTRING(@hash, 8, 32), 2)) = @hash
        SET @ok = 1;

    IF @ok = 0
    BEGIN
        SELECT 'invalid' AS Code, CAST(NULL AS NVARCHAR(100)) AS HoTen, CAST(NULL AS NVARCHAR(254)) AS Email,
               CAST(NULL AS VARCHAR(10)) AS VaiTro, CAST(NULL AS CHAR(64)) AS MaPhien;
        RETURN;
    END

    IF @status = 'locked'
    BEGIN
        SELECT 'locked' AS Code, CAST(NULL AS NVARCHAR(100)) AS HoTen, CAST(NULL AS NVARCHAR(254)) AS Email,
               CAST(NULL AS VARCHAR(10)) AS VaiTro, CAST(NULL AS CHAR(64)) AS MaPhien;
        RETURN;
    END

    DECLARE @tok CHAR(64) = NULL;
    IF @role = 'admin'
    BEGIN
        DELETE FROM dbo.PhienDangNhap WHERE HetHan < SYSUTCDATETIME();   -- dọn phiên hết hạn
        SET @tok = CONVERT(CHAR(64), CRYPT_GEN_RANDOM(32), 2);
        INSERT dbo.PhienDangNhap (MaPhien, MaNguoiDung, HetHan) VALUES (@tok, @id, DATEADD(DAY, 7, SYSUTCDATETIME()));
    END

    SELECT 'ok' AS Code, @name AS HoTen, @mail AS Email, @role AS VaiTro, @tok AS MaPhien;
END;
GO

-- Đăng xuất (UC7): xóa phiên của Admin (người dùng thường không có phiên trong bảng)
CREATE OR ALTER PROCEDURE dbo.usp_DangXuat
    @MaPhien CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.PhienDangNhap WHERE MaPhien = @MaPhien;
END;
GO

-- Gửi liên hệ (UC5). Code: ok | invalid
CREATE OR ALTER PROCEDURE dbo.usp_LienHe
    @HoTen    NVARCHAR(400),
    @Email   NVARCHAR(400),
    @Message NVARCHAR(4000)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @nm NVARCHAR(400)  = LTRIM(RTRIM(ISNULL(@HoTen, N'')));
    DECLARE @em NVARCHAR(400)  = LTRIM(RTRIM(ISNULL(@Email, N'')));
    DECLARE @ms NVARCHAR(4000) = LTRIM(RTRIM(ISNULL(@Message, N'')));

    IF LEN(@nm) NOT BETWEEN 1 AND 100 OR LEN(@em) NOT BETWEEN 3 AND 254 OR LEN(@ms) NOT BETWEEN 1 AND 2000
    BEGIN
        SELECT 'invalid' AS Code;
        RETURN;
    END
    INSERT dbo.LienHe (HoTen, Email, NoiDung) VALUES (@nm, @em, @ms);
    SELECT 'ok' AS Code;
END;
GO

-- Ghi một lượt quét mã QR (UC12) - tương đương qr_track. Code: ok | invalid
--   MaKhach: chữ, số, gạch (1-64 ký tự); NgonNgu: 2-8 chữ thường
CREATE OR ALTER PROCEDURE dbo.usp_QrScan_Ghi
    @MaKhach VARCHAR(200),
    @NgonNgu      VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    IF LEN(ISNULL(@MaKhach, '')) NOT BETWEEN 1 AND 64
       OR @MaKhach COLLATE Latin1_General_BIN LIKE '%[^A-Za-z0-9_-]%'
       OR LEN(ISNULL(@NgonNgu, '')) NOT BETWEEN 2 AND 8
       OR @NgonNgu COLLATE Latin1_General_BIN LIKE '%[^a-z]%'
    BEGIN
        SELECT 'invalid' AS Code;
        RETURN;
    END
    INSERT dbo.LuotQuetQR (MaKhach, NgonNgu) VALUES (@MaKhach, @NgonNgu);
    SELECT 'ok' AS Code;
END;
GO

/* ---------- Hàm cho trang Quản trị (cần token Admin) ---------- */

-- Ném lỗi 'forbidden' nếu token không phải Admin hợp lệ (tương đương raise exception 'forbidden')
CREATE OR ALTER PROCEDURE dbo.usp_AdminUsers
    @MaPhien CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.fn_AdminCuaToken(@MaPhien) IS NULL THROW 50403, N'forbidden', 1;
    SELECT HoTen, Email, NgayTao AS [At], TrangThai
    FROM dbo.NguoiDung WHERE VaiTro = 'user'
    ORDER BY NgayTao DESC, MaNguoiDung DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_AdminSetStatus
    @MaPhien  CHAR(64),
    @Email  NVARCHAR(254),
    @TrangThai VARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.fn_AdminCuaToken(@MaPhien) IS NULL THROW 50403, N'forbidden', 1;
    EXEC dbo.usp_Admin_NguoiDung_DoiTrangThai @Email = @Email, @TrangThai = @TrangThai;   -- ở 03-admin.sql
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_AdminRemove
    @MaPhien CHAR(64),
    @Email NVARCHAR(254)
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.fn_AdminCuaToken(@MaPhien) IS NULL THROW 50403, N'forbidden', 1;
    EXEC dbo.usp_Admin_NguoiDung_Xoa @Email = @Email;                                -- ở 03-admin.sql
END;
GO

/* ---------- Tài khoản Admin ----------
   ĐỔI MẬT KHẨU ADMIN: thay 'DoiMatKhauNay123' (tối thiểu 8 ký tự) trước khi chạy.
   Lưu ý: nếu API Node.js đã tạo admin@dubchef.vn trước (định dạng scrypt) thì đoạn này bỏ qua,
   và admin đó chỉ đăng nhập được qua API, không đăng nhập được bằng usp_DangNhap. */
IF NOT EXISTS (SELECT 1 FROM dbo.NguoiDung WHERE Email = N'admin@dubchef.vn')
    INSERT dbo.NguoiDung (HoTen, Email, MatKhauBam, VaiTro)
    VALUES (N'Admin', N'admin@dubchef.vn', dbo.fn_BamMatKhau(N'DoiMatKhauNay123', CRYPT_GEN_RANDOM(16)), 'admin');
GO

/* ---------- Chạy thử ----------
EXEC dbo.usp_DangKy   @HoTen = N'Nguyễn Thị Yến Nhi', @Email = 'nhi@example.com', @Password = N'matkhau123';
EXEC dbo.usp_DangNhap @Email = 'nhi@example.com',    @Password = N'matkhau123';          -- ok
EXEC dbo.usp_DangNhap @Email = 'nhi@example.com',    @Password = N'sai-mat-khau';        -- invalid
EXEC dbo.usp_DangNhap @Email = 'admin@dubchef.vn',   @Password = N'DoiMatKhauNay123';    -- ok + MaPhien
-- Lấy MaPhien ở dòng trên dán vào bên dưới:
-- EXEC dbo.usp_AdminUsers     @MaPhien = '<token>';
-- EXEC dbo.usp_AdminSetStatus @MaPhien = '<token>', @Email = 'nhi@example.com', @TrangThai = 'locked';
-- EXEC dbo.usp_DangNhap       @Email = 'nhi@example.com', @Password = N'matkhau123';   -- locked
EXEC dbo.usp_LienHe   @HoTen = N'Nhi', @Email = 'nhi@example.com', @Message = N'Xin chào Dubchef';
EXEC dbo.usp_QrScan_Ghi @MaKhach = 'abc_123', @NgonNgu = 'vi';
*/
