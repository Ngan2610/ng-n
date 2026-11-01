# Dubchef — Web dịch vụ và SQL Server

Bản chỉnh sửa từ `CNPM-main (4).zip`: React/Vite → API Node.js/Express → SQL Server 2022.

## Các luồng đã triển khai

- Đăng ký/lưu tài khoản vào SQL, mật khẩu băm scrypt; đăng nhập và kiểm tra trạng thái tài khoản từ CSDL. Khóa tài khoản chặn cả token đã cấp.
- Trang Trải nghiệm: nhận diện giọng nói/dịch như bản gốc, xem thử video, **Lưu dự án vào SQL**. Video lưu riêng trên máy chủ, thông tin dự án/lời thuyết minh/phụ đề lưu SQL.
- **Dự án của tôi** (`/#/account`): xem lại video, phụ đề, tải SRT, đọc lời thuyết minh bằng giọng trình duyệt, gửi phản hồi và xem câu trả lời.
- Admin: người dùng, video, lời thuyết minh, phụ đề/mốc thời gian, phản hồi/trả lời, thống kê và QR. Chỉ vai trò admin trong CSDL được truy cập API quản trị.
- Các luồng nghiệp vụ web luôn gọi API; không dùng localStorage làm CSDL hoặc tự báo lưu thành công khi backend lỗi. Trình duyệt chỉ giữ phiên, thiết lập và mã khách truy cập.

## Chạy bằng SQL Server đang có trên máy của bạn

Cần Node.js **20.12 trở lên** và SQL Server có bật TCP/IP.

```sh
npm run setup:local
npm run install:app
```

Mở file `.env` vừa tạo. Với máy trong ảnh của bạn:

```ini
DB_HOST=127.0.0.1
DB_PORT=14330
DB_USER=sa
DB_NAME=DubchefDB
DB_TRUST_CERT=true
```

Thay `DB_PASSWORD` bằng mật khẩu SQL Server thực tế **trong file `.env` trên máy bạn**. Giữ `ADMIN_PASSWORD` và `TOKEN_SECRET` ngẫu nhiên do script tạo, hoặc tự đổi. Không gửi mật khẩu vào chat. Sau đó:

```sh
npm start
```

Mở terminal thứ hai:

```sh
npm run web
```

Web: `http://localhost:5173`. API sẵn sàng khi `http://localhost:3000/api/health` trả `{"ok":true,"db":true}`. Vite chuyển `/api` tới backend, không cần cấu hình `web/.env`. Tài khoản admin lấy từ `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env`. API tự chạy `02-schema.sql` và `06-service.sql` theo cách bổ sung, không xóa dữ liệu cũ.

Nếu dùng lại `web/.env` của bản cũ, bỏ các giá trị API/Supabase cũ hoặc đối chiếu `web/.env.example`. Các biến `VITE_*` là công khai, không được chứa mật khẩu.

## Chạy trọn bộ bằng Docker

Nếu chưa có SQL Server khác dùng cổng 14330:

```sh
npm run setup:local
docker compose up -d --build
```

Mở `http://localhost:3000`. Container API phục vụ cả web đã build và API cùng tên miền. SQL lưu trong volume `dubchef-data`, video trong `dubchef-uploads`; dừng bằng `docker compose down` vẫn giữ dữ liệu. **Không dùng `down -v` nếu muốn giữ dữ liệu.** Nếu cổng14330 đã được sử dụng, đặt `SQL_PORT=14331` trong `.env` hoặc dùng cách kết nối SQL Server sẵn có ở trên.

## Kiểm thử

```sh
npm run test:app
npm --prefix web run lint
npm run build
```

Kiểm thử SQL thật tạo một database tạm tên ngẫu nhiên `DubchefIntegration_*`, tự dọn chỉ database đó. Cần SQL Server chạy và thông tin DB qua biến môi trường. Xem hướng dẫn chi tiết trong [docs/HUONG_DAN_SQL.md](docs/HUONG_DAN_SQL.md).

## Phạm vi và phần chưa tích hợp

- Lời thuyết minh được quản lý dưới dạng **văn bản**; giọng đọc dùng Web Speech API. Chưa có xuất MP4 lồng tiếng/thu âm giọng AI phía máy chủ.
- Whisper tải model trong trình duyệt; dịch MyMemory cần Internet và có hạn mức. Có thể nhập lời thoại và tắt dịch để làm việc mà không gọi các dịch vụ đó.
- Chưa tích hợp cổng thanh toán thật. Đơn lưu SQL ở trạng thái chờ; API từ chối tự xác nhận thu tiền. `PAYMENT_DEMO=true` chỉ dùng thử mô phỏng và UI có nhãn mô phỏng.
- Chưa triển khai email xác minh, quên mật khẩu qua email, hàng đợi xử lý video, giám sát/backup tự động hoặc hạ tầng production. Không xem bản này là đã nghiệm thu vận hành thương mại.
- Không thay đổi ứng dụng `mobile/` trong lần chỉnh web này.

Xem [hướng dẫn SQL, cấu trúc dữ liệu và kiểm tra trong SSMS](docs/HUONG_DAN_SQL.md).
