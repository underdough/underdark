const API = '';

let allPosts = [];
let activeTag = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => filterPosts(), 300));
  }

  loadPosts();
  loadTags();
});

async function loadPosts() {
  try {
    const res = await authFetch('/api/posts');
    allPosts = await res.json();
    renderPosts(allPosts);
  } catch (e) {
    console.error('Error loading posts:', e);
    showEmpty();
  }
}

async function loadTags() {
  try {
    const res = await authFetch('/api/tags');
    const tags = await res.json();
    renderTagFilters(tags);
  } catch (e) {
    console.error('Error loading tags:', e);
  }
}

function renderTagFilters(tags) {
  const container = document.getElementById('tag-filters');
  if (!container || tags.length === 0) return;
  container.innerHTML = tags.map(t =>
    `<button class="tag-filter" data-tag="${t.name}" onclick="toggleTag('${t.name}')">#${t.name} <span>${t.count}</span></button>`
  ).join('');
}

function toggleTag(tag) {
  activeTag = activeTag === tag ? null : tag;
  document.querySelectorAll('.tag-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tag === activeTag);
  });
  filterPosts();
}

function filterPosts() {
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  let filtered = allPosts;
  if (activeTag) {
    filtered = filtered.filter(p => p.tags && p.tags.includes(activeTag));
  }
  if (search) {
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(search) ||
      p.content.toLowerCase().includes(search)
    );
  }
  renderPosts(filtered);
}

function renderPosts(posts) {
  const grid = document.getElementById('posts-grid');
  const emptyState = document.getElementById('empty-state');
  if (!grid) return;

  if (posts.length === 0) {
    grid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  grid.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  grid.innerHTML = posts.map(post => {
    const date = new Date(post.createdAt).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    const excerpt = stripMarkdown(post.content).substring(0, 120) + (post.content.length > 120 ? '...' : '');
    const tags = (post.tags || []).slice(0, 3).map(t =>
      `<span class="tag">#${t}</span>`
    ).join('');
    const cover = post.coverImage
      ? `<img class="post-card-cover" src="${post.coverImage}" alt="${post.title}">`
      : '';
    const mood = post.mood ? `<span class="post-card-mood">${post.mood}</span>` : '';
    const musicBadge = post.music ? '<span title="Tiene música">🎵</span>' : '';

    return `
      <div class="post-card" onclick="window.location.href='/post.html?id=${post.id}'">
        ${cover}
        <div class="post-card-body">
          <div class="post-card-date">${date} ${musicBadge}</div>
          <h3 class="post-card-title">${post.title}</h3>
          <p class="post-card-excerpt">${excerpt}</p>
        </div>
        <div class="post-card-footer">
          <div class="post-card-tags">${tags}</div>
          ${mood}
        </div>
      </div>
    `;
  }).join('');
}

function showEmpty() {
  const grid = document.getElementById('posts-grid');
  const emptyState = document.getElementById('empty-state');
  if (grid) grid.style.display = 'none';
  if (emptyState) emptyState.style.display = 'block';
}

function stripMarkdown(md) {
  return md
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/^\s*>/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}