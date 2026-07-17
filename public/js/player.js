class DarkPlayer {
  constructor() {
    this.playerEl = document.getElementById('music-player');
    this.ytContainer = document.getElementById('yt-player-hidden');
    this.ytPlayer = null;
    this.ytReady = false;
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.updateInterval = null;
    this.loadYouTubeAPI();
    this.bindEvents();
  }

  loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      this.initYTPlayer();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    window.onYouTubeIframeAPIReady = () => this.initYTPlayer();
  }

  initYTPlayer() {
    this.ytPlayer = new YT.Player('yt-player-hidden', {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          this.ytReady = true;
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) {
            this.next();
          } else if (e.data === YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            this.updatePlayButton();
            this.startProgressUpdate();
          } else if (e.data === YT.PlayerState.PAUSED) {
            this.isPlaying = false;
            this.updatePlayButton();
            this.stopProgressUpdate();
          }
        }
      }
    });
  }

  bindEvents() {
    const playBtn = document.getElementById('btn-play');
    const closeBtn = document.getElementById('btn-close-player');
    const progressBar = document.getElementById('progress-bar');
    const volumeSlider = document.getElementById('volume-slider');

    playBtn?.addEventListener('click', () => this.togglePlay());
    closeBtn?.addEventListener('click', () => this.hide());
    progressBar?.addEventListener('click', (e) => this.seek(e));
    volumeSlider?.addEventListener('input', (e) => this.setVolume(e.target.value));
  }

  addToQueue(ytId, title) {
    this.queue.push({ ytId, title });
    if (this.queue.length === 1) {
      this.loadTrack(0);
    }
  }

  loadTrack(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.currentIndex = index;
    const track = this.queue[index];
    this.show();
    this.updateInfo(track);

    const thumb = document.getElementById('player-yt-thumb');
    if (thumb) {
      thumb.style.backgroundImage = `url(https://img.youtube.com/vi/${track.ytId}/default.jpg)`;
    }

    if (this.ytReady) {
      this.ytPlayer.loadVideoById(track.ytId);
      this.ytPlayer.pauseVideo();
    } else {
      const checkReady = setInterval(() => {
        if (this.ytReady) {
          clearInterval(checkReady);
          this.ytPlayer.loadVideoById(track.ytId);
          this.ytPlayer.pauseVideo();
        }
      }, 200);
    }
  }

  play() {
    if (!this.ytReady || !this.ytPlayer) return;
    this.ytPlayer.playVideo();
  }

  pause() {
    if (!this.ytReady || !this.ytPlayer) return;
    this.ytPlayer.pauseVideo();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  next() {
    if (this.currentIndex < this.queue.length - 1) {
      this.loadTrack(this.currentIndex + 1);
      this.play();
    } else {
      this.pause();
    }
  }

  seek(e) {
    if (!this.ytReady || !this.ytPlayer) return;
    const rect = e.target.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const duration = this.ytPlayer.getDuration();
    this.ytPlayer.seekTo(percent * duration, true);
  }

  setVolume(val) {
    if (!this.ytReady || !this.ytPlayer) return;
    this.ytPlayer.setVolume(parseInt(val));
  }

  startProgressUpdate() {
    this.stopProgressUpdate();
    this.updateInterval = setInterval(() => this.updateProgress(), 500);
  }

  stopProgressUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  updateProgress() {
    if (!this.ytReady || !this.ytPlayer) return;
    const fill = document.getElementById('progress-fill');
    const timeEl = document.getElementById('player-time');
    if (!fill) return;

    const current = this.ytPlayer.getCurrentTime() || 0;
    const duration = this.ytPlayer.getDuration() || 0;
    if (duration === 0) return;

    const percent = (current / duration) * 100;
    fill.style.width = `${percent}%`;
    timeEl.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
  }

  formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  updateInfo(track) {
    const titleEl = document.getElementById('player-title');
    if (titleEl) titleEl.textContent = track.title || 'Sin título';
  }

  updatePlayButton() {
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = this.isPlaying ? '⏸' : '▶';
  }

  show() {
    if (this.playerEl) this.playerEl.classList.add('active');
  }

  hide() {
    this.pause();
    if (this.playerEl) this.playerEl.classList.remove('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.darkPlayer = new DarkPlayer();
});