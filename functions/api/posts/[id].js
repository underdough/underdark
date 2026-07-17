import { verifyToken, getTokenFromRequest, json } from '../../_helpers.js';

async function requireAuth(request, env) {
  const token = getTokenFromRequest(request);
  if (!token || !(await verifyToken(env.UNDERDARK_SECRET, token))) return null;
  return token;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'No autorizado' }, 401);
  }

  const posts = await env.POSTS.get('posts', { type: 'json' }) || [];
  const post = posts.find(p => p.id === params.id);
  if (!post) return json({ error: 'Post no encontrado' }, 404);
  return json(post);
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'No autorizado' }, 401);
  }

  const posts = await env.POSTS.get('posts', { type: 'json' }) || [];
  const index = posts.findIndex(p => p.id === params.id);
  if (index === -1) return json({ error: 'Post no encontrado' }, 404);

  const body = await request.json();
  posts[index] = {
    ...posts[index],
    ...body,
    id: posts[index].id,
    createdAt: posts[index].createdAt,
    updatedAt: new Date().toISOString()
  };
  await env.POSTS.put('posts', JSON.stringify(posts));
  return json(posts[index]);
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'No autorizado' }, 401);
  }

  const posts = await env.POSTS.get('posts', { type: 'json' }) || [];
  const index = posts.findIndex(p => p.id === params.id);
  if (index === -1) return json({ error: 'Post no encontrado' }, 404);

  posts.splice(index, 1);
  await env.POSTS.put('posts', JSON.stringify(posts));
  return json({ message: 'Post eliminado' });
}
