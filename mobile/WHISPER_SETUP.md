# Tự nhận diện giọng nói trên điện thoại (whisper.rn) — hướng dẫn build

Code tích hợp đã có sẵn trong `src/utils/sttNative.js` và `src/screens/DemoScreen.js`.
Nhưng đây là một thư viện **native** (code C++ biên dịch riêng cho Android/iOS), nên
**Expo Go (quét mã QR) sẽ không chạy được** — phải build app thật theo các bước dưới đây.

Nếu chưa build native, app vẫn chạy bình thường qua Expo Go như cũ — chỉ riêng ô
"để trống lời thoại để tự nhận diện" sẽ báo "chưa khả dụng" và người dùng vẫn có thể
gõ tay lời thoại như trước (không có gì bị hỏng).

## 0. Vì sao phức tạp hơn bản web

- Bản web chạy Whisper bằng WebAssembly ngay trong trình duyệt — không cần build gì thêm.
- Trên điện thoại, không có môi trường tương đương, nên phải dùng `whisper.rn`
  (bind của `whisper.cpp`) — là module native thật, cần biên dịch vào app.
- `whisper.rn` chỉ nhận file `.wav` PCM 16kHz mono, **không đọc trực tiếp file video**,
  nên cần thêm `ffmpeg-kit-react-native` để tách âm thanh từ video ra `.wav` trước.
- Model nhận diện giọng nói (`ggml-tiny.bin`, ~75MB) không đóng gói sẵn trong app —
  app tự tải về máy trong lần chạy đầu tiên (code đã viết sẵn ở `ensureModelDownloaded`
  trong `sttNative.js`), nên lần đầu cần Internet và chờ một chút.

## 1. Cài thư viện

```bash
cd mobile
npm install
```

(package.json đã thêm `whisper.rn`, `ffmpeg-kit-react-native`, `expo-file-system`.)

## 2. Prebuild — rời khỏi Expo Go, tạo project native thật

```bash
npx expo prebuild
```

Lệnh này tạo ra 2 thư mục mới `android/` và `ios/` — đây là project Android Studio /
Xcode thật, không còn chạy qua Expo Go được nữa. Từ giờ chạy app bằng:

```bash
npx expo run:android     # cần Android Studio + 1 máy ảo hoặc điện thoại nối USB
npx expo run:ios         # cần máy Mac + Xcode
```

(Có `eas.json` sẵn trong project nếu nhóm muốn build bằng EAS Build của Expo thay vì
máy cá nhân — xem `eas build --platform android --profile development`.)

## 3. Chạy thử

- Mở app trên máy ảo/điện thoại thật → vào tab "Demo" → chọn video → **để trống** ô
  lời thoại → bấm "Dịch".
- Lần đầu sẽ thấy giai đoạn "Nhận diện giọng nói" chạy lâu hơn bình thường (đang tải
  model ~75MB) — các lần sau sẽ nhanh vì model đã lưu trên máy.
- Nếu báo lỗi "không nhận diện được", kiểm tra: máy có kết nối Internet lúc tải model
  lần đầu không; video có giọng nói rõ không.

## 4. Lưu ý khi báo cáo / demo với giảng viên

- Có thể demo **cả 2 chế độ** trong cùng 1 app để cho thấy rõ sự khác biệt: gõ tay lời
  thoại (không cần build native, chạy ngay qua Expo Go) **và** tự nhận diện (cần bản
  build native có whisper.rn).
- Nếu không đủ thời gian build thật trên máy ảo trước buổi báo cáo, vẫn có thể trình
  bày: code đã viết đầy đủ, chỉ cần `expo prebuild` + `expo run:android` là chạy được —
  nêu rõ đây là giới hạn về MÔI TRƯỜNG BUILD, không phải về mặt thiết kế/code.

## 5. Nếu đổi ý, muốn quay lại Expo Go

Chỉ cần xoá 2 thư mục `android/` và `ios/` vừa tạo ra — project trở lại managed workflow
như cũ (nhưng khi đó tính năng tự nhận diện trên điện thoại sẽ lại báo "chưa khả dụng").
