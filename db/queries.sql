-- Một vài câu truy vấn mẫu (mở bằng Azure Data Studio hoặc SSMS, kết nối localhost,1433, user sa)
USE DubchefDB;
GO

-- 1. Các đơn mới nhất kèm mã giao dịch
SELECT TOP (20) o.MaDonHang, o.EmailKhachHang, o.SoVideoDich, o.LoaiTien, o.SoTien, o.TrangThai, p.PhuongThuc, p.MaThamChieu
FROM dbo.DonHang o
LEFT JOIN dbo.GiaoDich p ON p.MaDonHang = o.MaDonHang AND p.TrangThai = 'success'
ORDER BY o.NgayTao DESC;

-- 2. Doanh thu theo ngày
SELECT * FROM dbo.vw_DoanhThuNgay ORDER BY Ngay DESC;

-- 3. Người dùng trả nhiều nhất (theo từng loại tiền)
SELECT TOP (10) EmailKhachHang, LoaiTien, SUM(SoTien) AS Tong
FROM dbo.DonHang
WHERE TrangThai = 'paid'
GROUP BY EmailKhachHang, LoaiTien
ORDER BY Tong DESC;
GO

-- Số người quét mã QR của khách theo ngày (người không trùng và số lượt quét)
SELECT CAST(NgayQuet AS DATE) AS Ngay,
       COUNT(DISTINCT MaKhach) AS NguoiQuet,
       COUNT(*)                  AS LuotQuet
FROM dbo.LuotQuetQR
GROUP BY CAST(NgayQuet AS DATE)
ORDER BY Ngay DESC;

