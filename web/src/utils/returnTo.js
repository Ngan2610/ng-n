/**
 * Sau khi đăng nhập/đăng ký, quay lại trang người dùng đang làm dở (ví dụ Bảng giá)
 * thay vì về trang chủ. Chỉ nhận đường dẫn nội bộ để tránh chuyển hướng ra ngoài.
 */
export function returnTarget(state) {
  const from = state && state.from;
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return null;
  return { to: from, state: state.resume ? { resume: state.resume } : null };
}
