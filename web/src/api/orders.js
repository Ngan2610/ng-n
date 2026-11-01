import { API_BASE, ApiError, session } from './client.js';

export const HAS_PAYMENT_API = true;
export const CURRENCIES = ['VND', 'USD', 'CNY'];
export const METHODS = ['card', 'momo', 'bank', 'qr'];
const MINOR_PER_UNIT = [1, 100, 100];
const BASE = (import.meta.env.VITE_PAYMENT_API_URL || API_BASE).replace(/\/+$/, '');
export const orderAmount = (order) => order.amountMinor / MINOR_PER_UNIT[CURRENCIES.indexOf(order.currency)];
/** Reference QR for the explicit payment simulator; it is not a bank payment QR. */
export function paymentPayload(order) {
  return ['DUBCHEF-PAY', 'order=' + order.id, 'amount=' + orderAmount(order), 'cur=' + order.currency, 'memo=DUBCHEF' + order.id].join('|');
}
async function remote(method, path, body) {
  const token = session.load()?.token;
  if (!token) throw new ApiError('auth', 401);
  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new ApiError('net'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.code || 'server', response.status);
  return data;
}
export const orders = {
  create: async (body) => (await remote('POST', '/api/orders', body)).order,
  pay: (id, method) => remote('POST', '/api/orders/' + id + '/pay', { method }),
  list: async () => (await remote('GET', '/api/orders')).orders,
};
