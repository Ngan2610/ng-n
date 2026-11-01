import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, errorKey, isAdmin, session } from './client.js';
import { ADMIN, CUSTOMER, installMockBackend } from '../test/mockBackend.js';

let backend;
beforeEach(() => { backend = installMockBackend(); });
afterEach(() => vi.unstubAllGlobals());

describe('API tài khoản dùng SQL Server qua backend', () => {
  it('gửi đăng ký và đăng nhập lên backend; không lưu mật khẩu trong trình duyệt', async () => {
    const credentials = { name: 'An', email: 'An@Example.com', password: 'matkhau123' };
    const registered = await api.register(credentials);
    expect(backend.calls[0]).toMatchObject({ path: '/api/auth/register', method: 'POST', body: credentials });
    const res = await api.login({ email: 'an@example.com', password: 'matkhau123' });
    expect(res.user.name).toBe('An');
    expect(res.user.token).toBeTruthy();
    expect(registered.user.email).toBe(res.user.email);
    expect(localStorage.getItem('dubchef-users')).toBeNull();
    expect(localStorage.getItem('dubchef-session')).toBeNull();
  });

  it('hiện lỗi backend cho email trùng và mật khẩu sai', async () => {
    await api.register({ name: 'An', email: 'an@example.com', password: 'matkhau123' });
    await expect(api.register({ name: 'B', email: 'AN@example.com', password: 'khac12345' })).rejects.toMatchObject({ code: 'exists', status: 409 });
    await expect(api.login({ email: 'an@example.com', password: 'saimatkhau' })).rejects.toMatchObject({ code: 'invalid', status: 401 });
  });

  it('gửi tin nhắn kèm token, chỉ lưu phiên đã có token tại máy khách', async () => {
    session.save(CUSTOMER);
    expect((await api.contact({ name: 'An', email: 'an@example.com', message: 'Xin chào' })).ok).toBe(true);
    expect(backend.messages[0].message).toBe('Xin chào');
    expect(backend.calls[0].headers.get('Authorization')).toBe('Bearer customer-token');
    expect(localStorage.getItem('dubchef-messages')).toBeNull();
    expect(session.load()).toEqual(CUSTOMER);
    session.clear();
    expect(session.load()).toBeNull();
    session.save({ name: 'Tự nhận admin', role: 'admin' });
    expect(session.load()).toBeNull();
  });

  it('không tự tạo dữ liệu hoặc đăng nhập khi backend mất kết nối', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(api.register({ name: 'An', email: 'an@example.com', password: 'matkhau123' })).rejects.toMatchObject({ code: 'net' });
    await expect(api.login({ email: 'admin@dubchef.vn', password: 'admin12345' })).rejects.toMatchObject({ code: 'net' });
    expect(localStorage.getItem('dubchef-users')).toBeNull();
    expect(session.load()).toBeNull();
  });

  it('quyền admin dựa trên vai trò/token thay vì địa chỉ email', () => {
    expect(isAdmin({ email: 'admin@dubchef.vn', role: 'user', token: 'user-token' })).toBe(false);
    expect(isAdmin({ email: 'admin@dubchef.vn', role: 'admin' })).toBe(false);
    expect(isAdmin(ADMIN)).toBe(true);
  });

  it('đổi mã lỗi thành khóa dịch', () => {
    expect(errorKey({ code: 'exists' })).toBe('e_exists');
    expect(errorKey({ code: 'invalid' })).toBe('e_login');
    expect(errorKey({ code: 'locked' })).toBe('e_locked');
    expect(errorKey({ code: 'net' })).toBe('e_net');
  });
});
