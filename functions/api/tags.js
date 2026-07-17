import { verifyToken, getTokenFromRequest, json } from '../_helpers.js';

async function requireAuth(request, env) {
  const token = getTokenFromRequest(request);
  if (!token || !(await verifyToken(env.UNDERDARK_SECRET, token))) return null;
  return token;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'No autorizado' }, 401);
  }

  const posts = await env.POSTS.get('posts', { type: 'json' }) || [];
  const tagCount = {};
  posts.forEach(p => {
    if (p.tags) {
      p.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    }
  });
  return json(Object.entries(tagCount).map(([name, count]) => ({ name, count })));
}
