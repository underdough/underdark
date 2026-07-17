let editMode = 'write';
let currentPostId = null;
let coverUrl = '';
let musicUrl = '';
let autoSaveTimer = null;
let lastContent = '';

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  const params = new URLSearchParams(window.location.search);
  currentPostId = params.get('id');

  if (currentPostId) {
    document.getElementById('editor-title').textContent = 'Editar Escrito';
    loadPost(currentPostId);
  }

  setupToolbar();
  setupUploads();
  setupEditorToggle();
  setupSaveButtons();
  setupMarkdownPreview();
  setupSplitHandle();
  setupFocusMode();
  setupAutoSave();
  setupWordCount();
  createSaveIndicator();
  createAutosaveIndicator();
});

function createSaveIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'save-indicator';
  indicator.id = 'save-indicator';
  indicator.innerHTML = '<span class="save-dot"></span><span class="save-text">Guardando...</span>';
  document.body.appendChild(indicator);
}

function createAutosaveIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'autosave-indicator';
  indicator.id = 'autosave-indicator';
  indicator.innerHTML = '<span class="autosave-dot"></span><span>Auto-guardado</span>';
  document.body.appendChild(indicator);
}

function showSaveIndicator(type = 'saving') {
  const indicator = document.getElementById('save-indicator');
  if (!indicator) return;

  indicator.className = 'save-indicator show ' + type;
  indicator.querySelector('.save-text').textContent =
    type === 'saving' ? 'Guardando...' : 'Guardado en la oscuridad';

  if (type === 'success') {
    const wave = document.createElement('div');
    wave.className = 'save-wave';
    indicator.appendChild(wave);
    setTimeout(() => wave.remove(), 1000);
  }

  setTimeout(() => {
    indicator.classList.remove('show');
  }, 2500);
}

function showAutosaveIndicator() {
  const indicator = document.getElementById('autosave-indicator');
  if (!indicator) return;
  indicator.classList.add('active');
  setTimeout(() => indicator.classList.remove('active'), 2000);
}

async function loadPost(id) {
  try {
    const res = await authFetch(`/api/posts/${id}`);
    if (!res.ok) throw new Error('Not found');
    const post = await res.json();

    document.getElementById('post-title').value = post.title || '';
    document.getElementById('post-tags').value = (post.tags || []).join(', ');
    document.getElementById('post-mood').value = post.mood || '';
    document.getElementById('post-content').value = post.content || '';
    lastContent = post.content || '';

    if (post.coverImage) {
      coverUrl = post.coverImage;
      const preview = document.getElementById('cover-preview');
      preview.src = post.coverImage;
      preview.style.display = 'block';
      document.getElementById('cover-placeholder').style.display = 'none';
    }

    if (post.music) {
      musicUrl = post.music;
      document.getElementById('music-info').style.display = 'flex';
      document.getElementById('music-placeholder').style.display = 'none';
      const name = post.music.split('/').pop();
      document.getElementById('music-name').textContent = name;
    }
  } catch (e) {
    console.error('Error loading post:', e);
  }
}

function setupToolbar() {
  document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 300);

      const action = btn.dataset.action;
      const textarea = document.getElementById('post-content');
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);

      const insertions = {
        bold: { before: '**', after: '**', placeholder: 'texto en negrita' },
        italic: { before: '*', after: '*', placeholder: 'texto en cursiva' },
        heading: { before: '## ', after: '', placeholder: 'Título' },
        link: { before: '[', after: '](url)', placeholder: 'texto del enlace' },
        image: { before: '![', after: '](url)', placeholder: 'descripción' },
        code: { before: '`', after: '`', placeholder: 'código' },
        quote: { before: '> ', after: '', placeholder: 'cita' },
        list: { before: '- ', after: '', placeholder: 'elemento' }
      };

      const ins = insertions[action];
      if (!ins) return;

      const text = selected || ins.placeholder;
      const newText = ins.before + text + ins.after;
      textarea.setRangeText(newText, start, end, 'select');
      textarea.focus();
      textarea.dispatchEvent(new Event('input'));
    });
  });

  document.getElementById('btn-upload-media')?.addEventListener('click', () => {
    document.getElementById('media-upload-input').click();
  });

  document.getElementById('media-upload-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) {
      const textarea = document.getElementById('post-content');
      const pos = textarea.selectionStart;
      const insertion = `![${file.name}](${url})`;
      textarea.setRangeText(insertion, pos, pos, 'end');
      textarea.focus();
      textarea.dispatchEvent(new Event('input'));
    }
    e.target.value = '';
  });
}

function setupUploads() {
  setupDropZone('cover-upload', 'cover-file', async (url) => {
    coverUrl = url;
    const preview = document.getElementById('cover-preview');
    preview.src = url;
    preview.style.display = 'block';
    document.getElementById('cover-placeholder').style.display = 'none';
  });

  const coverUrlInput = document.getElementById('cover-url');
  if (coverUrlInput) {
    coverUrlInput.addEventListener('change', () => {
      if (coverUrlInput.value) {
        coverUrl = coverUrlInput.value;
      }
    });
  }

  setupYouTubeInput();
}

function setupYouTubeInput() {
  const input = document.getElementById('youtube-id-input');
  const preview = document.getElementById('youtube-preview');
  const inputWrap = document.getElementById('youtube-input-wrap');
  const thumb = document.getElementById('youtube-thumb');
  const title = document.getElementById('youtube-title');
  const removeBtn = document.getElementById('btn-remove-music');

  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val) setYouTubeId(val);
    }
  });

  input.addEventListener('blur', () => {
    const val = input.value.trim();
    if (val && val !== musicUrl) setYouTubeId(val);
  });

  removeBtn?.addEventListener('click', () => {
    musicUrl = '';
    preview.style.display = 'none';
    inputWrap.style.display = 'flex';
    input.value = '';
  });

  function setYouTubeId(id) {
    id = id.replace(/.*(?:v=|\/embed\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11}).*/, '$1');
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      input.style.borderColor = 'var(--neon-red)';
      setTimeout(() => input.style.borderColor = '', 1500);
      return;
    }
    musicUrl = id;
    thumb.src = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
    title.textContent = id;
    preview.style.display = 'flex';
    inputWrap.style.display = 'none';
  }

  if (musicUrl) {
    thumb.src = `https://img.youtube.com/vi/${musicUrl}/mqdefault.jpg`;
    title.textContent = musicUrl;
    preview.style.display = 'flex';
    inputWrap.style.display = 'none';
  }
}

function setupDropZone(zoneId, inputId, callback) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') input.click();
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      const url = await uploadFile(file);
      if (url) callback(url);
    }
  });

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = await uploadFile(file);
      if (url) callback(url);
    }
  });
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await authFetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    return data.url;
  } catch (e) {
    console.error('Upload error:', e);
    return null;
  }
}

function setupEditorToggle() {
  const textarea = document.getElementById('post-content');
  const preview = document.getElementById('editor-preview');
  const panels = document.querySelector('.editor-panels');
  const btnWrite = document.getElementById('btn-write-mode');
  const btnPreview = document.getElementById('btn-preview-mode');
  const btnSplit = document.getElementById('btn-split-mode');

  function setMode(mode) {
    editMode = mode;
    panels.classList.remove('split');
    textarea.classList.remove('hidden');
    preview.classList.remove('active');
    btnWrite.classList.remove('active');
    btnPreview.classList.remove('active');
    btnSplit.classList.remove('active');

    const existingHandle = panels.querySelector('.split-handle');
    if (existingHandle) existingHandle.remove();

    if (mode === 'write') {
      btnWrite.classList.add('active');
    } else if (mode === 'preview') {
      btnPreview.classList.add('active');
      textarea.classList.add('hidden');
      preview.classList.add('active');
      renderPreview();
    } else if (mode === 'split') {
      btnSplit.classList.add('active');
      panels.classList.add('split');
      preview.classList.add('active');

      const handle = document.createElement('div');
      handle.className = 'split-handle';
      panels.insertBefore(handle, preview);
      setupSplitHandle();

      renderPreview();
    }
  }

  btnWrite?.addEventListener('click', () => setMode('write'));
  btnPreview?.addEventListener('click', () => setMode('preview'));
  btnSplit?.addEventListener('click', () => setMode('split'));
}

function setupSplitHandle() {
  const handle = document.querySelector('.split-handle');
  const panels = document.querySelector('.editor-panels');
  if (!handle || !panels) return;

  let isDragging = false;

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = panels.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    const clamped = Math.max(20, Math.min(80, percent));
    panels.style.gridTemplateColumns = `${clamped}px 4px 1fr`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

function setupMarkdownPreview() {
  const textarea = document.getElementById('post-content');
  textarea?.addEventListener('input', () => {
    if (editMode !== 'write') renderPreview();
    updateWordCount();
  });
}

function renderPreview() {
  const textarea = document.getElementById('post-content');
  const preview = document.getElementById('editor-preview');
  if (textarea && preview && typeof marked !== 'undefined') {
    const html = marked.parse(textarea.value || '*Nada que previsualizar...*');
    preview.style.opacity = '0';
    preview.style.transform = 'translateX(5px)';
    requestAnimationFrame(() => {
      preview.innerHTML = html;
      requestAnimationFrame(() => {
        preview.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        preview.style.opacity = '1';
        preview.style.transform = 'translateX(0)';
      });
    });
  }
}

function setupFocusMode() {
  const textarea = document.getElementById('post-content');
  const editorForm = document.querySelector('.editor-form');
  if (!textarea || !editorForm) return;

  let focusTimeout;

  textarea.addEventListener('focus', () => {
    clearTimeout(focusTimeout);
    editorForm.classList.add('focus-active');
  });

  textarea.addEventListener('blur', () => {
    focusTimeout = setTimeout(() => {
      editorForm.classList.remove('focus-active');
    }, 150);
  });
}

function setupAutoSave() {
  const textarea = document.getElementById('post-content');
  const titleInput = document.getElementById('post-title');

  const triggerAutoSave = () => {
    const content = textarea?.value || '';
    const title = titleInput?.value || '';

    if (content === lastContent && !title) return;
    if (content.length < 10) return;

    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      if (!currentPostId) {
        lastContent = content;
        showAutosaveIndicator();
        return;
      }

      try {
        const tagsStr = document.getElementById('post-tags')?.value || '';
        const mood = document.getElementById('post-mood')?.value || '';
        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

        await authFetch(`/api/posts/${currentPostId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            tags,
            mood,
            coverImage: coverUrl || null,
            music: musicUrl || null
          })
        });
        lastContent = content;
        showAutosaveIndicator();
      } catch (e) {
        console.error('Auto-save error:', e);
      }
    }, 2000);
  };

  textarea?.addEventListener('input', triggerAutoSave);
  titleInput?.addEventListener('input', triggerAutoSave);
}

function setupWordCount() {
  const counter = document.createElement('div');
  counter.className = 'word-count';
  counter.id = 'word-count';
  counter.textContent = '0 palabras';
  document.body.appendChild(counter);

  const textarea = document.getElementById('post-content');
  textarea?.addEventListener('input', updateWordCount);
}

function updateWordCount() {
  const textarea = document.getElementById('post-content');
  const counter = document.getElementById('word-count');
  if (!textarea || !counter) return;

  const text = textarea.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;
  counter.textContent = `${words} palabras · ${chars} caracteres`;
}

function setupSaveButtons() {
  document.getElementById('btn-publish')?.addEventListener('click', () => savePost(true));
  document.getElementById('btn-draft')?.addEventListener('click', () => savePost(false));
}

async function savePost(publish) {
  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value;
  const tagsStr = document.getElementById('post-tags').value;
  const mood = document.getElementById('post-mood').value;
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  if (!title) {
    alert('Escribe un título para tu escrito.');
    return;
  }

  showSaveIndicator('saving');

  const body = { title, content, tags, mood, coverImage: coverUrl || null, music: musicUrl || null };

  try {
    let res;
    if (currentPostId) {
      res = await authFetch(`/api/posts/${currentPostId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
    } else {
      res = await authFetch('/api/posts', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
    }

    const post = await res.json();
    lastContent = content;

    showSaveIndicator('success');

    if (publish) {
      setTimeout(() => {
        window.location.href = `/post.html?id=${post.id}`;
      }, 800);
    } else {
      currentPostId = post.id;
      document.getElementById('editor-title').textContent = 'Editar Escrito';
    }
  } catch (e) {
    console.error('Save error:', e);
    showSaveIndicator('error');
  }
}