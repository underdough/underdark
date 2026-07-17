import { json } from '../_helpers.js';

export async function onRequestPost() {
  return json({ message: 'Sesión cerrada' }, 200, {
    'Set-Cookie': 'underdark_token=; Path=/; Max-Age=0'
  });
}
