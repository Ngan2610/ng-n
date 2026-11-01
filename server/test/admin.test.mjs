import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, makeToken, readToken } from '../src/auth.js';
import { buildStats, dayKey } from '../src/stats.js';

test('mật khẩu băm xong kiểm tra lại đúng, sai thì từ chối', () => {
  const h = hashPassword('matkhau123');
  assert.ok(!h.includes('matkhau123'));
  assert.ok(verifyPassword('matkhau123', h));
  assert.ok(!verifyPassword('sai', h));
  assert.ok(!verifyPassword('x', ''));
});

test('token đúng, hết hạn, bị sửa', () => {
  const t = makeToken({ email: 'a@b.co', role: 'admin' }, 's', 1000);
  assert.deepEqual(readToken(t, 's', 2000), { email: 'a@b.co', role: 'admin' });
  assert.equal(readToken(t, 's', 1000 + 8 * 86400000), null);
  assert.equal(readToken(t, 'khac', 2000), null);
  assert.equal(readToken(t.replace(/^./, 'X'), 's', 2000), null);
  assert.equal(readToken('', 's'), null);
});

test('buildStats: ngày thiếu tính 0, hôm nay / hôm qua / đỉnh', () => {
  const now = Date.UTC(2026, 9, 22, 5, 0); // 12:00 giờ VN
  const k = (i) => dayKey(now - i * 86400000, 7);
  assert.equal(k(0), '2026-10-22');
  const st = buildStats({
    days: [{ date: k(0), visitors: 5, views: 9 }, { date: k(1), visitors: 2, views: 3 }, { date: k(3), visitors: 8, views: 8 }],
    period: { visitors: 11, views: 20 }, prev: { visitors: 0, views: 0 }, totals: { visitors: 40, views: 99 }, activeNow: 2,
  }, now, 7);
  assert.equal(st.series.length, 7);
  assert.deepEqual(st.today, { visitors: 5, views: 9 });
  assert.deepEqual(st.yesterday, { visitors: 2, views: 3 });
  assert.equal(st.series[6].date, '2026-10-22');
  assert.deepEqual(st.peak, { date: k(3), visitors: 8 });
  assert.equal(st.activeNow, 2);
});
