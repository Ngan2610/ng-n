import test from 'node:test';
import assert from 'node:assert/strict';
import { I } from './i18n.js';
import { formatMoney } from './format.js';
import { calcPrice, checkCounts, MAX_VIDEOS, OUT_PER_VIDEO, parseCount, SAMPLE_PACKS, unitPrice } from './pricing.js';

test('giá = số video đăng lên × phí đăng + số video dịch ra × phí dịch', () => {
  // Việt: 20.000 ₫ mỗi video đăng, 10.000 ₫ mỗi video dịch ra
  assert.deepEqual(calcPrice(0, 3, 3), { up: 60000, out: 30000, total: 90000 });
  assert.equal(calcPrice(0, 10, 20).total, 400000);
  assert.equal(calcPrice(0, 0, 0).total, 0);
});

test('giá bằng USD và CNY không bị sai số số thực', () => {
  assert.equal(calcPrice(1, 3, 3).total, 3.6); // 3 × 0,8 + 3 × 0,4
  assert.equal(calcPrice(1, 7, 9).total, 9.2); // 7 × 0,8 + 9 × 0,4
  assert.equal(calcPrice(2, 3, 3).total, 27); // 3 × 6 + 3 × 3
  assert.equal(unitPrice(1, 0), 0.8);
  assert.equal(unitPrice(1, 1), 0.4);
});

test('tăng số video thì giá không bao giờ giảm', () => {
  for (let L = 0; L < 3; L++) {
    let last = -1;
    for (let n = 0; n <= 20; n++) {
      const p = calcPrice(L, n, n).total;
      assert.ok(p >= last);
      last = p;
    }
  }
});

test('parseCount chỉ nhận số nguyên từ 0 đến mức tối đa', () => {
  assert.equal(parseCount('0'), 0);
  assert.equal(parseCount(' 12 '), 12);
  assert.equal(parseCount(String(MAX_VIDEOS)), MAX_VIDEOS);
  for (const bad of ['', 'abc', '-1', '1.5', '1e2', String(MAX_VIDEOS + 1), '12345']) {
    assert.equal(parseCount(bad), null, `"${bad}" phải bị từ chối`);
  }
});

test('checkCounts: số video dịch ra tối đa gấp 3 lần số video đăng lên', () => {
  assert.equal(checkCounts(2, 6), null);
  assert.equal(checkCounts(2, 7), 'pc_over');
  assert.equal(checkCounts(0, 1), 'pc_over');
  assert.equal(checkCounts(null, 1), 'pc_bad');
  assert.equal(checkCounts(1, null), 'pc_bad');
  assert.equal(OUT_PER_VIDEO, 3);
});

test('các gói mẫu hợp lệ, có tên và mô tả đủ 3 ngôn ngữ, giá hiển thị được', () => {
  assert.ok(SAMPLE_PACKS.length >= 3);
  for (const p of SAMPLE_PACKS) {
    assert.equal(checkCounts(p.uploads, p.outs), null, `gói ${p.id} vượt giới hạn`);
    for (const key of [`pk${p.id}_n`, `pk${p.id}_d`]) {
      assert.ok(I[key] && I[key].length === 3, `thiếu khóa ${key}`);
    }
    for (let L = 0; L < 3; L++) assert.match(formatMoney(L, calcPrice(L, p.uploads, p.outs).total), /\d/);
  }
});

test('formatMoney hiện 2 chữ số thập phân khi số lẻ', () => {
  assert.match(formatMoney(1, 3.6), /3\.60/);
  assert.match(formatMoney(0, 90000), /90\.000/);
});
