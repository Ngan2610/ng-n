import test from 'node:test';
import assert from 'node:assert/strict';
import { I, CUES, LANGS, PRICES } from './i18n.js';
import { formatMoney, planPrice } from './format.js';

test('mọi khóa đều có đủ 3 bản dịch không rỗng', () => {
  for (const [key, val] of Object.entries(I)) {
    assert.equal(val.length, 3, `khóa "${key}" phải có 3 ngôn ngữ`);
    val.forEach((s, n) => assert.ok(typeof s === 'string' && s.trim().length > 0, `khóa "${key}" thiếu bản dịch ${LANGS[n]}`));
  }
});

test('các bước video mẫu có đủ vi/en/zh', () => {
  assert.equal(CUES.length, 4);
  CUES.forEach((c) => LANGS.forEach((l) => assert.ok(c[l] && c[l].length > 0)));
});

test('giá theo năm giảm 20%', () => {
  assert.equal(planPrice(1, 1, false), PRICES[1][1]);
  assert.equal(planPrice(1, 1, true), PRICES[1][1] * 0.8);
});

test('formatMoney trả về chuỗi có chữ số', () => {
  for (let L = 0; L < 3; L++) assert.match(formatMoney(L, 250000), /\d/);
});
