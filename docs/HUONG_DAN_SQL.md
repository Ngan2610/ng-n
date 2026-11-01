# Hướng dẫn SQL Server và kiểm tra luồng dịch vụ

## 1. Kết nối đúng SQL Server trong ảnh

Ảnh SSMS cho thấy server `127.0.0.1,14330`, database `DubchefDB`. Đây là SQL Server trên máy của bạn; `127.0.0.1` trong máy cloud là một máy khác. Mã nguồn đã được nối SQL nhưng cần chạy backend trên máy có kết nối đến SQL Server của bạn để thấy dữ liệu trong SSMS đó.

Chạy `npm run setup:local` tại thư mục dự án. Chỉnh `.env`: `DB_HOST=127.0.0.1`, `DB_PORT=14330`, `DB_NAME=DubchefDB`, `DB_USER=sa`, `DB_PASSWORD` là mật khẩu của SQL đang chạy, `DB_TRUST_CERT=true` chỉ cho SQL phát triển dùng chứng chỉ tự ký. `npm start` sẽ tự tạo bảng còn thiếu. Nếu database đã có và user không có quyền tạo database, đặt `DB_SKIP_CREATE=true`; user vẫn cần quyền tạo/đổi các bảng và đọc/ghi dữ liệu.

Không chạy đồng thời container SQL mới vào đúng cổng SQL hiện có. Nếu dùng Docker toàn bộ dự án và vẫn giữ SQL cũ, chọn `SQL_PORT=14331`; hai SQL Server này có dữ liệu riêng.

## 2. Bảng dữ liệu

| Chức năng | Bảng |
|---|---|
| Tài khoản, vai trò, trạng thái, lần đăng nhập cuối | `dbo.NguoiDung` |
| Dự án/video và chủ sở hữu | `dbo.Video` |
| Lời thuyết minh theo dự án/ngôn ngữ | `dbo.ThuyetMinh` |
| Phụ đề, thứ tự, mốc bắt đầu/kết thúc từng ngôn ngữ | `dbo.PhuDe` |
| Nội dung liên hệ/phản hồi và câu trả lời admin | `dbo.LienHe` |
| Đơn hàng và giao dịch mô phỏng nếu bật | `dbo.DonHang`, `dbo.GiaoDich` |
| Lượt xem, lượt mở QR | `dbo.LuotTruyCap`, `dbo.LuotQuetQR` |

Video không lưu VARBINARY trong SQL: file nằm ở `server/uploads/`, SQL lưu đường dẫn và chủ sở hữu. Phải sao lưu cả SQL và thư mục uploads/volume. API video yêu cầu phiên hợp lệ và đúng chủ sở hữu/admin.

Tài khoản cũ được tạo bằng `05-sqlserver-tai-khoan.sql` (hash SHA256 kèm salt) được kiểm tra tương thích và tự nâng sang scrypt sau lần đăng nhập thành công.

Đơn hàng/nhắn tin cũ không có ID chủ tài khoản vẫn giữ trong SQL, không tự gán cho tài khoản mới chỉ vì email giống nhau. Bản ghi phản hồi cũ vẫn xem được bên admin.

Chỉ `02-schema.sql` và `06-service.sql` được backend tự migrate. `03-admin.sql`, `05-sqlserver-tai-khoan.sql`, các file Supabase và `db/db.js` là tài liệu/cách làm cũ, không phải backend đang dùng. Không trộn các thủ tục xác thực cũ vào luồng web mới.

## 3. Kiểm tra thủ công trên web và SSMS

1. Đăng ký một khách hàng mới, đăng xuất, đăng nhập lại. Mở `db/07-service-queries.sql` trong SSMS: tài khoản phải có trong `NguoiDung` và có `LanDangNhapCuoi`.
2. Vào Trải nghiệm, chọn video MP4/WebM/MOV dưới100MB, nhập lời thoại (hoặc nhận diện Whisper), xử lý, đặt tên dự án rồi bấm **Lưu dự án vào SQL**. Nếu lỗi, UI phải báo chưa lưu, không hiện thành công.
3. Vào **Dự án của tôi**. Kiểm tra video, văn bản, phụ đề và tải SRT. Tải lại trang/đăng nhập ở trình duyệt khác vẫn thấy cùng dự án.
4. Đăng nhập admin bằng thông tin trong `.env`. Vào **Thuyết minh**, sửa văn bản/trạng thái; vào **Phụ đề**, sửa nội dung và thời gian. Khách hàng tải lại danh sách để thấy thay đổi.
5. Khách hàng gửi phản hồi khi đã đăng nhập. Admin mở **Phản hồi**, nhập câu trả lời và lưu. Khách hàng tải lại `/account` để thấy câu trả lời. Tin liên hệ gửi khi chưa đăng nhập vẫn nằm trong hộp admin; không tự gán quyền xem lịch sử riêng tư chỉ dựa vào email do khách vãng lai nhập.
6. Admin khóa khách hàng. Khách hàng phải bị từ chối khi gọi API với cả phiên cũ. Khách A không được đọc file/dự án/đơn của khách B.
7. Đơn thanh toán mặc định giữ `pending`; chưa có nhà cung cấp thanh toán thì không được tự ghi `paid` chỉ vì bấm nút.

Các trang web không trực tiếp kết nối SQL; chúng gọi Node API, API dùng truy vấn có tham số. Không đưa chuỗi kết nối/mật khẩu DB vào mã React.

## 4. Chạy kiểm thử SQL thật

Khởi động SQL trước. Có thể dùng script PowerShell sau để nạp riêng các biến DB từ `.env` (không in giá trị):

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^(DB_[A-Z_]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
$env:DB_INTEGRATION='true'
node --test server/test/sql.integration.test.mjs
```

Trên Bash:

```sh
set -a
. ./.env
set +a
DB_INTEGRATION=true node --test server/test/sql.integration.test.mjs
```

Test tạo database tạm ngẫu nhiên và chỉ xóa database do chính test tạo. Kiểm tra đăng ký, đăng nhập, hash mật khẩu, SQL phụ đề/thuyết minh, phản hồi, phân quyền và dữ liệu còn sau khi đóng/mở kết nối và chạy migrate lại. Không chạy trên tài khoản không được phép tạo database kiểm thử.

## 5. Đưa lên máy chủ

Đặt `TOKEN_SECRET` dài và ổn định, mật khẩu admin/DB riêng; HTTPS ở reverse proxy; chỉ cho API truy cập SQL, không mở cổng SQL ra Internet. Dùng chứng chỉ DB tin cậy và `DB_TRUST_CERT=false` khi kết nối SQL bên ngoài môi trường phát triển. Compose chỉ bind cổng vào loopback; cấu hình reverse proxy để công khai web/API. Đặt giới hạn dung lượng và sao lưu uploads/SQL phù hợp hạ tầng; mỗi video tối đa100MB, mỗi tài khoản mặc định500MB, tổng uploads mặc định5GB. Có thể chỉnh `UPLOAD_QUOTA_MB` và `UPLOAD_TOTAL_QUOTA_MB` qua biến môi trường; một tài khoản chỉ có một upload đồng thời. Hiện không có cơ chế tự dọn file không còn được dự án tham chiếu.

Thay `ADMIN_PASSWORD` trong `.env` không tự đổi mật khẩu của tài khoản admin đã tồn tại. Khi khởi tạo lần đầu, API tạo admin nếu email chưa có, không tự nâng quyền tài khoản khách hàng trùng email.

GitHub Pages chỉ host giao diện tĩnh. Nếu dùng workflow CD Web, phải đặt repository variable `VITE_API_URL` là URL HTTPS backend đã triển khai và cấu hình `CORS_ORIGIN` cho đúng miền Pages. Thiếu biến này workflow không deploy; có thể dùng Docker để phục vụ web và API cùng tên miền.
