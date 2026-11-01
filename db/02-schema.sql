-- Chạy trên DubchefDB. Chạy lại nhiều lần vẫn an toàn (chỉ tạo khi chưa có).
-- Tên bảng và tên cột đều bằng tiếng Việt không dấu. Giá trị trạng thái ('pending', 'paid', 'admin', 'card'...) giữ nguyên
-- vì web và API đang dùng đúng các giá trị đó.
-- Tiền lưu theo đơn vị nhỏ nhất (đồng, cent, xu) bằng số nguyên để không sai số.

-- Đơn hàng: một lần người dùng chọn số video ở trang Bảng giá
IF OBJECT_ID(N'dbo.DonHang', N'U') IS NULL
CREATE TABLE dbo.DonHang (
    MaDonHang      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DonHang PRIMARY KEY,
    TenKhachHang   NVARCHAR(100) NOT NULL,
    EmailKhachHang NVARCHAR(254) NOT NULL,
    SoVideoDang    INT           NOT NULL CONSTRAINT CK_DonHang_Dang CHECK (SoVideoDang BETWEEN 0 AND 500),
    SoVideoDich    INT           NOT NULL CONSTRAINT CK_DonHang_Dich CHECK (SoVideoDich BETWEEN 0 AND 500),
    LoaiTien       CHAR(3)       NOT NULL CONSTRAINT CK_DonHang_LoaiTien CHECK (LoaiTien IN ('VND', 'USD', 'CNY')),
    SoTien         BIGINT        NOT NULL CONSTRAINT CK_DonHang_SoTien CHECK (SoTien >= 0),
    TrangThai      VARCHAR(10)   NOT NULL CONSTRAINT DF_DonHang_TrangThai DEFAULT 'pending'
                                 CONSTRAINT CK_DonHang_TrangThai CHECK (TrangThai IN ('pending', 'paid', 'cancelled')),
    NgayTao        DATETIME2(0)  NOT NULL CONSTRAINT DF_DonHang_NgayTao DEFAULT SYSUTCDATETIME()
);
GO

-- Giao dịch thanh toán của một đơn (không lưu số thẻ)
IF OBJECT_ID(N'dbo.GiaoDich', N'U') IS NULL
CREATE TABLE dbo.GiaoDich (
    MaGiaoDich    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GiaoDich PRIMARY KEY,
    MaDonHang     INT           NOT NULL CONSTRAINT FK_GiaoDich_DonHang REFERENCES dbo.DonHang(MaDonHang),
    PhuongThuc    VARCHAR(10)   NOT NULL CONSTRAINT CK_GiaoDich_PhuongThuc CHECK (PhuongThuc IN ('card', 'momo', 'bank', 'qr')),
    SoTien        BIGINT        NOT NULL CONSTRAINT CK_GiaoDich_SoTien CHECK (SoTien >= 0),
    LoaiTien      CHAR(3)       NOT NULL,
    TrangThai     VARCHAR(10)   NOT NULL CONSTRAINT CK_GiaoDich_TrangThai CHECK (TrangThai IN ('success', 'failed')),
    MaThamChieu   VARCHAR(40)   NOT NULL CONSTRAINT UQ_GiaoDich_MaThamChieu UNIQUE,
    NgayThanhToan DATETIME2(0)  NOT NULL CONSTRAINT DF_GiaoDich_NgayThanhToan DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DonHang_Email' AND object_id = OBJECT_ID(N'dbo.DonHang'))
    CREATE INDEX IX_DonHang_Email ON dbo.DonHang (EmailKhachHang, NgayTao DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GiaoDich_DonHang' AND object_id = OBJECT_ID(N'dbo.GiaoDich'))
    CREATE INDEX IX_GiaoDich_DonHang ON dbo.GiaoDich (MaDonHang);
GO

-- Doanh thu theo ngày và loại tiền (chỉ tính giao dịch thành công)
CREATE OR ALTER VIEW dbo.vw_DoanhThuNgay AS
SELECT CAST(NgayThanhToan AS DATE) AS Ngay,
       LoaiTien,
       COUNT(*)      AS SoGiaoDich,
       SUM(SoTien)   AS TongSoTien
FROM dbo.GiaoDich
WHERE TrangThai = 'success'
GROUP BY CAST(NgayThanhToan AS DATE), LoaiTien;
GO

-- Tài khoản người dùng. Mật khẩu lưu dạng băm (scrypt), không lưu mật khẩu gốc.
IF OBJECT_ID(N'dbo.NguoiDung', N'U') IS NULL
CREATE TABLE dbo.NguoiDung (
    MaNguoiDung INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_NguoiDung PRIMARY KEY,
    HoTen       NVARCHAR(100) NOT NULL,
    Email       NVARCHAR(254) NOT NULL CONSTRAINT UQ_NguoiDung_Email UNIQUE,
    MatKhauBam  VARCHAR(200)  NOT NULL,
    VaiTro      VARCHAR(10)   NOT NULL CONSTRAINT DF_NguoiDung_VaiTro DEFAULT 'user'
                              CONSTRAINT CK_NguoiDung_VaiTro CHECK (VaiTro IN ('user', 'admin')),
    TrangThai   VARCHAR(10)   NOT NULL CONSTRAINT DF_NguoiDung_TrangThai DEFAULT 'active'
                              CONSTRAINT CK_NguoiDung_TrangThai CHECK (TrangThai IN ('active', 'locked')),
    NgayTao     DATETIME2(0)  NOT NULL CONSTRAINT DF_NguoiDung_NgayTao DEFAULT SYSUTCDATETIME()
);
GO

-- Mỗi lượt mở một trang là một dòng (trang admin không ghi)
IF OBJECT_ID(N'dbo.LuotTruyCap', N'U') IS NULL
CREATE TABLE dbo.LuotTruyCap (
    MaLuot       BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LuotTruyCap PRIMARY KEY,
    MaKhach      VARCHAR(64)   NOT NULL,
    DuongDan     NVARCHAR(200) NOT NULL,
    NgonNgu      VARCHAR(8)    NOT NULL,
    NgayTruyCap  DATETIME2(0)  NOT NULL CONSTRAINT DF_LuotTruyCap_Ngay DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LuotTruyCap_Ngay' AND object_id = OBJECT_ID(N'dbo.LuotTruyCap'))
    CREATE INDEX IX_LuotTruyCap_Ngay ON dbo.LuotTruyCap (NgayTruyCap) INCLUDE (MaKhach);
GO

-- Tin nhắn từ trang Liên hệ
IF OBJECT_ID(N'dbo.LienHe', N'U') IS NULL
CREATE TABLE dbo.LienHe (
    MaLienHe  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LienHe PRIMARY KEY,
    HoTen     NVARCHAR(100)  NOT NULL,
    Email     NVARCHAR(254)  NOT NULL,
    NoiDung   NVARCHAR(2000) NOT NULL,
    NgayTao   DATETIME2(0)   NOT NULL CONSTRAINT DF_LienHe_NgayTao DEFAULT SYSUTCDATETIME()
);
GO

-- Mỗi lần khách quét mã QR "trải nghiệm với tư cách khách" là một dòng (MaKhach trùng với bảng LuotTruyCap)
IF OBJECT_ID(N'dbo.LuotQuetQR', N'U') IS NULL
CREATE TABLE dbo.LuotQuetQR (
    MaLuotQuet BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LuotQuetQR PRIMARY KEY,
    MaKhach    VARCHAR(64)  NOT NULL,
    NgonNgu    VARCHAR(8)   NOT NULL,
    NgayQuet   DATETIME2(0) NOT NULL CONSTRAINT DF_LuotQuetQR_Ngay DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LuotQuetQR_Ngay' AND object_id = OBJECT_ID(N'dbo.LuotQuetQR'))
    CREATE INDEX IX_LuotQuetQR_Ngay ON dbo.LuotQuetQR (NgayQuet) INCLUDE (MaKhach);
GO

IF OBJECT_ID(N'dbo.NgonNgu', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.NgonNgu (
        MaNgonNgu VARCHAR(8) NOT NULL
            CONSTRAINT PK_NgonNgu PRIMARY KEY,

        TenNgonNgu NVARCHAR(80) NOT NULL,

        TenTiengAnh NVARCHAR(80) NOT NULL,

        TrangThai VARCHAR(10) NOT NULL
            CONSTRAINT DF_NgonNgu_TrangThai
            DEFAULT 'active'
            CONSTRAINT CK_NgonNgu_TrangThai
            CHECK (TrangThai IN ('active', 'inactive')),

        NgayTao DATETIME2(0) NOT NULL
            CONSTRAINT DF_NgonNgu_NgayTao
            DEFAULT SYSUTCDATETIME()
    );

    INSERT INTO dbo.NgonNgu
        (MaNgonNgu, TenNgonNgu, TenTiengAnh, TrangThai)
    VALUES
        ('vi', N'Tiếng Việt', N'Vietnamese', 'active'),
        ('en', N'Tiếng Anh', N'English', 'active'),
        ('zh', N'Tiếng Trung', N'Chinese', 'active');
END;
GO