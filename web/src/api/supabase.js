/** Kết nối Supabase (miễn phí, không cần Backend riêng). Có đủ 2 biến VITE_SUPABASE_* thì SUPA = true. */
const URL_ = ((import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '').replace(/\/+$/, '');
const KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
export const SUPA = Boolean(URL_ && KEY);

/** Gọi một hàm SQL (RPC) ở Supabase; trả về JSON (hoặc null nếu không có nội dung). */
export async function rpc(name, body) {
  const res = await fetch(URL_ + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('supabase');
  return res.status === 204 ? null : res.json();
}
