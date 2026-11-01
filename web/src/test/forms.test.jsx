import { afterEach, beforeEach, describe, expect, it, vi }  from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils.jsx';
import { api } from '../api/client.js';
import { installMockBackend } from './mockBackend.js';
import { I } from '../shared/i18n.js';

const viText = (key) => I[key][0]; // bản tiếng Việt (ngôn ngữ mặc định)
let backend;
beforeEach(() => { backend = installMockBackend(); });
afterEach(() => vi.unstubAllGlobals());

describe('Đăng ký', () => {
  it('báo lỗi từng ô khi để trống', async () => {
    const user = userEvent.setup();
    renderApp('/register');
    await user.click(screen.getByRole('button', { name: viText('rg_btn') }));

    for (const key of ['e_name', 'e_email', 'e_pass', 'e_pass2', 'e_agree']) {
      expect(await screen.findByText(viText(key))).toBeInTheDocument();
    }
  });

  it('báo lỗi khi mật khẩu nhập lại không khớp', async () => {
    const user = userEvent.setup();
    renderApp('/register');
    await user.type(screen.getByLabelText(viText('f_pass')), 'matkhau123');
    await user.type(screen.getByLabelText(viText('f_pass2')), 'khacnhau999');
    await user.click(screen.getByRole('button', { name: viText('rg_btn') }));
    expect(await screen.findByText(viText('e_pass2'))).toBeInTheDocument();
  });

  it('đăng ký thành công thì về trang chủ, hiện tên và lưu phiên', async () => {
    const user = userEvent.setup();
    renderApp('/register');
    await user.type(screen.getByLabelText(viText('f_name')), 'An');
    await user.type(screen.getByLabelText(viText('f_email')), 'an@example.com');
    await user.type(screen.getByLabelText(viText('f_pass')), 'matkhau123');
    await user.type(screen.getByLabelText(viText('f_pass2')), 'matkhau123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: viText('rg_btn') }));

    expect(await screen.findByText(/Xin chào, An/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: viText('logout') })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('dubchef-session')).email).toBe('an@example.com');
  });

  it('email đã đăng ký thì báo lỗi', async () => {
    await api.register({ name: 'An', email: 'an@example.com', password: 'matkhau123' });
    const user = userEvent.setup();
    renderApp('/register');
    await user.type(screen.getByLabelText(viText('f_name')), 'An');
    await user.type(screen.getByLabelText(viText('f_email')), 'an@example.com');
    await user.type(screen.getByLabelText(viText('f_pass')), 'matkhau123');
    await user.type(screen.getByLabelText(viText('f_pass2')), 'matkhau123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: viText('rg_btn') }));
    expect(await screen.findByText(viText('e_exists'))).toBeInTheDocument();
  });
});

describe('Đăng nhập', () => {
  it('sai tài khoản thì báo lỗi', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(screen.getByLabelText(viText('f_email')), 'nobody@example.com');
    await user.type(screen.getByLabelText(viText('f_pass')), 'matkhau123');
    await user.click(screen.getByRole('button', { name: viText('nav_login') }));
    expect(await screen.findByText(viText('e_login'))).toBeInTheDocument();
  });

  it('tài khoản đã đăng ký đăng nhập được, rồi đăng xuất được', async () => {
    await api.register({ name: 'Bình', email: 'binh@example.com', password: 'matkhau123' });
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(screen.getByLabelText(viText('f_email')), 'binh@example.com');
    await user.type(screen.getByLabelText(viText('f_pass')), 'matkhau123');
    await user.click(screen.getByRole('button', { name: viText('nav_login') }));

    expect(await screen.findByText(/Xin chào, Bình/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: viText('logout') }));
    expect(screen.queryByText(/Xin chào, Bình/)).toBeNull();
    expect(localStorage.getItem('dubchef-session')).toBeNull();
  });
});

describe('Liên hệ', () => {
  it('báo lỗi khi để trống', async () => {
    const user = userEvent.setup();
    renderApp('/contact');
    await user.click(screen.getByRole('button', { name: viText('c_send') }));
    for (const key of ['e_name', 'e_email', 'e_msg']) {
      expect(await screen.findByText(viText(key))).toBeInTheDocument();
    }
  });

  it('gửi thành công thì hiện thông báo và lưu tin nhắn', async () => {
    const user = userEvent.setup();
    renderApp('/contact');
    await user.type(screen.getByLabelText(viText('f_name')), 'An');
    await user.type(screen.getByLabelText(viText('f_email')), 'an@example.com');
    await user.type(screen.getByLabelText(viText('f_msg')), 'Xin chào Dubchef');
    await user.click(screen.getByRole('button', { name: viText('c_send') }));

    expect(await screen.findByText(viText('c_ok'))).toBeInTheDocument();
    expect(backend.messages).toEqual([{ name: 'An', email: 'an@example.com', message: 'Xin chào Dubchef' }]);
    expect(localStorage.getItem('dubchef-messages')).toBeNull();
  });
});
