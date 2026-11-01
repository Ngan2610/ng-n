-- Bổ sung lưu trữ dự án, lời thuyết minh, phụ đề và trả lời khách hàng.
-- API tự chạy sau 02-schema.sql. Có thể chạy lại, không xóa dữ liệu cũ.
IF COL_LENGTH(N'dbo.NguoiDung', N'LanDangNhapCuoi') IS NULL
    ALTER TABLE dbo.NguoiDung ADD LanDangNhapCuoi DATETIME2(0) NULL;
GO

-- Không tự diễn giải hoặc sửa phá hủy một bảng Video từ phiên bản khác.
IF OBJECT_ID(N'dbo.Video', N'U') IS NOT NULL AND (
    COL_LENGTH(N'dbo.Video', N'MaVideo') IS NULL OR
    COL_LENGTH(N'dbo.Video', N'MaNguoiDung') IS NULL OR
    COL_LENGTH(N'dbo.Video', N'TieuDe') IS NULL OR
    COL_LENGTH(N'dbo.Video', N'NgonNguGoc') IS NULL OR
    COL_LENGTH(N'dbo.Video', N'DuongDan') IS NULL OR
    COL_LENGTH(N'dbo.Video', N'TrangThai') IS NULL OR
    COL_LENGTH(N'dbo.Video', N'NgayTaiLen') IS NULL OR
    COLUMNPROPERTY(OBJECT_ID(N'dbo.Video'), N'MaVideo', 'IsIdentity') <> 1
)
    THROW 51006, N'Bảng Video có cấu trúc từ phiên bản khác. Hãy sao lưu database và đối chiếu db/06-service.sql trước khi chuyển đổi; API không tự xóa hoặc đổi dữ liệu cũ.', 1;
GO

IF OBJECT_ID(N'dbo.Video', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Video (
        MaVideo INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Video PRIMARY KEY,
        MaNguoiDung INT NOT NULL CONSTRAINT FK_Video_NguoiDung
            REFERENCES dbo.NguoiDung(MaNguoiDung) ON DELETE CASCADE,
        TieuDe NVARCHAR(200) NOT NULL,
        NgonNguGoc VARCHAR(8) NOT NULL,
        DuongDan NVARCHAR(1000) NULL,
        TenTepGoc NVARCHAR(255) NULL,
        TrangThai VARCHAR(20) NOT NULL CONSTRAINT DF_Video_TrangThai DEFAULT 'ready',
        NgayTaiLen DATETIME2(0) NOT NULL CONSTRAINT DF_Video_NgayTaiLen DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- Các bản cũ có thể đã có bảng Video từ một script riêng.
IF COL_LENGTH(N'dbo.Video', N'TenTepGoc') IS NULL
    ALTER TABLE dbo.Video ADD TenTepGoc NVARCHAR(255) NULL;
GO

IF OBJECT_ID(N'dbo.ThuyetMinh', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ThuyetMinh (
        MaThuyetMinh INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ThuyetMinh PRIMARY KEY,
        MaVideo INT NOT NULL CONSTRAINT FK_ThuyetMinh_Video
            REFERENCES dbo.Video(MaVideo) ON DELETE CASCADE,
        MaNgonNgu VARCHAR(8) NOT NULL,
        NoiDung NVARCHAR(MAX) NOT NULL,
        TrangThai VARCHAR(10) NOT NULL CONSTRAINT DF_ThuyetMinh_TrangThai DEFAULT 'draft'
            CONSTRAINT CK_ThuyetMinh_TrangThai CHECK (TrangThai IN ('draft', 'ready')),
        NgayTao DATETIME2(0) NOT NULL CONSTRAINT DF_ThuyetMinh_NgayTao DEFAULT SYSUTCDATETIME(),
        NgayCapNhat DATETIME2(0) NOT NULL CONSTRAINT DF_ThuyetMinh_NgayCapNhat DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ThuyetMinh_Video_NgonNgu UNIQUE (MaVideo, MaNgonNgu)
    );
END;
GO

IF COL_LENGTH(N'dbo.ThuyetMinh', N'MaThuyetMinh') IS NULL OR
   COL_LENGTH(N'dbo.ThuyetMinh', N'MaVideo') IS NULL OR
   COL_LENGTH(N'dbo.ThuyetMinh', N'MaNgonNgu') IS NULL OR
   COL_LENGTH(N'dbo.ThuyetMinh', N'NoiDung') IS NULL OR
   COL_LENGTH(N'dbo.ThuyetMinh', N'TrangThai') IS NULL OR
   COL_LENGTH(N'dbo.ThuyetMinh', N'NgayTao') IS NULL OR
   COL_LENGTH(N'dbo.ThuyetMinh', N'NgayCapNhat') IS NULL
    THROW 51006, N'Bảng ThuyetMinh không tương thích. Hãy sao lưu và đối chiếu cấu trúc với db/06-service.sql; không xóa dữ liệu để chạy lại.', 1;
GO

IF OBJECT_ID(N'dbo.PhuDe', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PhuDe (
        MaPhuDe INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PhuDe PRIMARY KEY,
        MaVideo INT NOT NULL CONSTRAINT FK_PhuDe_Video
            REFERENCES dbo.Video(MaVideo) ON DELETE CASCADE,
        MaNgonNgu VARCHAR(8) NOT NULL,
        ThuTu INT NOT NULL,
        NoiDung NVARCHAR(4000) NOT NULL,
        BatDau DECIMAL(12,3) NULL,
        KetThuc DECIMAL(12,3) NULL,
        NgayTao DATETIME2(0) NOT NULL CONSTRAINT DF_PhuDe_NgayTao DEFAULT SYSUTCDATETIME(),
        NgayCapNhat DATETIME2(0) NOT NULL CONSTRAINT DF_PhuDe_NgayCapNhat DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_PhuDe_ThoiGian CHECK (
            (BatDau IS NULL AND KetThuc IS NULL) OR
            (BatDau IS NOT NULL AND KetThuc IS NOT NULL AND BatDau >= 0 AND KetThuc > BatDau)
        ),
        CONSTRAINT UQ_PhuDe_Video_NgonNgu_ThuTu UNIQUE (MaVideo, MaNgonNgu, ThuTu)
    );
END;
GO

IF COL_LENGTH(N'dbo.PhuDe', N'MaPhuDe') IS NULL OR
   COL_LENGTH(N'dbo.PhuDe', N'MaVideo') IS NULL OR
   COL_LENGTH(N'dbo.PhuDe', N'MaNgonNgu') IS NULL OR
   COL_LENGTH(N'dbo.PhuDe', N'ThuTu') IS NULL OR
   COL_LENGTH(N'dbo.PhuDe', N'NoiDung') IS NULL OR
   COL_LENGTH(N'dbo.PhuDe', N'BatDau') IS NULL OR
   COL_LENGTH(N'dbo.PhuDe', N'KetThuc') IS NULL OR
   COL_LENGTH(N'dbo.PhuDe', N'NgayTao') IS NULL OR
   COL_LENGTH(N'dbo.PhuDe', N'NgayCapNhat') IS NULL
    THROW 51006, N'Bảng PhuDe không tương thích. Hãy sao lưu và đối chiếu cấu trúc với db/06-service.sql; không xóa dữ liệu để chạy lại.', 1;
GO

IF COL_LENGTH(N'dbo.LienHe', N'TraLoi') IS NULL
    ALTER TABLE dbo.LienHe ADD TraLoi NVARCHAR(2000) NULL;
GO
IF COL_LENGTH(N'dbo.LienHe', N'TrangThai') IS NULL
    ALTER TABLE dbo.LienHe ADD TrangThai VARCHAR(10) NOT NULL
        CONSTRAINT DF_LienHe_TrangThai DEFAULT 'open' WITH VALUES;
GO
IF COL_LENGTH(N'dbo.LienHe', N'NgayTraLoi') IS NULL
    ALTER TABLE dbo.LienHe ADD NgayTraLoi DATETIME2(0) NULL;
GO
-- Tin nhắn gửi khi đăng nhập gắn với ID tài khoản, không gắn bằng email do khách tự nhập.
-- Không hồi tố chủ sở hữu của tin nhắn cũ/khách vãng lai vì chưa xác minh email.
IF COL_LENGTH(N'dbo.LienHe', N'MaNguoiDung') IS NULL
    ALTER TABLE dbo.LienHe ADD MaNguoiDung INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_LienHe_NguoiDung')
    ALTER TABLE dbo.LienHe ADD CONSTRAINT FK_LienHe_NguoiDung
        FOREIGN KEY (MaNguoiDung) REFERENCES dbo.NguoiDung(MaNguoiDung) ON DELETE SET NULL;
GO
-- Đơn hàng cũng thuộc ID tài khoản. Không tự nhận lại đơn cũ chỉ vì đăng ký cùng email.
IF COL_LENGTH(N'dbo.DonHang', N'MaNguoiDung') IS NULL
    ALTER TABLE dbo.DonHang ADD MaNguoiDung INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_DonHang_NguoiDung')
    ALTER TABLE dbo.DonHang ADD CONSTRAINT FK_DonHang_NguoiDung
        FOREIGN KEY (MaNguoiDung) REFERENCES dbo.NguoiDung(MaNguoiDung) ON DELETE SET NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Video_NguoiDung' AND object_id = OBJECT_ID(N'dbo.Video'))
    CREATE INDEX IX_Video_NguoiDung ON dbo.Video(MaNguoiDung, NgayTaiLen DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LienHe_Email' AND object_id = OBJECT_ID(N'dbo.LienHe'))
    CREATE INDEX IX_LienHe_Email ON dbo.LienHe(Email, NgayTao DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LienHe_NguoiDung' AND object_id = OBJECT_ID(N'dbo.LienHe'))
    CREATE INDEX IX_LienHe_NguoiDung ON dbo.LienHe(MaNguoiDung, NgayTao DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DonHang_NguoiDung' AND object_id = OBJECT_ID(N'dbo.DonHang'))
    CREATE INDEX IX_DonHang_NguoiDung ON dbo.DonHang(MaNguoiDung, NgayTao DESC);
GO
