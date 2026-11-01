import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils.jsx';
import { I } from '../shared/i18n.js';
import { api, errorKey } from '../api/client.js';
import { addVisit, change, sampleData, summarize } from '../api/analytics.js';
import { adminApi } from '../api/admin.js';
import { filterUsers, toCsv } from '../pages/AdminUsers.jsx';

const at = (d, h = 10) => new Date(2026, 9, d, h, 0);
const ADMIN_EMAIL = 'admin@dubchef.vn';
const ADMIN = { name: 'Admin', email: ADMIN_EMAIL, role: 'admin', token: 'admin-token' };
const loginAsAdmin = () => localStorage.setItem('dubchef-session', JSON.stringify(ADMIN));
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
let users;
let fetchMock;
beforeEach(() => {
  users = Array.from({ length: 12 }, (_, n) => ({ name: n === 8 ? 'Ngô Đức Thịnh' : 'Khách ' + (n + 1), email: 'customer-' + (n + 1) + '@example.com', at: '2026-10-' + String(n + 1).padStart(2, '0'), status: n === 4 ? 'locked' : 'active' }));
  fetchMock = vi.fn(async (input, options = {}) => {
    const url = new URL(String(input), 'http://test');
    const body = options.body ? JSON.parse(options.body) : {};
    if (url.pathname === '/api/auth/me') return response({ user: options.headers?.Authorization === 'Bearer admin-token' ? ADMIN : { name: 'An', email: 'an@example.com', role: 'user' } });
    if (url.pathname === '/api/admin/users') {
      if (options.method === 'PATCH') users = users.map((u) => u.email === body.email ? { ...u, status: body.status } : u);
      if (options.method === 'DELETE') users = users.filter((u) => u.email !== url.searchParams.get('email'));
      return response(options.method === 'GET' ? { users } : { ok: true });
    }
    if (url.pathname === '/api/admin/overview') return response({ stats: summarize(sampleData(at(22)), at(22), Number(url.searchParams.get('days')) || 7) });
    if (url.pathname === '/api/admin/statistics') return response({ statistics: { totalUsers: 12, totalVideos: 4, totalLanguages: 3, totalQrScans: 7, totalVisits: 9 } });
    return response({}, 204);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('thống kê truy cập', () => {
  it('đếm người truy cập duy nhất, lượt xem, kỳ trước và ngày cao nhất', () => {
    const data = { visitors: {}, days: {} };
    addVisit(data, { id: 'a', path: '/', lang: 'vi', at: at(22) });
    addVisit(data, { id: 'a', path: '/pricing', lang: 'vi', at: at(22, 11) });
    addVisit(data, { id: 'b', path: '/', lang: 'en', at: at(22, 12) });
    addVisit(data, { id: 'a', path: '/', lang: 'vi', at: at(21) });
    addVisit(data, { id: 'c', path: '/', lang: 'vi', at: at(10) }); // thuộc kỳ trước (7 ngày)
    const s = summarize(data, at(22, 12), 7);
    expect(s.today).toEqual({ visitors: 2, views: 3 });
    expect(s.yesterday).toEqual({ visitors: 1, views: 1 });
    expect(s.period).toEqual({ visitors: 2, views: 4 });
    expect(s.prev.visitors).toBe(1);
    expect(s.total).toEqual({ visitors: 3, views: 5 });
    expect(s.series).toHaveLength(7);
    expect(s.peak).toEqual({ date: '2026-10-22', visitors: 2 });
    expect(summarize(data, at(22, 12), 30).series).toHaveLength(30);
  });

  it('"đang truy cập" chỉ tính người hoạt động trong 5 phút', () => {
    const data = { visitors: {}, days: {} };
    addVisit(data, { id: 'a', path: '/', lang: 'vi', at: new Date(2026, 9, 22, 12, 0) });
    addVisit(data, { id: 'b', path: '/', lang: 'vi', at: new Date(2026, 9, 22, 12, 8) });
    expect(summarize(data, new Date(2026, 9, 22, 12, 10)).activeNow).toBe(1);
  });

  it('phần trăm thay đổi', () => {
    expect(change(15, 10)).toBe(50);
    expect(change(5, 10)).toBe(-50);
    expect(change(5, 0)).toBeNull();
  });

  it('dữ liệu mẫu có số liệu hợp lý', () => {
    const s = summarize(sampleData(at(22)), at(22), 30);
    expect(s.total.visitors).toBeGreaterThan(0);
    expect(s.period.views).toBeGreaterThanOrEqual(s.period.visitors);
    expect(s.prev.visitors).toBeGreaterThan(0);
  });
});

describe('quản lý người dùng (hàm thuần)', () => {
  const users = [
    { name: 'Lê An', email: 'an@x.com', at: '2026-10-01', status: 'active' },
    { name: 'Bùi Bình', email: 'binh@x.com', at: '2026-10-05', status: 'locked' },
  ];
  it('tìm theo tên hoặc email và sắp xếp', () => {
    expect(filterUsers(users, 'BINH', 'new').map((u) => u.email)).toEqual(['binh@x.com']);
    expect(filterUsers(users, '', 'new')[0].email).toBe('binh@x.com');
    expect(filterUsers(users, '', 'name')[0].name).toBe('Bùi Bình');
  });
  it('xuất CSV đúng dấu ngoặc kép', () => {
    const csv = toCsv([{ name: 'A "B", C', email: 'a@x.com', at: null, status: 'active' }]);
    expect(csv.split('\n')[1]).toBe('"A ""B"", C","a@x.com","","active"');
  });
});

describe('API dùng dữ liệu SQL Server', () => {
  it('chuyển thông tin đăng nhập tới máy chủ, không dùng tài khoản admin có sẵn trong trình duyệt', async () => {
    fetchMock.mockImplementationOnce(async () => response({ user: ADMIN }));
    expect((await api.login({ email: ADMIN_EMAIL, password: 'example-password' })).user.role).toBe('admin');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/login'), expect.objectContaining({ body: JSON.stringify({ email: ADMIN_EMAIL, password: 'example-password' }) }));
    expect(localStorage.getItem('dubchef-users')).toBeNull();
  });

  it('trả lỗi tài khoản bị khóa từ máy chủ', async () => {
    fetchMock.mockImplementationOnce(async () => response({ code: 'locked' }, 403));
    const err = await api.login({ email: 'an@example.com', password: 'example-password' }).catch((e) => e);
    expect(err.code).toBe('locked');
    expect(errorKey(err)).toBe('e_locked');
  });

  it('gửi token và không giả thành công khi máy chủ từ chối quyền', async () => {
    fetchMock.mockImplementationOnce(async () => response({ code: 'forbidden' }, 403));
    await expect(adminApi.setStatus(ADMIN, 'an@example.com', 'locked')).rejects.toThrow('forbidden');
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/api/admin/users'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }) }));
    adminApi.seed();
    expect(localStorage.getItem('dubchef-users')).toBeNull();
  });
});

describe('Trang /admin', () => {
  it('chưa đăng nhập thì yêu cầu đăng nhập', async () => {
    renderApp('/admin');
    expect(await screen.findByRole('alert')).toHaveTextContent(I.ad_need_login[0]);
  });

  it('tài khoản thường bị từ chối và không thấy mục Quản trị', async () => {
    localStorage.setItem('dubchef-session', JSON.stringify({ name: 'An', email: 'an@example.com', token: 'user-token' }));
    renderApp('/admin');
    expect(await screen.findByRole('alert')).toHaveTextContent(I.ad_denied[0]);
    expect(screen.queryByRole('link', { name: I.nav_admin[0] })).toBeNull();
  });

  it('trang quản trị không hiện menu của trang chính', async () => {
    loginAsAdmin();
    renderApp('/admin');
    await screen.findByTestId('ad-total');
    expect(screen.queryByRole('link', { name: I.nav_pricing[0] })).toBeNull();
    expect(screen.getByRole('link', { name: I.ad_nav_users[0] })).toBeInTheDocument();
  });

  it('thấy số người truy cập từ API và đổi khoảng thời gian', async () => {
    const user = userEvent.setup();
    loginAsAdmin();
    renderApp('/admin');
    await screen.findByTestId('ad-total');
    expect(screen.getByTestId('ad-period-trend').textContent).toMatch(/%/);
    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.queryByRole('button', { name: I.ad_seed[0] })).toBeNull();
    await user.click(screen.getByRole('button', { name: I.ad_r30[0] }));
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(31));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/admin/overview?days=30'), expect.objectContaining({ headers: { Authorization: 'Bearer admin-token' } }));
  });
});

describe('Trang /admin/users', () => {
  async function open() {
    const user = userEvent.setup();
    loginAsAdmin();
    renderApp('/admin/users');
    await screen.findByTestId('us-total');
    return user;
  }

  it('hiện số người dùng, tìm kiếm và phân trang', async () => {
    const user = await open();
    expect(screen.getByTestId('us-total')).toHaveTextContent('12');
    expect(screen.getByTestId('us-locked')).toHaveTextContent('1');
    expect(screen.getAllByRole('row')).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: I.ad_next[0] }));
    expect(screen.getAllByRole('row')).toHaveLength(5);
    await user.type(screen.getByRole('searchbox'), 'thịnh');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'không-có-ai');
    expect(screen.getByText(I.ad_no_match[0])).toBeInTheDocument();
  });

  it('khóa, mở khóa và xóa qua API có xác nhận', async () => {
    const user = await open();
    await user.type(screen.getByRole('searchbox'), 'customer-1@');
    const row = () => screen.getAllByRole('row')[1];
    await user.click(within(row()).getByRole('button', { name: new RegExp(I.ad_lock[0]) }));
    await waitFor(() => expect(screen.getByTestId('us-locked')).toHaveTextContent('2'));
    expect(within(row()).getByText(I.ad_locked[0])).toBeInTheDocument();
    await user.click(within(row()).getByRole('button', { name: new RegExp(I.ad_unlock[0]) }));
    await waitFor(() => expect(screen.getByTestId('us-locked')).toHaveTextContent('1'));
    await user.click(within(row()).getByRole('button', { name: new RegExp(I.ad_delete[0]) }));
    await user.click(within(row()).getByRole('button', { name: I.ad_cancel[0] }));
    expect(screen.getByTestId('us-total')).toHaveTextContent('12');
    await user.click(within(row()).getByRole('button', { name: new RegExp(I.ad_delete[0]) }));
    await user.click(within(row()).getByRole('button', { name: I.ad_delete[0] }));
    await waitFor(() => expect(screen.getByTestId('us-total')).toHaveTextContent('11'));
    expect(localStorage.getItem('dubchef-users')).toBeNull();
  });
});
