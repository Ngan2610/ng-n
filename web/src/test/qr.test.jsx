import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils.jsx';
import { I } from '../shared/i18n.js';
import { sampleData, summarize, trackVisit } from '../api/analytics.js';
import { paymentPayload } from '../api/orders.js';
import { GUEST_PATH, guestUrl, isLocalAddress, qrStats, trackScan } from '../api/qr.js';
import { qrMatrix, qrPath, qrSvg } from '../utils/qr.js';

const ADMIN = { name: 'Admin', email: 'admin@dubchef.vn', role: 'admin', token: 'admin-token' };
const loginAsAdmin = () => localStorage.setItem('dubchef-session', JSON.stringify(ADMIN));
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(async (input, options = {}) => {
    const url = new URL(String(input), 'http://test');
    if (url.pathname === '/api/auth/me') return response({ user: options.headers?.Authorization === 'Bearer admin-token' ? ADMIN : { name: 'An', email: 'an@example.com', role: 'user' } });
    if (url.pathname === '/api/admin/qr') return response({ stats: summarize(sampleData(new Date()), new Date(), Number(url.searchParams.get('days')) || 7) });
    return response({}, 204);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('bộ tạo mã QR', () => {
  it('kích thước theo phiên bản: 21 ô cho nội dung ngắn, lớn dần khi nội dung dài', () => {
    expect(qrMatrix('A')).toHaveLength(21);
    expect(qrMatrix('https://example.com/#/guest')).toHaveLength(29);
    expect(qrMatrix('x'.repeat(200)).length).toBeGreaterThan(qrMatrix('x'.repeat(20)).length);
  });

  it('có đủ ba mắt định vị ở ba góc và ô đen cố định', () => {
    const m = qrMatrix('Dubchef');
    const n = m.length;
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      expect(m[y][x]).toBe(true); // góc ngoài của mắt định vị
      expect(m[y + 3][x + 3]).toBe(true); // tâm
      expect(m[y + 1][x + 1]).toBe(false); // vòng trắng bên trong
    }
    expect(m[n - 8][8]).toBe(true); // ô đen luôn có theo chuẩn
  });

  it('cùng nội dung cho cùng ma trận; khác nội dung cho ma trận khác', () => {
    expect(qrMatrix('abc')).toEqual(qrMatrix('abc'));
    expect(qrMatrix('abc')).not.toEqual(qrMatrix('abd'));
  });

  it('nhận tiếng Việt (UTF-8) và từ chối nội dung quá dài', () => {
    expect(() => qrMatrix('Thanh toán đơn hàng ✓')).not.toThrow();
    expect(() => qrMatrix('x'.repeat(214))).toThrow('qr_too_long');
    expect(() => qrMatrix('x'.repeat(213))).not.toThrow();
  });

  it('xuất SVG hợp lệ có viền trắng', () => {
    const m = qrMatrix('A');
    const { d, size } = qrPath(m, 4);
    expect(size).toBe(m.length + 8);
    expect(d.startsWith('M')).toBe(true);
    const svg = qrSvg('A');
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 29 29"/);
    expect(svg).toContain('<path d="M');
  });
});

describe('địa chỉ trong mã QR của khách', () => {
  it('gắn #/guest vào địa chỉ trang, bỏ phần ? và # cũ', () => {
    expect(GUEST_PATH).toBe('/guest');
    expect(guestUrl('http://localhost:5173/#/demo', 'https://dubchef.vn/')).toBe('https://dubchef.vn/#/guest');
    expect(guestUrl('https://dubchef.vn/app/?x=1#/pricing', '')).toBe('https://dubchef.vn/app/#/guest');
  });
  it('nhận biết địa chỉ chỉ mở được trên máy cá nhân', () => {
    expect(isLocalAddress('http://localhost:5173/#/guest')).toBe(true);
    expect(isLocalAddress('http://127.0.0.1:5173/#/guest')).toBe(true);
    expect(isLocalAddress('file:///C:/web/index.html#/guest')).toBe(true);
    expect(isLocalAddress('https://dubchef.vn/#/guest')).toBe(false);
  });
});

describe('đếm lượt quét QR trong SQL Server', () => {
  it('ghi một lượt mỗi phiên và chỉ đánh dấu sau khi API nhận thành công', async () => {
    expect(await trackScan('vi')).toEqual({ success: true, alreadyScanned: false });
    expect(await trackScan('vi')).toEqual({ success: true, alreadyScanned: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/qr-scan'), expect.objectContaining({ method: 'POST', body: expect.stringContaining('"lang":"vi"') }));
    sessionStorage.clear();
    expect(await trackScan('en')).toEqual({ success: true, alreadyScanned: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('dubchef-qr-scans')).toBeNull();
  });

  it('hai lần khởi tạo đồng thời chỉ gửi một lượt quét', async () => {
    await Promise.all([trackScan('vi'), trackScan('vi')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('API thất bại không được báo lưu thành công hoặc chặn lần thử lại', async () => {
    fetchMock.mockImplementationOnce(async () => response({}, 503));
    await expect(trackScan('vi')).rejects.toThrow('Không thể lưu lượt quét');
    expect(sessionStorage.getItem('dubchef-qr-seen')).toBeNull();
    expect(await trackScan('vi')).toEqual({ success: true, alreadyScanned: false });
  });

  it('đọc thống kê bằng token và không dùng dữ liệu mẫu lưu ở trình duyệt', async () => {
    const result = await qrStats.load(ADMIN, 30);
    expect(result.stats.series).toHaveLength(30);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/admin/qr?days=30'), expect.objectContaining({ headers: { Authorization: 'Bearer admin-token' } }));
    qrStats.seed();
    qrStats.reset();
    expect(localStorage.getItem('dubchef-qr-scans')).toBeNull();
  });

  it('lượt xem cũng gửi về API và không tự tạo thống kê local', async () => {
    expect(await trackVisit('/pricing', 'vi')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/track'), expect.objectContaining({ method: 'POST' }));
    expect(localStorage.getItem('dubchef-visits')).toBeNull();
    fetchMock.mockClear();
    await trackVisit('/admin', 'vi');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('trang /guest', () => {
  it('khách không đăng nhập vẫn vào được và lượt quét gửi về API', async () => {
    renderApp('/guest');
    expect(await screen.findByRole('heading', { name: I.gu_title[0] })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: I.gu_go[0] })).toHaveAttribute('href', '/demo');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/qr-scan'), expect.objectContaining({ method: 'POST' })));
  });

  it('trang chủ có mã QR dẫn tới trang khách', () => {
    renderApp('/');
    expect(screen.getByTestId('home-qr').getAttribute('data-value')).toMatch(/#\/guest$/);
  });
});

describe('trang /admin/qr', () => {
  it('tài khoản thường không vào được', async () => {
    localStorage.setItem('dubchef-session', JSON.stringify({ name: 'An', email: 'an@example.com', token: 'user-token' }));
    renderApp('/admin/qr');
    expect(await screen.findByRole('alert')).toHaveTextContent(I.ad_denied[0]);
  });

  it('admin thấy mã QR và thống kê từ API, đổi khoảng thời gian', async () => {
    const user = userEvent.setup();
    loginAsAdmin();
    renderApp('/admin/qr');
    await screen.findByTestId('aq-total');
    expect(screen.getByTestId('aq-qrcode').getAttribute('data-value')).toBe(screen.getByTestId('aq-url').textContent);
    expect(screen.getByRole('link', { name: I.ad_nav_qr[0] })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: I.ad_seed[0] })).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: I.ad_r30[0] }));
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(31));
  });
});

describe('nội dung QR của đơn hàng', () => {
  it('gồm mã đơn, số tiền, loại tiền và nội dung chuyển khoản', () => {
    expect(paymentPayload({ id: 7, amountMinor: 90000, currency: 'VND' })).toBe('DUBCHEF-PAY|order=7|amount=90000|cur=VND|memo=DUBCHEF7');
    expect(paymentPayload({ id: 8, amountMinor: 350, currency: 'USD' })).toContain('amount=3.5|cur=USD');
  });
});
