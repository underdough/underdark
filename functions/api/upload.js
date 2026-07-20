import { verifyToken, getTokenFromRequest, json } from '../_helpers.js';

async function requireAuth(request, env) {
  const token = getTokenFromRequest(request);
  if (!token || !(await verifyToken(env.UNDERDARK_SECRET, token))) return null;
  return token;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'No autorizado' }, 401);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Se requiere multipart/form-data' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) {
    return json({ error: 'No se proporcionó archivo' }, 400);
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return json({ error: 'Tipo de archivo no permitido. Usa JPEG, PNG, GIF, WebP o SVG.' }, 400);
  }

  const MAX_SIZE = 500 * 1024;
  if (file.size > MAX_SIZE) {
    return json({ error: 'Imagen muy grande. Máximo 500KB. Comprimí la imagen e intentá de nuevo.' }, 400);
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const dataUrl = `data:${file.type};base64,${base64}`;

  return json({ url: dataUrl, filename: file.name, mimetype: file.type, size: file.size });
}
