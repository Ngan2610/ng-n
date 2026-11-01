import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils.jsx';
import { I } from '../shared/i18n.js';
import { formatMoney } from '../shared/format.js';
import { calcPrice, SAMPLE_PACKS } from '../shared/pricing.js';

async function fill(user, label, value) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value !== '') await user.type(input, value);
}

describe('Trang Bảng giá: tính giá theo số video', () => {
  it('mở từ menu và có đúng một tiêu đề h1', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const nav = within(screen.getByRole('navigation', { name: I.navlabel[0] }));
    await user.click(nav.getByRole('link', { name: I.nav_pricing[0] }));
    expect(await screen.findByRole('heading', { level: 1, name: I.pr_title[0] })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: I.nav_pricing[0] })).toHaveAttribute('aria-current', 'page');
  });

  it('mặc định 3 video đăng lên và 3 video dịch ra: 3 × 20.000 + 3 × 10.000 = 90.000 ₫', () => {
    renderApp('/pricing');
    expect(screen.getByTestId('pc-total')).toHaveTextContent(/90\.000/);
  });

  it('đổi số video thì giá đổi theo: 10 đăng lên, 20 dịch ra = 400.000 ₫', async () => {
    const user = userEvent.setup();
    renderApp('/pricing');
    await fill(user, I.pc_up[0], '10');
    await fill(user, I.pc_out[0], '20');
    expect(screen.getByTestId('pc-total')).toHaveTextContent(/400\.000/);
  });

  it('báo lỗi khi số video dịch ra vượt 3 lần số video đăng lên và không hiện giá', async () => {
    const user = userEvent.setup();
    renderApp('/pricing');
    await fill(user, I.pc_up[0], '2');
    await fill(user, I.pc_out[0], '7');
    expect(screen.getByRole('alert')).toHaveTextContent(I.pc_over[0]);
    expect(screen.getByLabelText(I.pc_out[0])).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('pc-total')).toBeNull();
  });

  it('báo lỗi khi nhập chữ hoặc để trống', async () => {
    const user = userEvent.setup();
    renderApp('/pricing');
    await fill(user, I.pc_up[0], 'abc');
    expect(screen.getByRole('alert')).toHaveTextContent(I.pc_bad[0]);
    await fill(user, I.pc_up[0], '');
    expect(screen.getByRole('alert')).toHaveTextContent(I.pc_bad[0]);
    expect(screen.queryByTestId('pc-total')).toBeNull();
  });

  it('hiện đủ các gói mẫu và giá mỗi gói đúng theo công thức', () => {
    renderApp('/pricing');
    for (const pack of SAMPLE_PACKS) {
      expect(screen.getByRole('heading', { level: 3, name: I['pk' + pack.id + '_n'][0] })).toBeInTheDocument();
      expect(screen.getByTestId('pk-price-' + pack.id).textContent)
        .toBe(formatMoney(0, calcPrice(0, pack.uploads, pack.outs).total));
    }
  });

  it('bấm "Tính thử gói này" điền sẵn số video vào phần tính giá', async () => {
    const user = userEvent.setup();
    renderApp('/pricing');
    await user.click(screen.getByRole('button', { name: new RegExp(I.pk3_n[0]) }));
    expect(screen.getByLabelText(I.pc_up[0])).toHaveValue('30');
    expect(screen.getByLabelText(I.pc_out[0])).toHaveValue('90');
    expect(screen.getByTestId('pc-total')).toHaveTextContent(/1\.500\.000/);
  });

  it('đổi sang tiếng Anh thì giá tính bằng USD (3 × $0.80 + 3 × $0.40 = $3.60)', () => {
    localStorage.setItem('dubchef-lang', 'en');
    renderApp('/pricing');
    expect(screen.getByTestId('pc-total')).toHaveTextContent(/\$3\.60/);
  });

  it('các gói theo tháng vẫn giảm 20% khi chọn trả theo năm', async () => {
    const user = userEvent.setup();
    renderApp('/pricing');
    await user.click(screen.getByRole('button', { name: I.pr_yearly[0] }));
    expect(screen.getByText(/200\.000/)).toBeInTheDocument();
  });
});
