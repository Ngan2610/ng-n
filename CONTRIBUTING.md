# Quy ước làm việc nhóm

## Nhánh
- `main`: luôn chạy được; mỗi lần đẩy vào là tự động deploy web lên GitHub Pages.
- `develop`: nhánh tích hợp.
- Làm việc trên nhánh riêng, đặt tên `feature/<việc>` hoặc `fix/<việc>`, rồi mở Pull Request vào `develop`.

## Pull Request
1. Mở PR theo mẫu có sẵn, gắn người cùng nhóm review.
2. CI (lint, test, build) phải xanh trước khi merge.
3. Merge `develop` vào `main` khi đã kiểm tra xong để phát hành.

## Commit
Viết ngắn gọn bằng tiếng Việt hoặc Anh, nêu rõ việc đã làm. Ví dụ: `web: thêm trang Liên hệ`, `ci: dùng npm ci`.

## Phát hành mobile
Gắn tag để build APK bằng EAS: `git tag mobile-v1.0.0 && git push origin mobile-v1.0.0`.
Cần secret `EXPO_TOKEN` trong Settings > Secrets and variables > Actions.

## Phân công
| Thành viên | Vai trò | Phần phụ trách |
|---|---|---|
| (điền) | FE Dev (React.js + React Native, CI/CD) | `web/`, `mobile/`, `shared/`, `.github/` |
| (điền) | BE Dev |  |
