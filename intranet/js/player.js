// ============================================================
//  INTRANET REDCW — Reproductor de Música Persistente
//  Usa BroadcastChannel para mantener estado entre páginas SPA
//  (sin iframe: es una SPA, el DOM no se destruye al navegar)
// ============================================================

const MusicPlayer = (() => {
  let tracks    = [];
  let filtered  = [];
  let idx       = -1;
  let shuffle   = false;
  let repeat    = false;
  let isPlaying = false;
  let loaded    = false;
  const audio   = new Audio();
  audio.preload = 'none';

  // ── sessionStorage para persistencia ──────────────────────
  function save() {
    try {
      if (tracks.length) {
        sessionStorage.setItem('mp_tracks', JSON.stringify(tracks));
        sessionStorage.setItem('mp_idx',    String(idx));
      } else {
        sessionStorage.removeItem('mp_tracks');
      }
    } catch(e) {}
  }

  function restore() {
    try {
      const t = sessionStorage.getItem('mp_tracks');
      if (!t) return false;
      const p = JSON.parse(t);
      if (!p || !p.length) return false;
      tracks   = p;
      filtered = tracks.slice();
      idx      = parseInt(sessionStorage.getItem('mp_idx') || '-1');
      loaded   = true;
      return true;
    } catch(e) { return false; }
  }

  // ── Cargar lista del servidor ──────────────────────────────
  async function fetchTracks(silent) {
    const btn = document.getElementById('btnRefreshMusic');
    if (btn) btn.querySelector('i').style.animation = 'spin .6s linear infinite';
    try {
      const { data } = await sb.from('archivos')
        .select('id,titulo,url_publica,extension,tamano,nombre_storj')
        .eq('activo', true)
        .in('extension', ['mp3','wav','ogg','m4a','aac','flac'])
        .order('created_at', { ascending: false })
        .limit(200);

      tracks = (data||[]).map(r => ({
        id:     r.id,
        titulo: r.titulo,
        url:    r.url_publica,
        ext:    r.extension,
        tamano: fmtTamano(r.tamano),
      }));
      filtered = tracks.slice();
      loaded   = true;
      save();
    } catch(e) {
      console.warn('Error cargando música:', e);
    } finally {
      if (btn) btn.querySelector('i').style.animation = '';
      renderList();
      updateCount();
      syncState();  // sincronizar lo que está sonando
    }
  }

  // ── Reproducir ─────────────────────────────────────────────
  function play(i) {
    if (i < 0 || i >= filtered.length) return;
    idx = i;
    const t = filtered[idx];
    audio.src = t.url;
    audio.load();
    audio.play().catch(e => console.warn('Audio error:', e));
    updatePlayerBar(t);
    save();
    renderList();
    setPlayPauseUI(true);
  }

  function updatePlayerBar(t) {
    const bar   = document.getElementById('playerBar');
    const title = document.getElementById('playerTitle');
    const ext   = document.getElementById('playerExt');
    if (bar)   bar.style.display = 'block';
    if (title) title.textContent = t.titulo;
    if (ext)   ext.textContent   = (t.ext||'').toUpperCase() + (t.tamano ? ' · ' + t.tamano : '');
  }

  function syncState() {
    // Restaurar UI si hay canción en memoria
    if (idx >= 0 && filtered[idx]) {
      updatePlayerBar(filtered[idx]);
      setPlayPauseUI(isPlaying || !audio.paused);
    }
  }

  audio.addEventListener('playing', () => {
    isPlaying = true; setPlayPauseUI(true);
  });
  audio.addEventListener('pause', () => {
    if (!audio.ended) { isPlaying = false; setPlayPauseUI(false); }
  });
  audio.addEventListener('ended', () => {
    isPlaying = false; next();
  });
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct  = audio.currentTime / audio.duration;
    const prog = document.getElementById('playerProgress');
    const tEl  = document.getElementById('playerTime');
    const dEl  = document.getElementById('playerDur');
    if (prog) prog.style.width = Math.round(pct*100) + '%';
    if (tEl)  tEl.textContent  = fmt(audio.currentTime);
    if (dEl)  dEl.textContent  = fmt(audio.duration);
  });

  function next() {
    if (!filtered.length) return;
    if (repeat)  { play(idx); return; }
    if (shuffle) { play(Math.floor(Math.random() * filtered.length)); return; }
    play((idx + 1) % filtered.length);
  }

  function setPlayPauseUI(playing) {
    const pp = document.getElementById('btnPause');
    const pl = document.getElementById('btnPlay');
    const ic = document.getElementById('iconMusica');
    if (pp) pp.style.display = playing ? 'block' : 'none';
    if (pl) pl.style.display = playing ? 'none'  : 'block';
    if (ic) ic.className     = playing ? 'fa-solid fa-music fa-beat' : 'fa-solid fa-music';
  }

  function renderList() {
    const cont = document.getElementById('musicList');
    if (!cont) return;
    if (!filtered.length) {
      cont.innerHTML = `<div style="text-align:center;padding:1.5rem;font-size:.82rem;color:var(--text-dim)">
        <i class="fa-solid fa-music" style="display:block;font-size:1.5rem;margin-bottom:.5rem"></i>
        No hay audios aún.</div>`;
      return;
    }
    cont.innerHTML = filtered.map((t, i) => {
      const activo = idx === i;
      return `<div class="mtrk" data-i="${i}"
        style="display:flex;align-items:center;gap:.6rem;padding:.5rem .85rem;cursor:pointer;
               background:${activo?'rgba(26,92,173,.08)':'transparent'};
               border-left:2px solid ${activo?'var(--accent)':'transparent'};transition:background .12s">
        <div style="width:26px;height:26px;border-radius:6px;flex-shrink:0;
                    background:linear-gradient(135deg,#1a4a8a,var(--accent));
                    display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#fff">
          ${activo && isPlaying ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-play"></i>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.81rem;font-weight:600;color:var(--text-main);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${xss(t.titulo)}</div>
          <div style="font-size:.67rem;color:var(--text-muted)">${xss((t.ext||'').toUpperCase())} · ${xss(t.tamano)}</div>
        </div>
      </div>`;
    }).join('');

    cont.querySelectorAll('.mtrk').forEach(el => {
      const i = parseInt(el.dataset.i);
      el.addEventListener('click', () => play(i));
      el.addEventListener('mouseenter', () => { if (!el.style.borderLeftColor || el.style.borderLeftColor==='transparent') el.style.background='var(--accent-soft)'; });
      el.addEventListener('mouseleave', () => { if (!el.style.borderLeftColor || el.style.borderLeftColor==='transparent') el.style.background='transparent'; });
    });
  }

  function updateCount() {
    const cnt = document.getElementById('musicCount');
    if (cnt) cnt.textContent = tracks.length + ' canción(es)';
  }

  function filter(q) {
    q = (q||'').toLowerCase().trim();
    filtered = q ? tracks.filter(t => t.titulo.toLowerCase().includes(q)) : tracks.slice();
    idx = -1;
    renderList();
  }

  function fmt(s) {
    s = s || 0;
    return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2,'0');
  }

  // ── API pública ────────────────────────────────────────────
  return {
    init() {
      // En SPA el audio no se destruye, pero si hay tracks en sessionStorage usarlos
      if (!loaded) restore();
      // Siempre sincronizar la UI al navegar a cualquier página
      syncState();
      if (loaded && tracks.length) { renderList(); updateCount(); }
    },

    openPanel() {
      // Siempre hacer fetch silencioso al abrir para detectar nuevas canciones
      if (!loaded) {
        restore() ? (renderList(), updateCount(), fetchTracks(true)) : fetchTracks(false);
      } else {
        fetchTracks(true); // refresh silencioso en background
      }
      syncState();
    },

    refresh() {
      try { sessionStorage.removeItem('mp_tracks'); } catch(e) {}
      loaded = false;
      fetchTracks(false);
    },

    pause()  { audio.pause(); },
    resume() { audio.play(); },
    seek(pct){ if (audio.duration) audio.currentTime = audio.duration * pct; },
    toggleShuffle() {
      shuffle = !shuffle;
      const b = document.getElementById('btnShuffle');
      if (b) b.style.color = shuffle ? 'var(--accent)' : 'var(--text-dim)';
    },
    toggleRepeat() {
      repeat = !repeat;
      const b = document.getElementById('btnRepeat');
      if (b) b.style.color = repeat ? 'var(--accent)' : 'var(--text-dim)';
    },
    filter,

    // Para reproducir desde la biblioteca
    playUrl(url, titulo, ext, tamano) {
      const existing = tracks.findIndex(t => t.url === url);
      if (existing >= 0) { filtered = tracks.slice(); play(existing); return; }
      // Agregar temporalmente
      tracks.unshift({ id:0, titulo, url, ext, tamano });
      filtered = tracks.slice();
      play(0);
    },
  };
})();

// Exponer globalmente
window.reproducirEnPlayer = (url, titulo, ext, tamano) => MusicPlayer.playUrl(url, titulo, ext, tamano);
