import test from 'node:test';
import assert from 'node:assert/strict';
import { TranslateError, translateLines, translateText, translateToAll } from './translate.js';

// fetch giả lập, không gọi mạng thật khi chạy test
function fakeFetch(map) {
  return async (url) => ({
    ok: true,
    json: async () => {
      const hit = Object.entries(map).find(([k]) => url.includes(k));
      return { responseStatus: 200, responseData: { translatedText: hit ? hit[1] : 'bản dịch' } };
    },
  });
}

test('dịch một câu sang một ngôn ngữ', async () => {
  const fx = fakeFetch({ 'vi|en': 'Hello' });
  const out = await translateText('Xin chào', 'vi', 'en', fx);
  assert.equal(out, 'Hello');
});

test('cùng ngôn ngữ nguồn và đích thì trả nguyên văn, không gọi mạng', async () => {
  const out = await translateText('Xin chào', 'vi', 'vi', async () => { throw new Error('không được gọi'); });
  assert.equal(out, 'Xin chào');
});

test('dịch sang cả 3 ngôn ngữ, giữ nguyên bản gốc', async () => {
  const fx = fakeFetch({ 'vi|en': 'Hello', 'vi|zh-CN': '你好' });
  const out = await translateToAll('Xin chào', 'vi', fx);
  assert.deepEqual(out, { vi: 'Xin chào', en: 'Hello', zh: '你好' });
});

test('dịch nhiều dòng, bỏ dòng trống', async () => {
  const fx = fakeFetch({ 'vi|en': 'Hi', 'vi|zh-CN': '嗨' });
  const out = await translateLines(['Chào', '', '  ', 'Tạm biệt'], 'vi', fx);
  assert.equal(out.length, 2);
  assert.equal(out[0].vi, 'Chào');
  assert.equal(out[1].vi, 'Tạm biệt');
});

test('mất mạng thì báo lỗi net', async () => {
  await assert.rejects(
    translateText('Xin chào', 'vi', 'en', async () => { throw new Error('offline'); }),
    (e) => e instanceof TranslateError && e.code === 'net'
  );
});

test('máy chủ báo lỗi (không phải 200) thì ném lỗi server', async () => {
  const fx = async () => ({ ok: false, json: async () => ({}) });
  await assert.rejects(translateText('a', 'vi', 'en', fx), (e) => e instanceof TranslateError && e.code === 'server');
});

test('hết hạn mức miễn phí (responseStatus khác 200) thì báo lỗi limit', async () => {
  const fx = async () => ({ ok: true, json: async () => ({ responseStatus: 403, responseData: { translatedText: 'MYMEMORY WARNING' } }) });
  await assert.rejects(translateText('a', 'vi', 'en', fx), (e) => e instanceof TranslateError && e.code === 'limit');
});
