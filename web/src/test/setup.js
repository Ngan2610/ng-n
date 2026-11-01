import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom chưa có các hàm cuộn trang
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

// jsdom chưa hỗ trợ tạo/huỷ URL tạm cho file (dùng khi người dùng chọn video để xem trước)
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock-url';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

beforeEach(() => {
  localStorage.clear(); // mỗi bài test bắt đầu với trình duyệt "sạch"
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});
