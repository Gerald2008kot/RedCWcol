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
  // Guardar en DB si hay usuario
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
  // Iniciales como fallback — genera SVG data-URI
  const ini = ((nombre||'?')[0] + (apellido||'')[0]).toUpperCase();
  const colors = ['#1a5cad','#1e7e34','#c47a00','#8e44ad','#c0392b'];
  const bg     = colors[(ini.charCodeAt(0) + ini.charCodeAt(1)) % colors.length];
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

// ── Inicialización ────────────────────────────────────────────
sb.auth.onAuthStateChange(async (event, session) => {
  _authUser = session?.user || null;
  if (_authUser) {
    _usuario = await cargarPerfil(_authUser.id);
    // Aplicar tema guardado en DB
    if (_usuario?.tema) setTema(_usuario.tema);
  }
  renderPage(getRoute());
});
