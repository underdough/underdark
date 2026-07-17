class ConstellationMap {
  constructor() {
    this.canvas = document.getElementById('constellation-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.nodes = [];
    this.edges = [];
    this.tagNodes = [];
    this.bgStars = [];
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragNode = null;
    this.lastMouse = { x: 0, y: 0 };
    this.hoveredNode = null;
    this.activeTagFilter = null;
    this.time = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.pinchStartDist = 0;
    this.pinchStartZoom = 1;
    this.touchStartTime = 0;
    this.touchMoved = false;

    this.resize();
    this.initBgStars();
    this.bindEvents();
    this.loadData();
    this.animate();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  initBgStars() {
    this.bgStars = [];
    for (let i = 0; i < 200; i++) {
      this.bgStars.push({
        x: Math.random() * 3000 - 500,
        y: Math.random() * 2000 - 200,
        size: Math.random() * 1.5 + 0.2,
        brightness: Math.random() * 0.6 + 0.1,
        twinkleSpeed: Math.random() * 0.03 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2
      });
    }
  }

  async loadData() {
    try {
      const [postsRes, tagsRes] = await Promise.all([
        authFetch('/api/posts'),
        authFetch('/api/tags')
      ]);
      const posts = await postsRes.json();
      const tags = await tagsRes.json();

      this.buildGraph(posts, tags);
      this.renderTagFilters(tags);
    } catch (e) {
      console.error('Error loading constellation data:', e);
    }
  }

  buildGraph(posts, tags) {
    this.nodes = [];
    this.edges = [];
    this.tagNodes = [];

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const postRadius = Math.min(this.width, this.height) * 0.3;

    posts.forEach((post, i) => {
      const angle = (i / posts.length) * Math.PI * 2 - Math.PI / 2;
      const jitter = (Math.random() - 0.5) * 100;
      this.nodes.push({
        id: post.id,
        type: 'post',
        x: centerX + Math.cos(angle) * (postRadius + jitter),
        y: centerY + Math.sin(angle) * (postRadius + jitter),
        vx: 0,
        vy: 0,
        title: post.title,
        excerpt: (post.content || '').substring(0, 100),
        coverImage: post.coverImage,
        tags: post.tags || [],
        date: post.createdAt,
        mood: post.mood,
        size: 8,
        color: this.getPostColor(post.mood),
        pulse: Math.random() * Math.PI * 2
      });
    });

    const tagSet = new Set();
    posts.forEach(post => {
      (post.tags || []).forEach(tag => tagSet.add(tag));
    });

    let tagIndex = 0;
    tagSet.forEach(tag => {
      const angle = (tagIndex / tagSet.size) * Math.PI * 2;
      const tagRadius = Math.min(this.width, this.height) * 0.15;
      this.tagNodes.push({
        id: `tag-${tag}`,
        type: 'tag',
        name: tag,
        x: centerX + Math.cos(angle) * tagRadius + (Math.random() - 0.5) * 50,
        y: centerY + Math.sin(angle) * tagRadius + (Math.random() - 0.5) * 50,
        size: 4,
        color: '#22d3ee',
        pulse: Math.random() * Math.PI * 2
      });
      tagIndex++;
    });

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const shared = this.nodes[i].tags.filter(t => this.nodes[j].tags.includes(t));
        if (shared.length > 0) {
          this.edges.push({
            from: this.nodes[i],
            to: this.nodes[j],
            sharedTags: shared,
            strength: shared.length,
            pulse: Math.random() * Math.PI * 2
          });
        }
      }
    }

    this.nodes.forEach(node => {
      node.tags.forEach(tag => {
        const tagNode = this.tagNodes.find(t => t.name === tag);
        if (tagNode) {
          this.edges.push({
            from: node,
            to: tagNode,
            sharedTags: [tag],
            strength: 0.5,
            isTagEdge: true,
            pulse: Math.random() * Math.PI * 2
          });
        }
      });
    });
  }

  getPostColor(mood) {
    const colors = {
      '🌑 Oscuridad profunda': '#6b21a8',
      '🔥 Fuego interior': '#ef4444',
      '🌀 Caos mental': '#a855f7',
      '💧 Melancolía': '#3b82f6',
      '⚡ Euforia oscura': '#eab308',
      '🌙 Serenidad nocturna': '#22d3ee',
      '💀 Vacío existencial': '#6b7280',
      '✦ Iluminación': '#fbbf24'
    };
    return colors[mood] || '#a855f7';
  }

  renderTagFilters(tags) {
    const container = document.getElementById('constellation-tags');
    if (!container) return;
    container.innerHTML = tags.map(t =>
      `<button class="constellation-tag" data-tag="${t.name}">#${t.name}</button>`
    ).join('');

    container.querySelectorAll('.constellation-tag').forEach(btn => {
      btn.addEventListener('click', () => this.filterByTag(btn.dataset.tag));
    });
  }

  filterByTag(tag) {
    if (this.activeTagFilter === tag) {
      this.activeTagFilter = null;
    } else {
      this.activeTagFilter = tag;
    }
    document.querySelectorAll('.constellation-tag').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tag === this.activeTagFilter);
    });
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.dpr = window.devicePixelRatio || 1;
      this.resize();
    });

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e.clientX, e.clientY));
    this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e.clientX, e.clientY));
    this.canvas.addEventListener('mouseup', (e) => this.onPointerUp(e.clientX, e.clientY));
    this.canvas.addEventListener('mouseleave', () => this.onPointerLeave());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.93 : 1.07;
      this.zoom = Math.max(0.3, Math.min(3, this.zoom * zoomFactor));
    }, { passive: false });

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.touchStartTime = Date.now();
        this.touchMoved = false;
        this.onPointerDown(touch.clientX, touch.clientY);
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        this.dragNode = null;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.pinchStartDist = Math.sqrt(dx * dx + dy * dy);
        this.pinchStartZoom = this.zoom;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.touchMoved = true;
        this.onPointerMove(touch.clientX, touch.clientY);
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (this.pinchStartDist > 0) {
          this.zoom = Math.max(0.3, Math.min(3, this.pinchStartZoom * (dist / this.pinchStartDist)));
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (e.touches.length === 0) {
        if (!this.touchMoved && Date.now() - this.touchStartTime < 300) {
          const node = this.hoveredNode;
          if (node && node.type === 'post') {
            window.location.href = `/post.html?id=${node.id}`;
          }
        }
        this.onPointerUp(this.lastMouse.x, this.lastMouse.y);
        this.pinchStartDist = 0;
      }
    }, { passive: false });

    // Zoom buttons
    document.getElementById('zoom-in')?.addEventListener('click', () => {
      this.zoom = Math.min(3, this.zoom * 1.2);
    });
    document.getElementById('zoom-out')?.addEventListener('click', () => {
      this.zoom = Math.max(0.3, this.zoom / 1.2);
    });
    document.getElementById('zoom-reset')?.addEventListener('click', () => {
      this.zoom = 1;
      this.offsetX = 0;
      this.offsetY = 0;
    });

    // Search
    document.getElementById('constellation-search')?.addEventListener('input', (e) => {
      this.searchFilter = e.target.value.toLowerCase();
    });
  }

  onPointerDown(x, y) {
    const node = this.getNodeAt(x, y);
    if (node) {
      this.dragNode = node;
      this.isDragging = true;
    } else {
      this.isDragging = true;
      this.dragNode = null;
    }
    this.lastMouse = { x, y };
  }

  onPointerMove(x, y) {
    const dx = x - this.lastMouse.x;
    const dy = y - this.lastMouse.y;

    if (this.isDragging && this.dragNode) {
      this.dragNode.x += dx / this.zoom;
      this.dragNode.y += dy / this.zoom;
    } else if (this.isDragging) {
      this.offsetX += dx;
      this.offsetY += dy;
    }

    this.lastMouse = { x, y };

    const hovered = this.getNodeAt(x, y);
    if (hovered !== this.hoveredNode) {
      this.hoveredNode = hovered;
      this.updateTooltip(x, y, hovered);
      this.canvas.style.cursor = hovered ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
    }

    if (this.hoveredNode) {
      this.updateTooltipPosition(x, y);
    }
  }

  onPointerUp(x, y) {
    this.isDragging = false;
    this.dragNode = null;
  }

  onPointerLeave() {
    this.isDragging = false;
    this.dragNode = null;
    this.hoveredNode = null;
    this.hideTooltip();
  }

  getNodeAt(mx, my) {
    const allNodes = [...this.nodes, ...this.tagNodes];
    for (let i = allNodes.length - 1; i >= 0; i--) {
      const n = allNodes[i];
      const sx = n.x * this.zoom + this.offsetX;
      const sy = n.y * this.zoom + this.offsetY;
      const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
      const hitSize = (n.size + 8) * this.zoom;
      if (dist < Math.max(hitSize, 20)) return n;
    }
    return null;
  }

  updateTooltip(x, y, node) {
    const tooltip = document.getElementById('node-tooltip');
    if (!tooltip || !node) {
      this.hideTooltip();
      return;
    }

    if (node.type === 'post') {
      document.getElementById('tooltip-title').textContent = node.title;
      document.getElementById('tooltip-excerpt').textContent = node.excerpt || '';
      document.getElementById('tooltip-date').textContent = new Date(node.date).toLocaleDateString('es-ES');
      document.getElementById('tooltip-tags').textContent = node.tags.map(t => '#' + t).join(' ');
      const cover = document.getElementById('tooltip-cover');
      if (node.coverImage) {
        cover.style.backgroundImage = `url(${node.coverImage})`;
        cover.style.display = 'block';
      } else {
        cover.style.display = 'none';
      }
      tooltip.style.display = 'block';
      this.updateTooltipPosition(x, y);
    } else {
      this.hideTooltip();
    }
  }

  updateTooltipPosition(x, y) {
    const tooltip = document.getElementById('node-tooltip');
    if (!tooltip) return;

    const tipW = tooltip.offsetWidth || 240;
    const tipH = tooltip.offsetHeight || 180;
    const margin = 12;

    let tx = x + margin;
    let ty = y - margin;

    if (tx + tipW > window.innerWidth - margin) tx = x - tipW - margin;
    if (ty + tipH > window.innerHeight - margin) ty = y - tipH;
    if (ty < margin) ty = margin;
    if (tx < margin) tx = margin;

    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  }

  hideTooltip() {
    const tooltip = document.getElementById('node-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }

  animate() {
    this.time += 0.016;
    const w = this.width;
    const h = this.height;

    this.ctx.clearRect(0, 0, w, h);

    this.drawBgStars(w, h);

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.zoom, this.zoom);

    this.drawEdges();
    this.drawTagNodes();
    this.drawPostNodes();

    this.ctx.restore();

    requestAnimationFrame(() => this.animate());
  }

  drawBgStars(w, h) {
    this.bgStars.forEach(star => {
      const twinkle = Math.sin(this.time * star.twinkleSpeed * 60 + star.twinkleOffset) * 0.3 + 0.7;
      const sx = (star.x * 0.5) + this.offsetX * 0.2;
      const sy = (star.y * 0.5) + this.offsetY * 0.2;
      this.ctx.beginPath();
      this.ctx.arc(sx % w, sy % h, star.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(200, 200, 230, ${star.brightness * twinkle})`;
      this.ctx.fill();
    });
  }

  drawEdges() {
    this.edges.forEach(edge => {
      edge.pulse += 0.02;
      const pulseAlpha = Math.sin(edge.pulse) * 0.2 + 0.3;

      const isHighlighted = this.activeTagFilter &&
        edge.sharedTags.includes(this.activeTagFilter);

      const isHovered = this.hoveredNode &&
        (edge.from === this.hoveredNode || edge.to === this.hoveredNode);

      let alpha = edge.isTagEdge ? 0.1 : 0.2;
      let width = edge.isTagEdge ? 0.5 : 1;
      let color = `rgba(168, 85, 247, ${alpha})`;

      if (isHighlighted) {
        alpha = 0.8;
        width = 2;
        color = `rgba(168, 85, 247, ${alpha})`;
      }

      if (isHovered) {
        alpha = 0.9;
        width = 2.5;
        color = `rgba(168, 85, 247, ${alpha})`;
      }

      if (this.activeTagFilter && !isHighlighted && !isHovered) {
        alpha = 0.05;
        color = `rgba(100, 100, 120, ${alpha})`;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(edge.from.x, edge.from.y);
      this.ctx.lineTo(edge.to.x, edge.to.y);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = width;
      this.ctx.stroke();

      if (isHighlighted || isHovered) {
        const gradient = this.ctx.createLinearGradient(
          edge.from.x, edge.from.y, edge.to.x, edge.to.y
        );
        gradient.addColorStop(0, `rgba(168, 85, 247, ${pulseAlpha * 0.5})`);
        gradient.addColorStop(0.5, `rgba(34, 211, 238, ${pulseAlpha * 0.3})`);
        gradient.addColorStop(1, `rgba(168, 85, 247, ${pulseAlpha * 0.5})`);
        this.ctx.beginPath();
        this.ctx.moveTo(edge.from.x, edge.from.y);
        this.ctx.lineTo(edge.to.x, edge.to.y);
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = width + 1;
        this.ctx.stroke();
      }
    });
  }

  drawPostNodes() {
    this.nodes.forEach(node => {
      node.pulse += 0.03;
      const pulseSize = Math.sin(node.pulse) * 2 + node.size;

      const isHighlighted = this.activeTagFilter &&
        node.tags.includes(this.activeTagFilter);
      const isHovered = this.hoveredNode === node;
      const isDimmed = this.activeTagFilter && !isHighlighted && !isHovered;

      let alpha = isDimmed ? 0.2 : 1;

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, pulseSize + 6, 0, Math.PI * 2);
      this.ctx.fillStyle = node.color.replace(')', `, ${0.15 * alpha})`).replace('rgb', 'rgba');
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
      this.ctx.fillStyle = node.color.replace(')', `, ${0.4 * alpha})`).replace('rgb', 'rgba');
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, pulseSize * 0.5, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
      this.ctx.fill();

      if (isHovered || isHighlighted) {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, pulseSize + 10, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(168, 85, 247, ${0.6})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }

      if (alpha > 0.3) {
        this.ctx.font = '11px "Space Grotesk", sans-serif';
        this.ctx.fillStyle = `rgba(224, 223, 230, ${0.8 * alpha})`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(node.title, node.x, node.y + pulseSize + 16);
      }
    });
  }

  drawTagNodes() {
    this.tagNodes.forEach(node => {
      node.pulse += 0.02;
      const pulseSize = Math.sin(node.pulse) * 1.5 + node.size;

      const isActive = this.activeTagFilter === node.name;
      const isDimmed = this.activeTagFilter && !isActive;
      const isHovered = this.hoveredNode === node;

      let alpha = isDimmed ? 0.15 : 0.7;
      if (isActive) alpha = 1;
      if (isHovered) alpha = 1;

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, pulseSize + 3, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(34, 211, 238, ${0.1 * alpha})`;
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(34, 211, 238, ${0.6 * alpha})`;
      this.ctx.fill();

      this.ctx.font = `${isActive ? 'bold ' : ''}10px "JetBrains Mono", monospace`;
      this.ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`#${node.name}`, node.x, node.y - pulseSize - 6);
    });
  }
}

let constellation;
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  constellation = new ConstellationMap();
});
