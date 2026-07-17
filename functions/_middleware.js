import { verifyToken, getTokenFromRequest } from './_helpers.js';

const PROTECTED_PAGES = ['/', '/index.html', '/post.html', '/editor.html', '/constellation.html'];

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Allow ritual.html and API routes through
  if (pathname === '/ritual.html' || pathname.startsWith('/api/')) {
    return context.next();
  }

  // Check if this is a protected page
  const isProtected = PROTECTED_PAGES.includes(pathname);
  if (!isProtected) {
    return context.next();
  }

  // Check auth
  const secret = context.env.UNDERDARK_SECRET;
  const token = getTokenFromRequest(request);

  if (token && await verifyToken(secret, token)) {
    return context.next();
  }

  // Redirect to ritual
  return new Response(null, {
    status: 302,
    headers: { Location: '/ritual.html' }
  });
}
