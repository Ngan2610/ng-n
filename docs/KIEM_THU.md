# Kết quả kiểm tra bản chỉnh sửa

Mã nguồn sử dụng: `CNPM-main (4).zip`. File `dubchef test (2).zip` vượt giới hạn tải32MiB của công cụ nên chưa được giải nén, đối chiếu hoặc gộp vào bản này.

- Web:111/111 test Vitest đạt (13 file), gồm đăng ký/đăng nhập, dữ liệu tài khoản, lưu dự án, xử lý lỗi SQL/API, phản hồi, admin và SRT.
- Backend:22 test đạt,1 test SQL integration được bỏ qua có chủ đích vì chưa có SQL Server chạy tại đây. Kiểm thử API sử dụng repository giả trong bộ nhớ; không thay thế bằng chứng truy vấn SQL thật.
- Shared:18/18 test nội dung, giá và dịch thuật đạt.
- ESLint web: đạt. Build production: đạt; thư viện ONNX/Whisper có cảnh báo eval từ dependency.
- Chromium154:7 luồng đạt qua web/API HTTP thật với repository giả trong bộ nhớ: đăng nhập khách, mở dự án/gửi phản hồi; admin sửa thuyết minh; sửa phụ đề tiếng Anh và mốc5–8.5giây; trả lời phản hồi; khách tải lại xem nội dung mới và xuất SRT đúng; khôi phục phiên sau reload; khách bị chặn trang/API admin. Không có lỗi JavaScript trang.
- Cấu hình Docker Compose: kiểm tra cú pháp/biến môi trường đạt. Chưa build/chạy trọn bộ Docker tại đây.
- Script tạo `.env` đã chạy hai lần: lần sau giữ nguyên file hiện có. Không đưa file `.env`, mật khẩu sinh tự động, node_modules, video người dùng hoặc dump dữ liệu vào ZIP bàn giao.

## Kiểm tra SQL còn phải thực hiện

Đã thử tải image SQL Server2022 chính thức. Registry chuyển tải sang `westus.data.mcr.microsoft.com`, bị chính sách mạng môi trường trả403. Đã lưu thêm miền này vào **cấu hình nháp** của môi trường, chưa áp dụng hoặc publish. Muốn kiểm thử ở cloud: review, lưu và publish cấu hình trong Environment Settings rồi chạy lại SQL integration. Không cần thao tác này nếu chạy mã nguồn với SQL Server trên máy bạn theo `HUONG_DAN_SQL.md`.

Chưa kết nối hay thay đổi database trong ảnh của bạn. Cần chạy bản này trên máy có kết nối SQL đó, xác nhận `/api/health`, chạy kiểm thử SQL integration và kiểm tra `db/07-service-queries.sql`. Không thể khẳng định dữ liệu đã được ghi vào SQL của bạn trước khi thực hiện bước đó.

Thanh toán thật, xác minh email/khôi phục mật khẩu qua email và xuất MP4 có giọng thuyết minh chưa tích hợp; xem README để tránh nhầm với chức năng đã thực hiện.
