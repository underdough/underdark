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

  // Cloudflare Pages doesn't have filesystem access.
  // For file uploads, you need Cloudflare R2 storage.
  // Set up R2 bucket and add binding in wrangler.toml:
  //
  // [[r2_buckets]]
  // binding = "MEDIA"
  // bucket_name = "underdark-media"
  //
  // Then uncomment the R2 code below:

  // const ext = file.name.split('.').pop();
  // const key = `${crypto.randomUUID()}.${ext}`;
  // await env.MEDIA.put(key, file, { httpMetadata: { contentType: file.type } });
  // const url = `https://your-r2-domain/${key}`;
  // return json({ url, filename: key, mimetype: file.type });

  return json({ error: 'Uploads requieren Cloudflare R2. Configura un bucket R2 y descomenta el código en functions/api/upload.js' }, 501);
}
