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

  const data = await env.POSTS.get('posts', { type: 'json' }) || [];
  const url = new URL(request.url);
  const tag = url.searchParams.get('tag');
  const search = url.searchParams.get('search');

  let filtered = data;
  if (tag) filtered = filtered.filter(p => p.tags && p.tags.includes(tag));
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    );
  }
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json(filtered);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'No autorizado' }, 401);
  }

  const body = await request.json();
  const posts = await env.POSTS.get('posts', { type: 'json' }) || [];
  const newPost = {
    id: crypto.randomUUID(),
    title: body.title || 'Sin título',
    content: body.content || '',
    tags: body.tags || [],
    coverImage: body.coverImage || null,
    music: body.music || null,
    mood: body.mood || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  posts.push(newPost);
  await env.POSTS.put('posts', JSON.stringify(posts));
  return json(newPost, 201);
}
