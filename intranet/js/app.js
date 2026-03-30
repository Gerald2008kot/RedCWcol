// ============================================================
//  INTRANET REDCW — Core App (Auth + Router + Global State)
// ============================================================

// ── Inicializar Supabase ─────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 10 } }
});

// ── Estado global ────────────────────────────────────────────
let _usuario   = null;   // perfil completo del usuario actual
let _authUser  = null;   // objeto auth de Supabase

// ── Tema ─────────────────────────────────────────────────────
(function aplicarTemaInicial() {
  const guardado = localStorage.getItem('redcw_tema') || 'system';
  const html     = document.documentElement;
  if (guardado === 'light') html.setAttribute('data-theme', 'light');
  else if (guardado === 'dark') html.setAttribute('data-theme', 'dark');
  else html.removeAttribute('data-theme');
})();

function setTema(tema) {
  const html = document.documentElement;
  if (tema === 'light')  html.setAttribute('data-theme', 'light');
  else if (tema === 'dark') html.setAttribute('data-theme', 'dark');
  else html.removeAttribute('data-theme');
  localStorage.setItem('redcw_tema', tema);
  if (_usuario) {
    sb.from('perfiles').update({ tema }).eq('id', _usuario.id).then(() => {});
  }
}

function toggleTema() {
  const actual = document.documentElement.getAttribute('data-theme') || 'system';
  const siguiente = actual === 'system' ? 'light' : actual === 'light' ? 'dark' : 'system';
  setTema(siguiente);
  const icon = document.getElementById('iconTema');
  if (icon) icon.className = siguiente === 'light' ? 'fa-solid fa-sun'
                           : siguiente === 'dark'  ? 'fa-solid fa-moon'
                           : 'fa-solid fa-circle-half-stroke';
}

// ── Router SPA ───────────────────────────────────────────────
const ROUTES = {
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
  const path = window.location.pathname;
  return ROUTES[path] || 'dashboard';
}

function navigate(path) {
  window.history.pushState({}, '', path);
  renderPage(getRoute());
}

window.addEventListener('popstate', () => renderPage(getRoute()));

// ── Renderizar página ─────────────────────────────────────────
async function renderPage(page) {
  const app = document.getElementById('app');
  if (!app) return;

  // Redirigir al login si no autenticado
  if (!_authUser && page !== 'login') {
    renderLogin();
    return;
  }
  if (_authUser && page === 'login') {
    navigate('/dashboard');
    return;
  }

  // Mostrar/ocultar shell (navbar + footer) según página
  const shell = document.getElementById('appShell');
  if (shell) {
    if (page === 'login') shell.classList.add('no-shell');
    else shell.classList.remove('no-shell');
  }

  // Marcar nav activo
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  // Destruir canales Realtime previos
  if (window._activeChannel) {
    sb.removeChannel(window._activeChannel);
    window._activeChannel = null;
  }

  // Cargar página
  app.innerHTML = '<div class="page-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';

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
}

// ── Auth ─────────────────────────────────────────────────────
async function cargarPerfil(userId) {
  const { data } = await sb.from('perfiles').select('*').eq('id', userId).single();
  return data;
}

async function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  await sb.auth.signOut();
  _usuario  = null;
  _authUser = null;
  navigate('/login');
}

// ── Helpers ──────────────────────────────────────────────────
function xss(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function avatarUrl(url, nombre, apellido) {
  if (url && url.includes('cloudinary')) return url;
  if (url && url.startsWith('http')) return url;
  const ini = ((nombre||'?')[0] + (apellido||'')[0]).toUpperCase();
  const colors = ['#1a5cad','#1e7e34','#c47a00','#8e44ad','#c0392b'];
  const bg     = colors[(ini.charCodeAt(0) + (ini.charCodeAt(1)||0)) % colors.length];
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
     <rect width="40" height="40" rx="20" fill="${bg}"/>
     <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
           fill="white" font-size="16" font-family="sans-serif" font-weight="700">${ini}</text>
     </svg>`
  )}`;
}

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' });
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

function tieneRol(roles) {
  return roles.includes(_usuario?.rol);
}

function toast(msg, tipo = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.innerHTML = `<i class="fa-solid fa-${tipo==='ok'?'circle-check':tipo==='err'?'circle-xmark':'circle-info'}"></i> ${xss(msg)}`;
  document.getElementById('toastWrap')?.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// ── Actualizar navbar con datos del usuario ──────────────────
function actualizarNavbar(p, session) {
  if (!p) return;
  const ava    = avatarUrl(p.avatar_url, p.nombre, p.apellido);
  const nombre = p.nombre + ' ' + p.apellido;

  const chipAvatar     = document.getElementById('chipAvatar');
  const chipNombre     = document.getElementById('chipNombre');
  const chipRol        = document.getElementById('chipRol');
  const chipMenuAvatar = document.getElementById('chipMenuAvatar');
  const chipMenuNombre = document.getElementById('chipMenuNombre');
  const chipMenuEmail  = document.getElementById('chipMenuEmail');
  const rolBadge       = document.getElementById('chipMenuRol');

  if (chipAvatar)     chipAvatar.src             = ava;
  if (chipNombre)     chipNombre.textContent      = nombre;
  if (chipRol)        chipRol.textContent         = p.rol;
  if (chipMenuAvatar) chipMenuAvatar.src          = ava;
  if (chipMenuNombre) chipMenuNombre.textContent  = nombre;
  if (chipMenuEmail)  chipMenuEmail.textContent   = session?.user?.email || '';
  if (rolBadge)       { rolBadge.textContent = p.rol; rolBadge.className = `rol-badge rol-${p.rol}`; }

  // Mostrar enlaces según rol
  if (ROLES.puedeSubir.includes(p.rol)) {
    const navSubir    = document.getElementById('navSubir');
    const mobileSubir = document.getElementById('mobileSubir');
    if (navSubir)    navSubir.style.display    = '';
    if (mobileSubir) mobileSubir.style.display = 'block';
  }
  if (ROLES.puedeAdmin.includes(p.rol)) {
    const navAdmin    = document.getElementById('navAdmin');
    const mobileAdmin = document.getElementById('mobileAdmin');
    if (navAdmin)    navAdmin.style.display    = '';
    if (mobileAdmin) mobileAdmin.style.display = 'block';
  }
}

// ── Hamburguesa ──────────────────────────────────────────────
function toggleMobileMenu() {
  const m = document.getElementById('mobileMenu');
  if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
function closeMobileMenu() {
  const m = document.getElementById('mobileMenu');
  if (m) m.style.display = 'none';
}

// ── Music panel ───────────────────────────────────────────────
function toggleMusicPanel() {
  const panel = document.getElementById('musicPanel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  if (open) { panel.style.display = 'none'; return; }

  const btn  = document.getElementById('btnMusica');
  const rect = btn.getBoundingClientRect();
  panel.style.display = 'block';
  if (window.innerWidth < 640) {
    panel.style.position  = 'fixed';
    panel.style.left      = '50%';
    panel.style.transform = 'translateX(-50%)';
    panel.style.top       = '58px';
    panel.style.right     = 'auto';
    panel.style.width     = '94vw';
    panel.style.maxWidth  = '340px';
  } else {
    panel.style.position  = 'absolute';
    panel.style.right     = '0';
    panel.style.top       = 'calc(100% + .4rem)';
    panel.style.left      = 'auto';
    panel.style.transform = '';
    panel.style.width     = '320px';
    panel.style.maxWidth  = '';
  }
  MusicPlayer.openPanel();
}
function closeMusicPanel() {
  const p = document.getElementById('musicPanel');
  if (p) p.style.display = 'none';
}

// ── Chip menu ─────────────────────────────────────────────────
function toggleChipMenu() {
  const m = document.getElementById('chipMenu');
  if (!m) return;
  const open = m.style.display !== 'none';
  m.style.display = open ? 'none' : 'block';
  const arrow = document.getElementById('chipArrow');
  if (arrow) arrow.style.transform = open ? 'rotate(0)' : 'rotate(180deg)';
}
function closeChipMenu() {
  const m = document.getElementById('chipMenu');
  if (m) m.style.display = 'none';
  const arrow = document.getElementById('chipArrow');
  if (arrow) arrow.style.transform = 'rotate(0)';
}

// Cerrar dropdowns al click fuera
document.addEventListener('click', e => {
  if (!e.target.closest('#musicWrapper')) closeMusicPanel();
  if (!e.target.closest('#chipWrapper'))  closeChipMenu();
  if (!e.target.closest('#appNav'))       closeMobileMenu();
});

// Hover chip menu items
document.addEventListener('mouseover', e => {
  if (e.target.closest('.chip-item')) e.target.closest('.chip-item').style.background = 'rgba(26,92,173,.07)';
});
document.addEventListener('mouseout', e => {
  if (e.target.closest('.chip-item')) e.target.closest('.chip-item').style.background = 'transparent';
});

// ── Polling global: badge sin leer + llamadas ────────────────
let _llamadaActual = null;

function startGlobalPolling() {
  // Realtime para invitaciones de llamada
  const ch = sb.channel('invitaciones-' + _authUser?.id);
  ch.on('postgres_changes', {
    event:  'INSERT',
    schema: 'public',
    table:  'salas_invitaciones',
    filter: `usuario_id=eq.${_authUser?.id}`,
  }, async payload => {
    const inv = payload.new;
    const { data: sala } = await sb.from('salas_voz')
      .select('*,perfiles(nombre,apellido)').eq('id', inv.sala_id).single();
    if (!sala || !sala.activa) return;
    if (_llamadaActual?.id === sala.id) return;
    _llamadaActual = sala;
    mostrarAvisoDeLlamada(sala);
  }).subscribe();

  // Badge sin leer
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
  const modal  = document.getElementById('modalLlamada');
  const nombre = document.getElementById('llamadaNombre');
  const tipo   = document.getElementById('llamadaTipo');
  const icono  = document.getElementById('llamadaIcono');
  const btnAce = document.getElementById('btnAceptarLlamada');
  if (!modal) return;
  nombre.textContent = (sala.perfiles?.nombre||'Alguien') + ' te está llamando';
  tipo.textContent   = sala.tipo==='video' ? '📹 Videollamada' : '🎙️ Llamada de voz';
  icono.className    = sala.tipo==='video' ? 'fa-solid fa-video' : 'fa-solid fa-phone fa-beat';
  btnAce.dataset.salaId    = sala.id;
  btnAce.dataset.salaNombre = sala.nombre;
  modal.style.display = 'flex';
  clearTimeout(window._llamadaTO);
  window._llamadaTO = setTimeout(() => rechazarLlamada(), 30000);
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
  document.getElementById('modalLlamada').style.display = 'none';
  clearTimeout(window._llamadaTO);
  _llamadaActual = null;
};

// ── Inicialización ────────────────────────────────────────────
// UN SOLO onAuthStateChange centralizado aquí; el script inline
// del index.html fue eliminado para evitar doble ejecución.
sb.auth.onAuthStateChange(async (event, session) => {
  _authUser = session?.user || null;

  if (_authUser) {
    _usuario = await cargarPerfil(_authUser.id);
    if (_usuario?.tema) setTema(_usuario.tema);
    actualizarNavbar(_usuario, session);
    MusicPlayer.init();
    startGlobalPolling();
  }

  renderPage(getRoute());
});
