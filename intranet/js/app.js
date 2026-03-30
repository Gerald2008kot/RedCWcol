// ============================================================
//  INTRANET REDCW — Core App (Auth + Router + Estado global)
// ============================================================

// ── Supabase ─────────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 10 } }
});

// ── Estado global ─────────────────────────────────────────────
let _usuario  = null;   // fila de perfiles
let _authUser = null;   // objeto auth de Supabase

// ── Tema ──────────────────────────────────────────────────────
(function aplicarTemaInicial() {
  const t = localStorage.getItem('redcw_tema') || 'system';
  const h = document.documentElement;
  if (t === 'light') h.setAttribute('data-theme','light');
  else if (t === 'dark') h.setAttribute('data-theme','dark');
  else h.removeAttribute('data-theme');
})();

function setTema(tema) {
  const h = document.documentElement;
  if (tema === 'light')       h.setAttribute('data-theme','light');
  else if (tema === 'dark')   h.setAttribute('data-theme','dark');
  else                        h.removeAttribute('data-theme');
  localStorage.setItem('redcw_tema', tema);
  if (_usuario) sb.from('perfiles').update({ tema }).eq('id', _usuario.id).then(()=>{});
}

function toggleTema() {
  const actual    = document.documentElement.getAttribute('data-theme') || 'system';
  const siguiente = actual === 'system' ? 'light' : actual === 'light' ? 'dark' : 'system';
  setTema(siguiente);
  const icon = document.getElementById('iconTema');
  if (icon) icon.className = siguiente === 'light' ? 'fa-solid fa-sun'
                           : siguiente === 'dark'  ? 'fa-solid fa-moon'
                           : 'fa-solid fa-circle-half-stroke';
}

// ── Router SPA ────────────────────────────────────────────────
// Detecta si la app corre bajo un subdirectorio (ej: /intranet)
const _basePath = (function() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // Si el index.html está en /intranet/ el primer segmento es "intranet"
  // Si está en la raíz, no hay base
  if (parts.length && !['dashboard','chat','biblioteca','upload','perfil','admin','encuestas','llamadas','login'].includes(parts[0])) {
    return '/' + parts[0];
  }
  return '';
})();

const ROUTES = {
  '':           'dashboard',
  '/':          'dashboard',
  '/dashboard': 'dashboard',
  '/chat':      'chat',
  '/biblioteca':'biblioteca',
  '/upload':    'upload',
  '/perfil':    'perfil',
  '/admin':     'admin',
  '/encuestas': 'encuestas',
  '/llamadas':  'llamadas',
  '/login':     'login',
};

function getRoute() {
  let path = window.location.pathname;
  if (_basePath) path = path.replace(_basePath, '') || '/';
  return ROUTES[path] ?? 'dashboard';
}

function navigate(path) {
  window.history.pushState({}, '', _basePath + path);
  renderPage(getRoute());
}

window.addEventListener('popstate', () => renderPage(getRoute()));

// ── Renderizar página ─────────────────────────────────────────
async function renderPage(page) {
  const app = document.getElementById('app');
  if (!app) return;

  // Sin auth → login
  if (!_authUser && page !== 'login') { renderLogin(); return; }
  if (_authUser  && page === 'login') { navigate('/dashboard'); return; }

  // Sin perfil cargado (puede ocurrir en el primer render) → esperar
  if (_authUser && !_usuario && page !== 'login') {
    _usuario = await cargarPerfil(_authUser.id);
    if (!_usuario) {
      // Perfil no existe en DB — mostrar error claro
      app.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    min-height:60vh;gap:1rem;padding:2rem;text-align:center">
          <i class="fa-solid fa-triangle-exclamation fa-2x" style="color:var(--warning)"></i>
          <h5 style="font-weight:700">Perfil no encontrado</h5>
          <p style="color:var(--text-muted);max-width:380px;font-size:.88rem">
            Tu cuenta existe en Auth pero no tiene perfil en la tabla <code>perfiles</code>.<br>
            Ejecuta el siguiente SQL en el panel de Supabase:
          </p>
          <pre style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;
                      padding:.85rem 1.1rem;font-size:.78rem;text-align:left;max-width:520px;overflow-x:auto">
INSERT INTO perfiles (id, nombre, apellido, rol, activo)
VALUES ('${_authUser.id}', 'Admin', 'RedCW', 'admin', true)
ON CONFLICT (id) DO UPDATE SET activo = true;</pre>
          <button onclick="location.reload()" class="btn btn-intra px-4">
            <i class="fa-solid fa-rotate-right me-2"></i>Recargar
          </button>
          <button onclick="logout()" class="btn btn-intra-outline px-4">
            <i class="fa-solid fa-right-from-bracket me-2"></i>Cerrar sesión
          </button>
        </div>`;
      return;
    }
    if (_usuario.tema) setTema(_usuario.tema);
    actualizarNavbar(_usuario, await sb.auth.getSession().then(r => r.data.session));
  }

  // Shell visible / oculto
  const shell = document.getElementById('appShell');
  if (shell) {
    if (page === 'login') shell.classList.add('no-shell');
    else shell.classList.remove('no-shell');
  }

  // Nav activo
  document.querySelectorAll('.nav-link[data-page]').forEach(a =>
    a.classList.toggle('active', a.dataset.page === page)
  );

  // Limpiar canal Realtime anterior
  if (window._activeChannel) {
    sb.removeChannel(window._activeChannel);
    window._activeChannel = null;
  }

  app.innerHTML = '<div class="page-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';

  try {
    switch (page) {
      case 'dashboard':  await renderDashboard(); break;
      case 'chat':       await renderChat();       break;
      case 'biblioteca': await renderBiblioteca(); break;
      case 'upload':     await renderUpload();     break;
      case 'perfil':     await renderPerfil();     break;
      case 'admin':      await renderAdmin();      break;
      case 'encuestas':  await renderEncuestas();  break;
      case 'llamadas':   await renderLlamadas();   break;
      default:           await renderDashboard();
    }
  } catch(err) {
    console.error('renderPage error:', err);
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  min-height:60vh;gap:.75rem;padding:2rem;text-align:center">
        <i class="fa-solid fa-circle-exclamation fa-2x" style="color:var(--danger)"></i>
        <h5 style="font-weight:700">Error al cargar la página</h5>
        <p style="color:var(--text-muted);font-size:.85rem">${xss(err.message)}</p>
        <button onclick="navigate('/dashboard')" class="btn btn-intra px-4">Ir al Dashboard</button>
      </div>`;
  }
}

// ── Auth helpers ──────────────────────────────────────────────
async function cargarPerfil(userId) {
  const { data, error } = await sb.from('perfiles').select('*').eq('id', userId).single();
  if (error) console.warn('cargarPerfil error:', error.message);
  return data || null;
}

async function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  await sb.auth.signOut();
  _usuario = null; _authUser = null;
  navigate('/login');
}

// ── Helpers globales ──────────────────────────────────────────
function xss(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function avatarUrl(url, nombre, apellido) {
  if (url && (url.includes('cloudinary') || url.startsWith('http'))) return url;
  const ini    = ((nombre||'?')[0] + (apellido||'?')[0]).toUpperCase();
  const colors = ['#1a5cad','#1e7e34','#c47a00','#8e44ad','#c0392b'];
  const bg     = colors[(ini.charCodeAt(0) + (ini.charCodeAt(1)||0)) % colors.length];
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
     <rect width="40" height="40" rx="20" fill="${bg}"/>
     <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
           fill="white" font-size="16" font-family="sans-serif" font-weight="700">${ini}</text>
     </svg>`)}`;
}

function fmtFecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
}
function fmtTamano(bytes) {
  if (!bytes) return '0 B';
  if (bytes >= 1048576) return (bytes/1048576).toFixed(1) + ' MB';
  if (bytes >= 1024)    return Math.round(bytes/1024) + ' KB';
  return bytes + ' B';
}
function tieneRol(roles) { return roles.includes(_usuario?.rol); }

function toast(msg, tipo = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.innerHTML = `<i class="fa-solid fa-${tipo==='ok'?'circle-check':tipo==='err'?'circle-xmark':'circle-info'}"></i> ${xss(msg)}`;
  document.getElementById('toastWrap')?.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// ── Navbar ────────────────────────────────────────────────────
function actualizarNavbar(p, session) {
  if (!p) return;
  const ava    = avatarUrl(p.avatar_url, p.nombre, p.apellido);
  const nombre = (p.nombre||'') + ' ' + (p.apellido||'');

  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('chipAvatar',     el => el.src = ava);
  set('chipNombre',     el => el.textContent = nombre);
  set('chipRol',        el => el.textContent = p.rol);
  set('chipMenuAvatar', el => el.src = ava);
  set('chipMenuNombre', el => el.textContent = nombre);
  set('chipMenuEmail',  el => el.textContent = session?.user?.email || '');
  set('chipMenuRol',    el => { el.textContent = p.rol; el.className = `rol-badge rol-${p.rol}`; });

  if (ROLES.puedeSubir.includes(p.rol)) {
    set('navSubir',    el => el.style.display = '');
    set('mobileSubir', el => el.style.display = 'block');
  }
  if (ROLES.puedeAdmin.includes(p.rol)) {
    set('navAdmin',    el => el.style.display = '');
    set('mobileAdmin', el => el.style.display = 'block');
  }
}

// ── Menús ─────────────────────────────────────────────────────
function toggleMobileMenu() {
  const m = document.getElementById('mobileMenu');
  if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
function closeMobileMenu() {
  const m = document.getElementById('mobileMenu');
  if (m) m.style.display = 'none';
}

function toggleMusicPanel() {
  const panel = document.getElementById('musicPanel');
  if (!panel) return;
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  if (window.innerWidth < 640) {
    Object.assign(panel.style, { position:'fixed', left:'50%', transform:'translateX(-50%)',
      top:'58px', right:'auto', width:'94vw', maxWidth:'340px' });
  } else {
    Object.assign(panel.style, { position:'absolute', right:'0', top:'calc(100% + .4rem)',
      left:'auto', transform:'', width:'320px', maxWidth:'' });
  }
  MusicPlayer.openPanel();
}
function closeMusicPanel() {
  const p = document.getElementById('musicPanel');
  if (p) p.style.display = 'none';
}

function toggleChipMenu() {
  const m = document.getElementById('chipMenu');
  if (!m) return;
  const open = m.style.display !== 'none';
  m.style.display = open ? 'none' : 'block';
  const arrow = document.getElementById('chipArrow');
  if (arrow) arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
}
function closeChipMenu() {
  const m = document.getElementById('chipMenu');
  if (m) m.style.display = 'none';
  const arrow = document.getElementById('chipArrow');
  if (arrow) arrow.style.transform = 'rotate(0deg)';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#musicWrapper')) closeMusicPanel();
  if (!e.target.closest('#chipWrapper'))  closeChipMenu();
  if (!e.target.closest('#appNav'))       closeMobileMenu();
});
document.addEventListener('mouseover', e => {
  if (e.target.closest('.chip-item')) e.target.closest('.chip-item').style.background = 'rgba(26,92,173,.07)';
});
document.addEventListener('mouseout', e => {
  if (e.target.closest('.chip-item')) e.target.closest('.chip-item').style.background = 'transparent';
});

// ── Llamadas ──────────────────────────────────────────────────
let _llamadaActual = null;

function startGlobalPolling() {
  const ch = sb.channel('invitaciones-' + _authUser.id);
  ch.on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'salas_invitaciones',
    filter: `usuario_id=eq.${_authUser.id}`,
  }, async payload => {
    const { data: sala } = await sb.from('salas_voz')
      .select('*,perfiles(nombre,apellido)').eq('id', payload.new.sala_id).single();
    if (!sala?.activa || _llamadaActual?.id === sala.id) return;
    _llamadaActual = sala;
    mostrarAvisoDeLlamada(sala);
  }).subscribe();

  setInterval(async () => {
    if (!_authUser) return;
    const { count } = await sb.from('mensajes')
      .select('id', { count:'exact', head:true })
      .eq('destinatario_id', _authUser.id).eq('leido', false);
    const b = document.getElementById('badgeSinLeer');
    if (b) { b.textContent = count||''; b.style.display = count > 0 ? 'flex' : 'none'; }
  }, 8000);
}

function mostrarAvisoDeLlamada(sala) {
  const modal = document.getElementById('modalLlamada');
  if (!modal) return;
  document.getElementById('llamadaNombre').textContent = (sala.perfiles?.nombre||'Alguien') + ' te llama';
  document.getElementById('llamadaTipo').textContent   = sala.tipo==='video' ? '📹 Videollamada' : '🎙️ Voz';
  document.getElementById('llamadaIcono').className    = sala.tipo==='video' ? 'fa-solid fa-video' : 'fa-solid fa-phone fa-beat';
  const btn = document.getElementById('btnAceptarLlamada');
  btn.dataset.salaId = sala.id; btn.dataset.salaNombre = sala.nombre;
  modal.style.display = 'flex';
  clearTimeout(window._llamadaTO);
  window._llamadaTO = setTimeout(rechazarLlamada, 30000);
}

window.aceptarLlamada = async () => {
  const btn = document.getElementById('btnAceptarLlamada');
  const id  = btn?.dataset.salaId;
  const nom = btn?.dataset.salaNombre || 'Sala';
  rechazarLlamada();
  if (id) {
    await sb.from('salas_participantes').upsert({ sala_id: parseInt(id), usuario_id: _authUser.id });
    window.open(`${APP.baseUrl}/sala?id=${id}&nombre=${encodeURIComponent(nom)}`, `sala_${id}`, 'width=900,height=700');
  }
};
window.rechazarLlamada = function() {
  const m = document.getElementById('modalLlamada');
  if (m) m.style.display = 'none';
  clearTimeout(window._llamadaTO);
  _llamadaActual = null;
};

// ── Inicialización — UN SOLO onAuthStateChange ────────────────
let _pollingStarted = false;

sb.auth.onAuthStateChange(async (event, session) => {
  _authUser = session?.user || null;

  if (_authUser) {
    _usuario = await cargarPerfil(_authUser.id);
    if (_usuario?.tema) setTema(_usuario.tema);
    actualizarNavbar(_usuario, session);
    MusicPlayer.init();
    if (!_pollingStarted) { _pollingStarted = true; startGlobalPolling(); }
  } else {
    _usuario = null;
    _pollingStarted = false;
  }

  renderPage(getRoute());
});
