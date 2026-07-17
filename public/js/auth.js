function getAuthToken() {
  return localStorage.getItem('underdark_token');
}

function setAuthToken(token) {
  localStorage.setItem('underdark_token', token);
  document.cookie = `underdark_token=${token}; path=/; max-age=86400; SameSite=Lax`;
}

function clearAuthToken() {
  localStorage.removeItem('underdark_token');
  document.cookie = 'underdark_token=; path=/; max-age=0';
}

function getTokenFromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)underdark_token=([^;]*)/);
  return match ? match[1] : null;
}

function getValidToken() {
  return getAuthToken() || getTokenFromCookie();
}

function authHeaders() {
  const token = getValidToken();
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function authFetch(url, options = {}) {
  const token = getValidToken();
  if (!token) {
    window.location.href = '/ritual.html';
    return Promise.reject('No token');
  }
  options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  return fetch(url, options).then(res => {
    if (res.status === 401) {
      clearAuthToken();
      window.location.href = '/ritual.html';
      throw new Error('Unauthorized');
    }
    return res;
  });
}

function checkAuth() {
  if (!getValidToken()) {
    window.location.href = '/ritual.html';
    return false;
  }
  return true;
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch {}
  clearAuthToken();
  window.location.href = '/ritual.html';
}