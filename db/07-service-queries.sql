-- Mở DubchefDB trong SSMS / Azure Data Studio sau khi API đã khởi động.
-- Chỉ đọc dữ liệu, không tạo tài khoản mẫu và không thay đổi dữ liệu.
-- Với DB_NAME tùy chỉnh, thay tên database bên dưới trước khi chạy.
USE DubchefDB;
GO

SELECT MaNguoiDung, HoTen, Email, VaiTro, TrangThai, NgayTao, LanDangNhapCuoi
FROM dbo.NguoiDung ORDER BY NgayTao DESC, MaNguoiDung DESC;

SELECT v.MaVideo, u.Email, v.TieuDe, v.NgonNguGoc, v.TenTepGoc, v.DuongDan,
       v.TrangThai, v.NgayTaiLen
FROM dbo.Video v JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung
ORDER BY v.NgayTaiLen DESC, v.MaVideo DESC;

SELECT t.MaThuyetMinh, t.MaVideo, v.TieuDe, u.Email, t.MaNgonNgu,
       t.NoiDung, t.TrangThai, t.NgayCapNhat
FROM dbo.ThuyetMinh t JOIN dbo.Video v ON v.MaVideo = t.MaVideo
JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung
ORDER BY t.MaVideo DESC, t.MaNgonNgu;

SELECT p.MaPhuDe, p.MaVideo, v.TieuDe, u.Email, p.MaNgonNgu,
       p.ThuTu, p.BatDau, p.KetThuc, p.NoiDung, p.NgayCapNhat
FROM dbo.PhuDe p JOIN dbo.Video v ON v.MaVideo = p.MaVideo
JOIN dbo.NguoiDung u ON u.MaNguoiDung = v.MaNguoiDung
ORDER BY p.MaVideo DESC, p.ThuTu, p.MaNgonNgu;

SELECT MaLienHe, MaNguoiDung, HoTen, Email, NoiDung, TraLoi, TrangThai, NgayTao, NgayTraLoi
FROM dbo.LienHe ORDER BY NgayTao DESC, MaLienHe DESC;
