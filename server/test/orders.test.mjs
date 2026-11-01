import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder, priceOrder, newTransactionRef, CURRENCIES, METHODS } from '../src/orders.js';

const base = { name: ' An ', email: 'AN@Example.com', uploads: 3, outs: 3, L: 0 };

test('đơn hợp lệ được chuẩn hóa tên và email', () => {
  assert.deepEqual(validateOrder(base), { value: { name: 'An', email: 'an@example.com', uploads: 3, outs: 3, L: 0 } });
});

test('nhận số video dạng chuỗi (từ form)', () => {
  assert.equal(validateOrder({ ...base, uploads: '10', outs: '20' }).value.outs, 20);
});

test('từ chối dữ liệu sai', () => {
  assert.equal(validateOrder(null).error, 'invalid');
  assert.equal(validateOrder({ ...base, name: ' ' }).error, 'name');
  assert.equal(validateOrder({ ...base, email: 'khong-phai-email' }).error, 'email');
  assert.equal(validateOrder({ ...base, uploads: 'abc' }).error, 'count');
  assert.equal(validateOrder({ ...base, uploads: 501 }).error, 'count');
  assert.equal(validateOrder({ ...base, outs: 10 }).error, 'over'); // dịch ra tối đa gấp 3 lần số video đăng
  assert.equal(validateOrder({ ...base, uploads: 0, outs: 0 }).error, 'empty');
  assert.equal(validateOrder({ ...base, L: 5 }).error, 'currency');
});

test('giá tính ở máy chủ, theo đơn vị nhỏ nhất của từng loại tiền', () => {
  assert.deepEqual(priceOrder({ L: 0, uploads: 3, outs: 3 }), { currency: 'VND', amountMinor: 90000 });
  const usd = priceOrder({ L: 1, uploads: 3, outs: 3 });
  assert.equal(usd.currency, 'USD');
  assert.ok(Number.isInteger(usd.amountMinor) && usd.amountMinor > 0);
  assert.equal(priceOrder({ L: 2, uploads: 10, outs: 20 }).currency, CURRENCIES[2]);
});

test('mã giao dịch có tiền tố theo phương thức và không trùng', () => {
  assert.match(newTransactionRef('momo'), /^MOMO-[0-9A-Z]+-[0-9A-F]{8}$/);
  assert.notEqual(newTransactionRef('card'), newTransactionRef('card'));
  assert.ok(newTransactionRef('bank').length <= 40);
});

test('có phương thức thanh toán quét mã QR', () => {
  assert.ok(METHODS.includes('qr'));
  assert.match(newTransactionRef('qr'), /^QR-[0-9A-Z]+-[0-9A-F]{8}$/);
});
