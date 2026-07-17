import { generateToken, json } from '../_helpers.js';

export async function onRequestPost(context) {
  const { env } = context;
  const secret = env.UNDERDARK_SECRET;
  const passphrase = env.UNDERDARK_PASSPHRASE;

  if (!secret || !passphrase) {
    return json({ error: 'Server not configured' }, 500);
  }

  const body = await context.request.json();
  if (body.passphrase !== passphrase) {
    return json({ error: 'Contraseña incorrecta' }, 401);
  }

  const token = await generateToken(secret);
  return json({ token }, 200, {
    'Set-Cookie': `underdark_token=${token}; Path=/; Max-Age=86400; SameSite=Lax`
  });
}

export async function onRequest() {
  return json({ error: 'Usa POST' }, 405);
}
