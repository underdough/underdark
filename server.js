const express = require('express');
const multer = require('multer');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');

const AUTH_FILE = path.join(DATA, 'auth.json');
const POSTS_FILE = path.join(DATA, 'posts.json');
const UPLOADS_DIR = path.join(PUBLIC, 'media', 'uploads');
const MUSIC_DIR = path.join(PUBLIC, 'media', 'music');

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });

if (!fs.existsSync(AUTH_FILE)) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({
    passphrase: process.env.UNDERDARK_PASSPHRASE || 'oscuridad',
    tokenSecret: process.env.UNDERDARK_SECRET || crypto.randomBytes(32).toString('hex'),
    tokenExpiry: 86400
  }, null, 2));
}
if (!fs.existsSync(POSTS_FILE)) {
  fs.writeFileSync(POSTS_FILE, '[]');
}

const authConfig = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));

// --- Auth ---

function generateToken() {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + (authConfig.tokenExpiry || 86400) * 1000,
    seed: crypto.randomBytes(16).toString('hex')
  };
  const hmac = crypto.createHmac('sha256', authConfig.tokenSecret);
  hmac.update(JSON.stringify(payload));
  const sig = hmac.digest('hex');
  return Buffer.from(JSON.stringify({ ...payload, sig })).toString('base64');
}

function verifyToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (decoded.exp < Date.now()) return false;
    const hmac = crypto.createHmac('sha256', authConfig.tokenSecret);
    const { sig, ...payload } = decoded;
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex') === sig;
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = req.cookies && req.cookies.underdark_token;
  const tokenFromQuery = req.query && req.query.token;
  const token = tokenFromHeader || tokenFromCookie || tokenFromQuery;
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// --- Public routes ---

app.get('/api/auth', (req, res) => {
  res.status(405).json({ error: 'Usa POST' });
});

app.post('/api/auth', (req, res) => {
  const { passphrase } = req.body;
  if (passphrase === authConfig.passphrase) {
    const token = generateToken();
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('underdark_token');
  res.json({ message: 'Sesión cerrada' });
});

// --- Protected pages (before static) ---

function serveProtectedPage(filename) {
  return (req, res) => {
    const authHeader = req.headers.authorization;
    const referer = req.headers.referer || '';
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const fromRitual = referer.includes('ritual.html') || referer.includes('/api/auth');
    const cookieToken = req.cookies && req.cookies.underdark_token;
    const queryToken = req.query && req.query.token;
    const savedToken = token || cookieToken || queryToken;

    if (savedToken && verifyToken(savedToken)) {
      return res.sendFile(path.join(PUBLIC, filename));
    }
    if (fromRitual) {
      return res.sendFile(path.join(PUBLIC, filename));
    }
    return res.redirect('/ritual.html');
  };
}

app.get('/', serveProtectedPage('index.html'));
app.get('/index.html', serveProtectedPage('index.html'));
app.get('/post.html', serveProtectedPage('post.html'));
app.get('/editor.html', serveProtectedPage('editor.html'));
app.get('/constellation.html', serveProtectedPage('constellation.html'));

// --- Static files (after protected pages) ---

app.use(express.static(PUBLIC));

// --- Protected API ---

function readPosts() {
  if (!fs.existsSync(POSTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
}

function writePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isMusic = file.mimetype.startsWith('audio/');
    cb(null, isMusic ? MUSIC_DIR : UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.get('/api/posts', requireAuth, (req, res) => {
  const posts = readPosts();
  const { tag, search } = req.query;
  let filtered = posts;
  if (tag) filtered = filtered.filter(p => p.tags && p.tags.includes(tag));
  if (search) filtered = filtered.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase())
  );
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(filtered);
});

app.get('/api/posts/:id', requireAuth, (req, res) => {
  const posts = readPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });
  res.json(post);
});

app.post('/api/posts', requireAuth, (req, res) => {
  const posts = readPosts();
  const { title, content, tags, coverImage, music, mood } = req.body;
  const newPost = {
    id: uuidv4(),
    title: title || 'Sin título',
    content: content || '',
    tags: tags || [],
    coverImage: coverImage || null,
    music: music || null,
    mood: mood || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  posts.push(newPost);
  writePosts(posts);
  res.status(201).json(newPost);
});

app.put('/api/posts/:id', requireAuth, (req, res) => {
  const posts = readPosts();
  const index = posts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Post no encontrado' });
  posts[index] = {
    ...posts[index],
    ...req.body,
    id: posts[index].id,
    createdAt: posts[index].createdAt,
    updatedAt: new Date().toISOString()
  };
  writePosts(posts);
  res.json(posts[index]);
});

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  let posts = readPosts();
  const index = posts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Post no encontrado' });
  posts.splice(index, 1);
  writePosts(posts);
  res.json({ message: 'Post eliminado' });
});

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' });
  const isMusic = req.file.mimetype.startsWith('audio/');
  const url = `/media/${isMusic ? 'music' : 'uploads'}/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, mimetype: req.file.mimetype });
});

app.get('/api/tags', requireAuth, (req, res) => {
  const posts = readPosts();
  const tagCount = {};
  posts.forEach(p => {
    if (p.tags) {
      p.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    }
  });
  res.json(Object.entries(tagCount).map(([name, count]) => ({ name, count })));
});

app.listen(PORT, () => {
  console.log(`Underdark server running on http://localhost:${PORT}`);
});
