// Băm mật khẩu và token đăng nhập, chỉ dùng node:crypto (không thêm thư viện).
import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16);
  return salt.toString('hex') + ':' + scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 200) return false;
  // Compatibility with the supplied SQL Server fn_BamMatKhau. New writes always use scrypt.
  const legacy = /^sha256\$([a-f0-9]{32})\$([a-f0-9]{64})$/i.exec(String(stored || ''));
  if (legacy) {
    const want = Buffer.from(legacy[2], 'hex');
    const got = createHash('sha256').update(Buffer.from(legacy[1], 'hex')).update(Buffer.from(password, 'utf16le')).digest();
    return timingSafeEqual(want, got);
  }

  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  if (!/^[a-f0-9]{32}$/.test(saltHex || '') || !/^[a-f0-9]{128}$/.test(hashHex || '') || typeof password !== 'string' || password.length > 200) return false;
  const want = Buffer.from(hashHex, 'hex');
  const got = scryptSync(password, Buffer.from(saltHex, 'hex'), want.length);
  return want.length === got.length && timingSafeEqual(want, got);
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (body, secret) => createHmac('sha256', secret).update(body).digest('base64url');

/** Token ký HMAC: `payload.chữ_ký`. Hết hạn sau `days` ngày. */
export function makeToken(user, secret, now = Date.now(), days = 7) {
  const body = b64(JSON.stringify({ email: user.email, role: user.role, id: user.id, exp: now + days * 86400000 }));
  return body + '.' + sign(body, secret);
}

/** Trả { email, role } nếu token đúng và còn hạn, ngược lại null. */
export function readToken(token, secret, now = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || parts[0].length > 2048) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body, secret));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return Number.isFinite(p.exp) && p.exp > now && typeof p.email === 'string' && p.email.length <= 254 && ['user', 'admin'].includes(p.role) ? { email: p.email, role: p.role, ...(Number.isSafeInteger(p.id) && p.id > 0 ? { id: p.id } : {}) } : null;
  } catch (e) {
    return null;
  }
}
