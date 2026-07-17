const ALGO = 'HMAC-SHA-256';

function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64url(sig);
}

async function hmacVerify(secret, data, sigB64) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sigBuf = base64urlDecode(sigB64);
  return crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(data));
}

export async function generateToken(secret, expiryMs = 86400000) {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + expiryMs,
    seed: crypto.randomUUID()
  };
  const payloadStr = JSON.stringify(payload);
  const sig = await hmacSign(secret, payloadStr);
  return btoa(JSON.stringify({ ...payload, sig }));
}

export async function verifyToken(secret, token) {
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) return false;
    const { sig, ...payload } = decoded;
    return await hmacVerify(secret, JSON.stringify(payload), sig);
  } catch {
    return false;
  }
}

export function getTokenFromRequest(request) {
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)underdark_token=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);

  const url = new URL(request.url);
  const q = url.searchParams.get('token');
  if (q) return q;

  return null;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}
