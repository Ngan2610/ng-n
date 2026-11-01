/** Quản lý tài khoản dùng chung qua API đã xác thực và SQL Server. */
const BASE = ((import.meta.env && import.meta.env.VITE_API_URL) || '').replace(/\/+$/, '');
export const SAMPLE_PREFIX = 'demo-'; // Giữ tên xuất cho mã cũ; không tạo dữ liệu giả.

async function call(method, path, user, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user?.token ? { Authorization: 'Bearer ' + user.token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.code || 'server');
  return data;
}

export const adminApi = {
  async users(user) {
    const { users } = await call('GET', '/api/admin/users', user);
    if (!Array.isArray(users)) throw new Error('server');
    return users;
  },
  setStatus: (user, email, status) => call('PATCH', '/api/admin/users', user, { email, status }),
  remove: (user, email) => call('DELETE', '/api/admin/users?email=' + encodeURIComponent(email), user),
  // Tương thích mã cũ: dữ liệu thật chỉ thay đổi qua API có kiểm tra quyền.
  seed() {},
  clearSamples() {},
};
