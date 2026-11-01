import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils.jsx';
import { I } from '../shared/i18n.js';
import { orderAmount, orders, paymentPayload } from '../api/orders.js';
import { api } from '../api/client.js';
import { CUSTOMER, installMockBackend, saveSession } from './mockBackend.js';

let backend;
beforeEach(() => { backend = installMockBackend({ users: [{ ...CUSTOMER, password: 'matkhau123' }] }); });
afterEach(() => vi.unstubAllGlobals());

describe('API đơn hàng qua backend', () => {
  it('gửi bearer token, nhận giá từ backend và không lưu đơn vào localStorage', async () => {
    saveSession();
    const o = await orders.create({ name: 'Tên nhập', email: 'khac@example.com', uploads: 3, outs: 3, L: 0 });
    expect(o).toMatchObject({ id: 1, status: 'pending', currency: 'VND', amountMinor: 90000, email: 'an@example.com' });
    expect(backend.calls[0].headers.get('Authorization')).toBe('Bearer customer-token');
    const res = await orders.pay(o.id, 'momo');
    expect(res.order.status).toBe('paid');
    expect(res.payment.ref).toMatch(/^MOMO-/);
    await expect(orders.pay(o.id, 'card')).rejects.toMatchObject({ code: 'not_payable', status: 409 });
    expect(await orders.list()).toHaveLength(1);
    expect(backend.calls.at(-1).url.search).toBe('');
    expect(localStorage.getItem('dubchef-orders')).toBeNull();
  });

  it('không tạo đơn khi chưa có phiên đăng nhập', async () => {
    await expect(orders.create({ name: 'An', email: 'an@example.com', uploads: 3, outs: 3, L: 0 })).rejects.toMatchObject({ code: 'auth' });
    expect(backend.fetch).not.toHaveBeenCalled();
    expect(backend.orders).toHaveLength(0);
  });

  it('đổi số tiền sang đơn vị chính và giữ định dạng mã tham chiếu QR', () => {
    expect(orderAmount({ currency: 'USD', amountMinor: 350 })).toBe(3.5);
    expect(orderAmount({ currency: 'VND', amountMinor: 90000 })).toBe(90000);
    expect(paymentPayload({ id: 7, amountMinor: 90000, currency: 'VND' })).toBe('DUBCHEF-PAY|order=7|amount=90000|cur=VND|memo=DUBCHEF7');
  });
});

describe('Thanh toán ở trang Bảng giá', () => {
  it('chưa đăng nhập thì yêu cầu đăng nhập, không tạo đơn', async () => {
    const user = userEvent.setup();
    renderApp('/pricing');
    await user.click(screen.getByRole('button', { name: I.co_btn[0] }));
    expect(screen.getByRole('alert')).toHaveTextContent(I.co_need_login[0]);
    expect(backend.orders).toHaveLength(0);
  });

  it('đăng nhập xong quay lại Bảng giá và giữ số video', async () => {
    await api.register({ name: 'Bình', email: 'binh@example.com', password: 'matkhau123' });
    const user = userEvent.setup();
    renderApp('/pricing');
    await user.clear(screen.getByLabelText(I.pc_up[0]));
    await user.type(screen.getByLabelText(I.pc_up[0]), '5');
    await user.clear(screen.getByLabelText(I.pc_out[0]));
    await user.type(screen.getByLabelText(I.pc_out[0]), '4');
    await user.click(screen.getByRole('button', { name: I.co_btn[0] }));
    const links = screen.getAllByRole('link', { name: I.nav_login[0] });
    await user.click(links.at(-1));
    expect(await screen.findByText(I.co_resume[0])).toBeInTheDocument();
    await user.type(screen.getByLabelText(I.f_email[0]), 'binh@example.com');
    await user.type(screen.getByLabelText(I.f_pass[0]), 'matkhau123');
    await user.click(screen.getByRole('button', { name: I.nav_login[0] }));
    expect(await screen.findByTestId('co-total')).toBeInTheDocument();
    expect(screen.getByLabelText(I.pc_up[0])).toHaveValue('5');
    expect(screen.getByLabelText(I.pc_out[0])).toHaveValue('4');
  });

  it('hiện kết quả backend trả về khi bật thanh toán thử nghiệm', async () => {
    const user = userEvent.setup();
    saveSession();
    renderApp('/pricing');
    await screen.findByText(/Xin chào, An/);
    await user.click(screen.getByRole('button', { name: I.co_btn[0] }));
    expect(await screen.findByTestId('co-total')).toHaveTextContent('90.000');
    await user.click(screen.getByRole('radio', { name: I.co_bank[0] }));
    await user.click(screen.getByRole('button', { name: I.co_pay[0] }));
    expect(await screen.findByTestId('co-order')).toHaveTextContent('#1');
    expect(screen.getByTestId('co-ref').textContent).toMatch(/^BANK-/);
    expect(backend.orders[0]).toMatchObject({ status: 'paid', amountMinor: 90000, email: 'an@example.com' });
    expect(localStorage.getItem('dubchef-orders')).toBeNull();
  });

  it('không hiện thành công khi cổng thanh toán chưa cấu hình', async () => {
    backend = installMockBackend({ users: [{ ...CUSTOMER, password: 'matkhau123' }], paymentDemo: false });
    const user = userEvent.setup();
    saveSession();
    renderApp('/pricing');
    await screen.findByText(/Xin chào, An/);
    await user.click(screen.getByRole('button', { name: I.co_btn[0] }));
    await user.click(screen.getByRole('button', { name: I.co_pay[0] }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cổng thanh toán chưa được cấu hình');
    expect(screen.queryByTestId('co-ref')).toBeNull();
    expect(backend.orders[0].status).toBe('pending');
  });

  it('mã QR dùng lại đơn chờ khi quay lại biểu mẫu, không tạo đơn trùng', async () => {
    const user = userEvent.setup();
    saveSession();
    renderApp('/pricing');
    await screen.findByText(/Xin chào, An/);
    await user.click(screen.getByRole('button', { name: I.co_btn[0] }));
    await user.click(screen.getByRole('radio', { name: I.co_qr[0] }));
    await user.click(screen.getByRole('button', { name: I.co_qr_make[0] }));
    expect((await screen.findByTestId('co-qrcode')).getAttribute('data-value')).toBe('DUBCHEF-PAY|order=1|amount=90000|cur=VND|memo=DUBCHEF1');
    expect(backend.orders[0].status).toBe('pending');
    await user.click(screen.getByRole('button', { name: I.co_qr_back[0] }));
    await user.click(screen.getByRole('button', { name: I.co_qr_make[0] }));
    await screen.findByTestId('co-qrcode');
    expect(backend.orders).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: I.co_qr_done[0] }));
    expect(await screen.findByTestId('co-ref')).toHaveTextContent(/^QR-/);
    await waitFor(() => expect(backend.orders[0].status).toBe('paid'));
  });

  it('không có nút thanh toán khi số video nhập sai', async () => {
    const user = userEvent.setup();
    renderApp('/pricing');
    await user.clear(screen.getByLabelText(I.pc_out[0]));
    await user.type(screen.getByLabelText(I.pc_out[0]), 'abc');
    expect(screen.queryByRole('button', { name: I.co_btn[0] })).toBeNull();
  });
});
