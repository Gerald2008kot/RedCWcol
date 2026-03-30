// ============================================================
//  INTRANET REDCW — Páginas
// ============================================================

// ══════════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════════
function renderLogin() {
  const app = document.getElementById('app');
  document.querySelector('.app-shell')?.classList.add('no-shell');
  app.innerHTML = `
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo"><i class="fa-solid fa-building-columns"></i></div>
      <h4 class="fw-700 text-center mb-1">${APP.nombre}</h4>
      <p class="text-center text-muted mb-4" style="font-size:.85rem">Portal Interno Corporativo</p>

      <div id="loginErr" class="alert-intra alert-danger mb-3" style="display:none"></div>

      <form id="loginForm">
        <label class="form-label">Correo electrónico</label>
        <input type="email" id="loginEmail" class="form-control mb-3"
               placeholder="usuario@empresa.com" required autocomplete="email">
        <label class="form-label">Contraseña</label>
        <div class="input-group mb-4">
          <input type="password" id="loginPass" class="form-control"
                 placeholder="••••••••" required>
          <button type="button" class="btn btn-intra-outline"
                  onclick="const i=document.getElementById('loginPass');i.type=i.type==='password'?'text':'password'">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>
        <button type="submit" class="btn btn-intra w-100 py-2" id="btnLogin">
          <i class="fa-solid fa-right-to-bracket me-2"></i>Iniciar Sesión
        </button>
      </form>
    </div>
  </div>`;

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const err = document.getElementById('loginErr');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Entrando...';
    err.style.display = 'none';

    const { error } = await sb.auth.signInWithPassword({
      email:    document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPass').value,
    });

    if (error) {
      err.textContent = 'Credenciales incorrectas. Verifica tu email y contraseña.';
      err.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-2"></i>Iniciar Sesión';
    }
    // Si ok → onAuthStateChange navega automáticamente
  });
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
async function renderDashboard() {
  document.querySelector('.app-shell')?.classList.remove('no-shell');
  const app = document.getElementById('app');

  const [archRes, usrRes, msgRes, descRes, anuncRes, recRes] = await Promise.all([
    sb.from('archivos').select('id', { count:'exact', head:true }).eq('activo', true),
    sb.from('perfiles').select('id', { count:'exact', head:true }).eq('activo', true),
    sb.from('mensajes').select('id', { count:'exact', head:true }).is('destinatario_id', null),
    sb.from('archivos').select('descargas').eq('activo', true),
    sb.from('anuncios').select('*,perfiles(nombre,apellido,avatar_url)').eq('activo', true)
       .order('fijado', { ascending: false }).order('created_at', { ascending: false }).limit(4),
    sb.from('archivos').select('*,perfiles(nombre,apellido)').eq('activo', true)
       .order('created_at', { ascending: false }).limit(6),
  ]);

  const totalDescargas = (descRes.data || []).reduce((s, r) => s + (r.descargas || 0), 0);
  const sinLeer = await sb.from('mensajes').select('id', { count:'exact', head:true })
    .eq('destinatario_id', _usuario.id).eq('leido', false);

  app.innerHTML = `
  <div class="container-fluid px-3 px-md-4 fade-in">

    <div class="page-header mb-4">
      <h4 class="fw-700 mb-0">
        <i class="fa-solid fa-gauge-high me-2 text-accent"></i>Dashboard
      </h4>
      <small class="text-muted">Buenos días, ${xss(_usuario.nombre)}</small>
    </div>

    <!-- Stats -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <a href="#" onclick="navigate('/biblioteca');return false" class="stat-card stat-card-link">
          <div class="stat-icon teal"><i class="fa-solid fa-folder-open"></i></div>
          <div><div class="stat-value">${archRes.count||0}</div>
          <div class="stat-label">Archivos</div></div>
        </a>
      </div>
      <div class="col-6 col-md-3">
        <a href="#" onclick="navigate('/chat');return false" class="stat-card stat-card-link">
          <div class="stat-icon blue" style="position:relative">
            <i class="fa-solid fa-comments"></i>
            ${(sinLeer.count||0) > 0 ? `<span class="notif-dot">${sinLeer.count}</span>` : ''}
          </div>
          <div><div class="stat-value">${msgRes.count||0}</div>
          <div class="stat-label">Mensajes públicos</div></div>
        </a>
      </div>
      <div class="col-6 col-md-3">
        <div class="stat-card">
          <div class="stat-icon amber"><i class="fa-solid fa-users"></i></div>
          <div><div class="stat-value">${usrRes.count||0}</div>
          <div class="stat-label">Usuarios activos</div></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="stat-card">
          <div class="stat-icon green"><i class="fa-solid fa-download"></i></div>
          <div><div class="stat-value">${totalDescargas}</div>
          <div class="stat-label">Descargas</div></div>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <!-- Accesos rápidos -->
      <div class="col-lg-8">
        <div class="intra-card mb-4">
          <div class="card-header"><i class="fa-solid fa-grip"></i> Accesos Rápidos</div>
          <div class="card-body">
            <div class="tile-grid">
              <a href="#" onclick="navigate('/biblioteca');return false" class="tile">
                <i class="fa-solid fa-folder-open"></i><span>Biblioteca</span>
              </a>
              <a href="#" onclick="navigate('/chat');return false" class="tile">
                <i class="fa-solid fa-comments"></i><span>Chat</span>
                ${(sinLeer.count||0)>0?`<span class="tile-badge">${sinLeer.count}</span>`:''}
              </a>
              ${tieneRol(ROLES.puedeSubir) ? `
              <a href="#" onclick="navigate('/upload');return false" class="tile">
                <i class="fa-solid fa-cloud-arrow-up"></i><span>Subir</span>
              </a>` : ''}
              <a href="#" onclick="navigate('/encuestas');return false" class="tile">
                <i class="fa-solid fa-chart-bar"></i><span>Encuestas</span>
              </a>
              <a href="#" onclick="navigate('/llamadas');return false" class="tile">
                <i class="fa-solid fa-phone-volume"></i><span>Llamadas</span>
              </a>
              <a href="#" onclick="navigate('/perfil');return false" class="tile">
                <i class="fa-solid fa-circle-user"></i><span>Mi Perfil</span>
              </a>
              ${tieneRol(ROLES.puedeAdmin) ? `
              <a href="#" onclick="navigate('/admin');return false" class="tile">
                <i class="fa-solid fa-shield-halved"></i><span>Admin</span>
              </a>` : ''}
            </div>
          </div>
        </div>

        <!-- Archivos recientes -->
        <div class="intra-card">
          <div class="card-header">
            <i class="fa-solid fa-clock-rotate-left"></i> Archivos Recientes
            <a href="#" onclick="navigate('/biblioteca');return false"
               class="btn btn-intra-outline btn-sm ms-auto" style="font-size:.72rem">Ver todos</a>
          </div>
          <div class="table-responsive">
            <table class="intra-table">
              <thead><tr><th>Título</th><th>Tipo</th><th>Tamaño</th><th>Fecha</th></tr></thead>
              <tbody>
              ${(recRes.data||[]).map(f => `
              <tr>
                <td style="font-weight:600;font-size:.84rem">${xss(f.titulo)}</td>
                <td><span class="carpeta-badge carpeta-${xss(f.carpeta)}">${xss(f.carpeta)}</span></td>
                <td style="font-size:.76rem;color:var(--text-muted)">${fmtTamano(f.tamano)}</td>
                <td style="font-size:.73rem;color:var(--text-muted)">${fmtFecha(f.created_at)}</td>
              </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Sin archivos aún</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Anuncios -->
      <div class="col-lg-4">
        <div class="intra-card">
          <div class="card-header"><i class="fa-solid fa-bullhorn"></i> Anuncios</div>
          <div class="card-body d-flex flex-column gap-3">
            ${(anuncRes.data||[]).length ? (anuncRes.data||[]).map(a => `
            <div class="anuncio-card ${a.fijado?'fijado':''}">
              ${a.fijado ? '<span style="font-size:.65rem;color:var(--warning);font-weight:700"><i class="fa-solid fa-thumbtack me-1"></i>FIJADO</span>' : ''}
              <div class="fw-600 mb-1" style="font-size:.88rem">${xss(a.titulo)}</div>
              <div style="font-size:.8rem;color:var(--text-muted)">${xss(a.contenido.substring(0,120))}${a.contenido.length>120?'...':''}</div>
              <div style="font-size:.7rem;color:var(--text-dim);margin-top:.35rem">
                ${xss(a.perfiles?.nombre||'')} · ${fmtFecha(a.created_at)}
              </div>
            </div>`) .join('') : '<p class="text-center text-muted py-3 mb-0">Sin anuncios.</p>'}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════════
async function renderChat() {
  const app = document.getElementById('app');
  const params   = new URLSearchParams(window.location.search);
  const privadoId = params.get('privado') || null;
  const grupoId   = params.get('grupo')   || null;

  // Cargar datos iniciales en paralelo
  const [histRes, usrsRes, gruposRes] = await Promise.all([
    privadoId
      ? sb.from('mensajes').select('*,perfiles(nombre,apellido,avatar_url)')
          .or(`and(usuario_id.eq.${_usuario.id},destinatario_id.eq.${privadoId}),and(usuario_id.eq.${privadoId},destinatario_id.eq.${_usuario.id})`)
          .order('id', { ascending: false }).limit(60)
      : grupoId
        ? sb.from('mensajes').select('*,perfiles(nombre,apellido,avatar_url)')
            .eq('grupo_id', grupoId).order('id', { ascending: false }).limit(60)
        : sb.from('mensajes').select('*,perfiles(nombre,apellido,avatar_url)')
            .is('destinatario_id', null).is('grupo_id', null)
            .order('id', { ascending: false }).limit(60),
    sb.from('perfiles').select('id,nombre,apellido,avatar_url,departamento').eq('activo', true).order('nombre'),
    sb.from('grupos').select('*,grupos_miembros!inner(usuario_id)')
      .eq('grupos_miembros.usuario_id', _usuario.id).eq('activo', true),
  ]);

  const historial  = (histRes.data || []).reverse();
  const ultimoId   = historial.length ? historial[historial.length-1].id : 0;
  let   lastId     = ultimoId;

  // Título del chat
  let chatTitulo = 'Muro Corporativo';
  if (privadoId) {
    const u = (usrsRes.data||[]).find(u => u.id === privadoId);
    chatTitulo = u ? `Chat con ${u.nombre} ${u.apellido}` : 'Chat privado';
  } else if (grupoId) {
    const g = (gruposRes.data||[]).find(g => String(g.id) === grupoId);
    chatTitulo = g ? `Grupo: ${g.nombre}` : 'Grupo';
  }

  function msgHtml(m) {
    const esMio = m.usuario_id === _usuario.id;
    const p     = m.perfiles || {};
    const hora  = fmtHora(m.created_at);
    const ava   = avatarUrl(p.avatar_url, p.nombre, p.apellido);
    return `<div class="msg-bubble ${esMio?'mine':''}" id="msg-${m.id}">
      <div class="msg-avatar"><img src="${ava}" width="30" height="30" alt=""
           style="width:30px;height:30px;max-width:30px;max-height:30px;object-fit:cover;border-radius:50%;display:block"></div>
      <div class="msg-body">
        <div class="msg-name">${xss((p.nombre||'')+ ' '+(p.apellido||''))}</div>
        <div class="msg-text">${xss(m.contenido).replace(/\n/g,'<br>')}</div>
        <div class="msg-time">${hora}</div>
      </div>
    </div>`;
  }

  app.innerHTML = `
  <div class="container-fluid px-3 px-md-4 fade-in" style="height:calc(100vh - 72px)">
    <div class="row g-3 h-100">

      <!-- Chat principal -->
      <div class="col-lg-8 d-flex flex-column" style="height:100%">
        <div class="intra-card d-flex flex-column flex-fill" style="min-height:0">
          <div class="card-header">
            <i class="fa-solid fa-${privadoId?'lock':grupoId?'users':'globe'}"></i>
            ${xss(chatTitulo)}
            ${privadoId || grupoId ? `
            <a href="#" onclick="navigate('/chat');return false"
               class="btn btn-sm btn-intra-outline ms-auto" style="font-size:.72rem">
              <i class="fa-solid fa-arrow-left me-1"></i>Muro
            </a>` : ''}
          </div>
          <div class="chat-wall flex-fill" id="chatWall" style="overflow-y:auto;padding:.75rem">
            ${historial.map(msgHtml).join('') ||
              '<div class="text-center text-muted py-5"><i class="fa-solid fa-comment-slash fa-2x d-block mb-2" style="color:var(--text-dim)"></i>¡Sé el primero en escribir!</div>'}
          </div>
          <div class="p-3" style="border-top:1px solid var(--border)">
            <div class="d-flex gap-2">
              <input type="text" id="msgInput" class="form-control"
                     placeholder="${privadoId?'Mensaje privado...':grupoId?'Mensaje al grupo...':'Escribe en el muro...'}"
                     autocomplete="off">
              <button onclick="enviarMensajeChat()" class="btn btn-intra px-3" id="btnEnviar">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="col-lg-4 d-flex flex-column gap-3" style="overflow-y:auto;max-height:100%">

        <!-- Mis grupos -->
        ${(gruposRes.data||[]).length ? `
        <div class="intra-card">
          <div class="card-header"><i class="fa-solid fa-users"></i> Mis Grupos</div>
          <div class="card-body p-0">
            ${(gruposRes.data||[]).map(g => `
            <a href="#" onclick="navigate('/chat?grupo=${g.id}');return false"
               class="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
               style="border-bottom:1px solid var(--border);color:var(--text-main);${grupoId===String(g.id)?'background:var(--accent-soft)':''}">
              <div style="width:32px;height:32px;border-radius:8px;background:var(--accent-soft);
                          display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="fa-solid fa-users" style="font-size:.8rem;color:var(--accent)"></i>
              </div>
              <div style="font-size:.83rem;font-weight:600">${xss(g.nombre)}</div>
            </a>`).join('')}
          </div>
        </div>` : ''}

        <!-- Mensajes privados -->
        <div class="intra-card flex-fill">
          <div class="card-header"><i class="fa-solid fa-lock"></i> Mensajes Privados</div>
          <div class="card-body p-0" style="max-height:400px;overflow-y:auto" id="listaPrivados">
            ${(usrsRes.data||[]).filter(u => u.id !== _usuario.id).map(u => `
            <a href="#" onclick="navigate('/chat?privado=${u.id}');return false"
               class="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
               style="border-bottom:1px solid var(--border);color:var(--text-main);${privadoId===u.id?'background:var(--accent-soft)':''}">
              <img src="${avatarUrl(u.avatar_url, u.nombre, u.apellido)}"
                   width="34" height="34"
                   style="width:34px;height:34px;max-width:34px;max-height:34px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">
              <div>
                <div style="font-size:.83rem;font-weight:600">${xss(u.nombre)} ${xss(u.apellido)}</div>
                <div style="font-size:.7rem;color:var(--text-muted)">${xss(u.departamento||'—')}</div>
              </div>
            </a>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;

  // Scroll al fondo
  const wall = document.getElementById('chatWall');
  if (wall) wall.scrollTop = wall.scrollHeight;

  // Marcar privados como leídos
  if (privadoId) {
    sb.from('mensajes').update({ leido: true })
      .eq('usuario_id', privadoId).eq('destinatario_id', _usuario.id).eq('leido', false)
      .then(() => {});
  }

  // Enviar mensaje
  window.enviarMensajeChat = async () => {
    const input = document.getElementById('msgInput');
    const texto = input?.value.trim();
    if (!texto) return;
    input.value = '';
    const btn = document.getElementById('btnEnviar');
    if (btn) btn.disabled = true;

    const payload = {
      usuario_id:       _usuario.id,
      contenido:        texto,
      destinatario_id:  privadoId || null,
      grupo_id:         grupoId   ? parseInt(grupoId) : null,
    };

    const { error } = await sb.from('mensajes').insert(payload);
    if (error) toast('Error al enviar mensaje', 'err');
    if (btn) btn.disabled = false;
    if (input) input.focus();
  };

  // Enter para enviar
  document.getElementById('msgInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeChat(); }
  });

  // ── Supabase Realtime para mensajes nuevos ────────────────
  let filter = 'destinatario_id=is.null,grupo_id=is.null';
  if (privadoId)  filter = `or(and(usuario_id=eq.${_usuario.id},destinatario_id=eq.${privadoId}),and(usuario_id=eq.${privadoId},destinatario_id=eq.${_usuario.id}))`;
  else if (grupoId) filter = `grupo_id=eq.${grupoId}`;

  const ch = sb.channel(`chat-${privadoId||grupoId||'muro'}`);
  ch.on('postgres_changes', {
    event:  'INSERT',
    schema: 'public',
    table:  'mensajes',
  }, async payload => {
    const m = payload.new;
    if (document.getElementById(`msg-${m.id}`)) return;

    // Filtro local
    const esMuro    = !m.destinatario_id && !m.grupo_id && !privadoId && !grupoId;
    const esPrivado = privadoId && (
      (m.usuario_id===_usuario.id && m.destinatario_id===privadoId) ||
      (m.usuario_id===privadoId   && m.destinatario_id===_usuario.id)
    );
    const esGrupo   = grupoId && String(m.grupo_id) === grupoId;
    if (!esMuro && !esPrivado && !esGrupo) return;

    // Cargar perfil del autor
    const { data: autor } = await sb.from('perfiles')
      .select('nombre,apellido,avatar_url').eq('id', m.usuario_id).single();
    m.perfiles = autor;

    const atBottom = wall ? (wall.scrollHeight - wall.scrollTop - wall.clientHeight) < 80 : false;
    wall?.insertAdjacentHTML('beforeend', msgHtml(m));
    lastId = Math.max(lastId, m.id);
    if (atBottom && wall) wall.scrollTop = wall.scrollHeight;

    // Marcar como leído si es privado para mí
    if (m.destinatario_id === _usuario.id) {
      sb.from('mensajes').update({ leido: true }).eq('id', m.id).then(() => {});
    }
  }).subscribe();

  window._activeChannel = ch;
}

// ══════════════════════════════════════════════════════════════
//  BIBLIOTECA
// ══════════════════════════════════════════════════════════════
async function renderBiblioteca() {
  const app = document.getElementById('app');
  const params  = new URLSearchParams(window.location.search);
  const carpeta = params.get('carpeta') || '';
  const buscar  = params.get('buscar')  || '';

  let query = sb.from('archivos').select('*,perfiles(nombre,apellido)')
    .eq('activo', true).order('created_at', { ascending: false });
  if (carpeta) query = query.eq('carpeta', carpeta);
  if (buscar)  query = query.ilike('titulo', `%${buscar}%`);

  const { data: archivos } = await query.limit(100);
  const { data: conteos }  = await sb.from('archivos')
    .select('carpeta').eq('activo', true);

  const cntMap = {};
  (conteos||[]).forEach(r => { cntMap[r.carpeta] = (cntMap[r.carpeta]||0)+1; });

  const iconos = {
    pdf:'fa-file-pdf pdf', doc:'fa-file-word word', docx:'fa-file-word word',
    xls:'fa-file-excel excel', xlsx:'fa-file-excel excel',
    mp3:'fa-file-audio audio', wav:'fa-file-audio audio', ogg:'fa-file-audio audio',
    m4a:'fa-file-audio audio', aac:'fa-file-audio audio',
    mp4:'fa-file-video video', webm:'fa-file-video video',
    png:'fa-file-image img', jpg:'fa-file-image img', jpeg:'fa-file-image img',
    gif:'fa-file-image img', webp:'fa-file-image img',
    zip:'fa-file-zipper zip', rar:'fa-file-zipper zip',
    txt:'fa-file-lines txt',
  };

  function iconoExt(ext) {
    const v = iconos[(ext||'').toLowerCase()] || 'fa-file other';
    const [ico, cls] = v.split(' ');
    return `<i class="fa-solid ${ico} file-icon ${cls||'other'}"></i>`;
  }

  app.innerHTML = `
  <div class="container-fluid px-3 px-md-4 fade-in">
    <div class="page-header mb-4">
      <h4 class="fw-700 mb-0"><i class="fa-solid fa-folder-open me-2 text-accent"></i>Biblioteca</h4>
    </div>

    <!-- Tabs carpetas -->
    <div class="carpeta-tabs mb-3">
      ${[['','fa-layer-group','Todos'], ['imagenes','fa-image','Imágenes'],
         ['musica','fa-music','Música'], ['videos','fa-video','Videos'],
         ['documentos','fa-file-lines','Documentos'], ['comprimidos','fa-file-zipper','Comprimidos'],
         ['otros','fa-folder','Otros']].map(([val, ico, label]) => `
      <a href="#" onclick="navigate('/biblioteca${val?'?carpeta='+val:''}');return false"
         class="carpeta-tab ${carpeta===val?'active':''}">
        <i class="fa-solid ${ico} me-1"></i>${label}
        <span class="tab-count">${val ? (cntMap[val]||0) : Object.values(cntMap).reduce((a,b)=>a+b,0)}</span>
      </a>`).join('')}
    </div>

    <!-- Buscador -->
    <div class="filter-bar mb-3">
      <div class="d-flex gap-2">
        <input type="text" id="biblioSearch" class="form-control"
               placeholder="Buscar por título..." value="${xss(buscar)}">
        <button class="btn btn-intra px-3"
                onclick="navigate('/biblioteca?carpeta=${carpeta}&buscar='+encodeURIComponent(document.getElementById('biblioSearch').value))">
          <i class="fa-solid fa-search"></i>
        </button>
        ${tieneRol(ROLES.puedeSubir) ? `
        <a href="#" onclick="navigate('/upload');return false" class="btn btn-intra px-3">
          <i class="fa-solid fa-upload me-1"></i>Subir
        </a>` : ''}
      </div>
    </div>

    <!-- Tabla -->
    <div class="intra-card">
      <div class="table-responsive">
        <table class="intra-table">
          <thead><tr>
            <th style="width:40px"></th><th>Título</th><th>Carpeta</th>
            <th>Tamaño</th><th>Subido por</th><th>Fecha</th><th>Acciones</th>
          </tr></thead>
          <tbody>
          ${(archivos||[]).length ? (archivos||[]).map(f => `
          <tr>
            <td>${iconoExt(f.extension)}</td>
            <td style="font-weight:600;font-size:.84rem">${xss(f.titulo)}</td>
            <td><span class="carpeta-badge carpeta-${xss(f.carpeta)}">${xss(f.carpeta)}</span></td>
            <td style="font-size:.76rem;color:var(--text-muted)">${fmtTamano(f.tamano)}</td>
            <td style="font-size:.78rem">${xss((f.perfiles?.nombre||'')+' '+(f.perfiles?.apellido||''))}</td>
            <td style="font-size:.73rem;color:var(--text-muted)">${fmtFecha(f.created_at)}</td>
            <td>
              <div class="d-flex gap-1">
                <a href="${xss(f.url_publica)}" target="_blank" class="btn btn-sm btn-intra-outline" title="Descargar">
                  <i class="fa-solid fa-download"></i>
                </a>
                ${f.carpeta==='musica'?`
                <button class="btn btn-sm" title="Reproducir"
                  style="background:rgba(125,60,255,.1);color:#7d3cff;border:1px solid rgba(125,60,255,.25)"
                  onclick="reproducirDesdeLibreria('${xss(f.url_publica)}','${xss(f.titulo)}','${xss(f.extension)}')">
                  <i class="fa-solid fa-play"></i>
                </button>`:''}
                ${tieneRol(ROLES.puedeAdmin)?`
                <button class="btn btn-sm btn-outline-danger-soft" title="Eliminar"
                  onclick="eliminarArchivo(${f.id})">
                  <i class="fa-solid fa-trash"></i>
                </button>`:''}
              </div>
            </td>
          </tr>`).join('') : `
          <tr><td colspan="7" class="text-center py-5 text-muted">
            <i class="fa-solid fa-folder-open fa-2x d-block mb-2" style="color:var(--text-dim)"></i>
            No hay archivos${buscar?' que coincidan con "'+xss(buscar)+'"':''}.
          </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  window.eliminarArchivo = async (id) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    await sb.from('archivos').update({ activo: false }).eq('id', id);
    toast('Archivo eliminado', 'ok');
    renderBiblioteca();
  };

  window.reproducirDesdeLibreria = (url, titulo, ext) => {
    if (window.reproducirEnPlayer) window.reproducirEnPlayer(url, titulo, ext, '');
    else toast('Abre el reproductor de música para escuchar', 'info');
  };
}

// ══════════════════════════════════════════════════════════════
//  SUBIR ARCHIVOS
// ══════════════════════════════════════════════════════════════
async function renderUpload() {
  if (!tieneRol(ROLES.puedeSubir)) { toast('Sin permiso para subir archivos','err'); navigate('/dashboard'); return; }
  const app = document.getElementById('app');

  app.innerHTML = `
  <div class="container-fluid px-3 px-md-4 fade-in">
    <div class="page-header mb-4">
      <h4 class="fw-700 mb-0"><i class="fa-solid fa-cloud-arrow-up me-2 text-accent"></i>Subir Archivos</h4>
      <span id="contadorCola" style="font-size:.8rem;color:var(--text-muted)"></span>
    </div>

    <div id="resultados" style="display:none" class="mb-4">
      <div class="intra-card">
        <div class="card-header">
          <i class="fa-solid fa-list-check"></i> Resultados
          <button onclick="document.getElementById('resultados').style.display='none'"
                  class="btn btn-intra-outline btn-sm ms-auto" style="font-size:.72rem">Limpiar</button>
        </div>
        <div id="listaResultados" style="padding:.35rem 0"></div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-lg-7">
        <div class="intra-card">
          <div class="card-header"><i class="fa-solid fa-upload"></i> Seleccionar Archivos</div>
          <div class="card-body">
            <div id="dropzoneArea" class="dropzone mb-3">
              <i class="fa-solid fa-cloud-arrow-up d-block mb-2"></i>
              <div class="fw-600 mb-1">Arrastra archivos aquí o toca para seleccionar</div>
              <small class="text-muted">MP3, WAV, MP4, PDF, DOC, XLS, PNG, ZIP y más</small>
              <input type="file" id="archivoInput" multiple class="d-none">
            </div>
            <div id="colaArchivos" style="display:none;margin-bottom:1rem">
              <div style="font-size:.8rem;font-weight:600;color:var(--text-muted);margin-bottom:.5rem">Archivos en cola:</div>
              <div id="listaArchivos" class="d-flex flex-column gap-2"></div>
            </div>
            <div id="metadatosPanel" style="display:none">
              <div class="row g-3 mt-1">
                <div class="col-md-6">
                  <label class="form-label">Departamento</label>
                  <input type="text" id="metaDept" class="form-control" placeholder="Ej: Recursos Humanos">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Categoría</label>
                  <select id="metaCat" class="form-select">
                    <option value="">— Sin categoría —</option>
                    <option>Manual</option><option>Reporte</option><option>Política</option>
                    <option>Audio / Podcast</option><option>Video</option><option>Otro</option>
                  </select>
                </div>
              </div>
              <button id="btnSubirTodo" onclick="subirTodo()" class="btn btn-intra w-100 mt-4 py-2">
                <i class="fa-solid fa-upload me-2"></i>Subir <span id="btnContador">0</span> archivo(s)
              </button>
              <div id="progresoGeneral" style="display:none;margin-top:1rem">
                <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.35rem">
                  Subiendo <span id="progActual">0</span> de <span id="progTotal">0</span>...
                </div>
                <div style="background:var(--bg-card2);border-radius:4px;height:8px;overflow:hidden">
                  <div id="progBar" style="height:100%;width:0;border-radius:4px;
                    background:linear-gradient(90deg,var(--primary),var(--primary-light));
                    transition:width .3s ease"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="intra-card">
          <div class="card-header"><i class="fa-solid fa-cloud"></i> Almacenamiento</div>
          <div class="card-body" style="font-size:.83rem;color:var(--text-muted);line-height:1.8">
            <div><i class="fa-solid fa-image me-2" style="color:#8e44ad"></i><strong>Imágenes:</strong> Cloudinary (PNG, JPG, GIF, WEBP)</div>
            <div><i class="fa-solid fa-music me-2" style="color:#7d3cff"></i><strong>Audio:</strong> Storj (MP3, WAV, OGG, M4A, AAC)</div>
            <div><i class="fa-solid fa-video me-2" style="color:#c0392b"></i><strong>Videos:</strong> Storj (MP4, WEBM)</div>
            <div><i class="fa-solid fa-file-lines me-2" style="color:var(--accent)"></i><strong>Documentos:</strong> Storj (PDF, DOC, XLS...)</div>
            <hr style="border-color:var(--border);margin:.75rem 0">
            <div style="font-size:.75rem;color:var(--text-dim)">
              <i class="fa-solid fa-weight-hanging me-1"></i>Límite: 500 MB por archivo
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  // Lógica de cola de archivos
  let cola = [], idCnt = 0;
  const zone  = document.getElementById('dropzoneArea');
  const input = document.getElementById('archivoInput');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) agregarArchivos(e.dataTransfer.files);
  });
  input.addEventListener('change', () => { if (input.files.length) agregarArchivos(input.files); input.value=''; });

  function agregarArchivos(files) {
    Array.from(files).forEach(f => {
      const titulo = f.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ');
      cola.push({ file:f, titulo, id:++idCnt });
    });
    renderCola();
  }

  function renderCola() {
    const lista = document.getElementById('listaArchivos');
    const colaD = document.getElementById('colaArchivos');
    const meta  = document.getElementById('metadatosPanel');
    const cnt   = document.getElementById('btnContador');
    const contador = document.getElementById('contadorCola');
    if (!cola.length) { colaD.style.display='none'; meta.style.display='none'; if(contador) contador.textContent=''; return; }
    colaD.style.display='block'; meta.style.display='block';
    if (cnt) cnt.textContent = cola.length;
    if (contador) contador.textContent = cola.length + ' archivo(s) en cola';
    lista.innerHTML = '';
    cola.forEach((item, idx) => {
      const ext = item.file.name.split('.').pop().toLowerCase();
      const div = document.createElement('div');
      div.className = 'file-item'; div.id = 'item_' + item.id;
      div.innerHTML = `
        <i class="fa-solid fa-file file-icon other" style="flex-shrink:0"></i>
        <input type="text" class="form-control file-item-title" placeholder="Título *"
               value="${item.titulo.replace(/"/g,'&quot;')}"
               oninput="cola_${idx}=this.value" style="font-size:.78rem;flex:1;min-width:0">
        <span style="font-size:.72rem;color:var(--text-muted);flex-shrink:0">${fmtTamano(item.file.size)}</span>
        <span id="st_${item.id}">
          <button onclick="window._quitarCola(${item.id})"
                  style="background:none;border:none;color:var(--danger);cursor:pointer;padding:2px 4px">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>`;
      // Actualizar título en cola
      div.querySelector('input').addEventListener('input', e => { cola[idx].titulo = e.target.value; });
      lista.appendChild(div);
    });
  }

  window._quitarCola = (id) => { cola = cola.filter(i => i.id !== id); renderCola(); };

  window.subirTodo = async () => {
    if (!cola.length) return;
    const sinTit = cola.filter(i => !i.titulo.trim());
    if (sinTit.length) { toast('Escribe el título para todos los archivos','err'); return; }

    const dept  = document.getElementById('metaDept')?.value || '';
    const cat   = document.getElementById('metaCat')?.value  || '';
    const total = cola.length;

    document.getElementById('btnSubirTodo').disabled = true;
    document.getElementById('progresoGeneral').style.display = 'block';
    document.getElementById('progTotal').textContent = total;
    document.getElementById('resultados').style.display = 'block';

    const snap = cola.slice();
    for (let i = 0; i < snap.length; i++) {
      const item  = snap[i];
      const rowEl = document.getElementById('item_' + item.id);
      const stEl  = document.getElementById('st_' + item.id);

      document.getElementById('progActual').textContent = i + 1;
      document.getElementById('progBar').style.width = Math.round(i/total*100) + '%';
      if (rowEl) rowEl.className = 'file-item subiendo';
      if (stEl)  stEl.innerHTML  = '<i class="fa-solid fa-spinner fa-spin" style="color:var(--accent)"></i>';

      try {
        const resultado = await subirArchivo(item.file, item.titulo, dept, cat);
        if (resultado.ok) {
          if (rowEl) rowEl.className = 'file-item ok';
          if (stEl)  stEl.innerHTML  = '<i class="fa-solid fa-circle-check" style="color:#1e7e34"></i>';
          addResult(resultado, true);
        } else {
          if (rowEl) rowEl.className = 'file-item error';
          if (stEl)  stEl.innerHTML  = '<i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i>';
          addResult({ titulo: item.titulo, error: resultado.error }, false);
        }
      } catch(e) {
        if (rowEl) rowEl.className = 'file-item error';
        if (stEl)  stEl.innerHTML  = '<i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i>';
        addResult({ titulo: item.titulo, error: 'Error de red.' }, false);
      }
    }

    document.getElementById('progBar').style.width = '100%';
    document.getElementById('progresoGeneral').style.display = 'none';
    document.getElementById('btnSubirTodo').disabled = false;
    const snapIds = snap.map(i => i.id);
    cola = cola.filter(i => !snapIds.includes(i.id));
    renderCola();
  };

  function addResult(d, ok) {
    const l   = document.getElementById('listaResultados');
    const div = document.createElement('div');
    div.style.cssText = 'padding:.4rem 1rem;border-bottom:1px solid var(--border);font-size:.82rem;display:flex;align-items:center;gap:.5rem';
    div.innerHTML = ok
      ? `<i class="fa-solid fa-circle-check" style="color:#1e7e34;flex-shrink:0"></i><span><strong>${xss(d.titulo)}</strong> → ${xss(d.carpeta)} · ${xss(d.ext)}</span>`
      : `<i class="fa-solid fa-circle-xmark" style="color:var(--danger);flex-shrink:0"></i><span><strong>${xss(d.titulo)}</strong> — ${xss(d.error)}</span>`;
    l.appendChild(div);
  }
}

// ── Subir archivo a Cloudinary o Storj via Supabase Edge Fn ──
async function subirArchivo(file, titulo, departamento, categoria) {
  const ext     = file.name.split('.').pop().toLowerCase();
  const carpeta = carpetaPorExt(ext);
  const esImagen = ['png','jpg','jpeg','gif','webp'].includes(ext);

  try {
    if (esImagen) {
      // Subir a Cloudinary directamente desde el navegador
      const fd = new FormData();
      fd.append('file',        file);
      fd.append('upload_preset', CLOUDINARY.preset);
      fd.append('folder',      'intranet-corp/imagenes');
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloud}/image/upload`, { method:'POST', body:fd });
      const data = await res.json();
      if (data.error) return { ok:false, error: data.error.message };

      await sb.from('archivos').insert({
        nombre_original: file.name,
        nombre_storj:    data.public_id,
        bucket:          'cloudinary',
        carpeta,
        extension:       ext,
        mime:            file.type || 'image/jpeg',
        tamano:          file.size,
        url_publica:     CLOUDINARY.thumb(data.public_id),
        titulo,
        departamento,
        categoria,
        subido_por:      _usuario.id,
      });
      return { ok:true, titulo, carpeta, ext: ext.toUpperCase() };

    } else {
      // Subir a Storj vía Supabase Edge Function
      const fd = new FormData();
      fd.append('archivo',     file);
      fd.append('titulo',      titulo);
      fd.append('departamento',departamento);
      fd.append('categoria',   categoria);
      fd.append('usuario_id',  _usuario.id);

      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-storj`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body:    fd,
      });
      const result = await res.json();
      if (!result.ok) return { ok:false, error: result.error || 'Error en Edge Function' };
      return { ok:true, titulo, carpeta, ext: ext.toUpperCase() };
    }
  } catch(e) {
    return { ok:false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  PERFIL
// ══════════════════════════════════════════════════════════════
async function renderPerfil() {
  const app = document.getElementById('app');
  const { data: perfil } = await sb.from('perfiles').select('*').eq('id', _usuario.id).single();
  const ava = avatarUrl(perfil.avatar_url, perfil.nombre, perfil.apellido);

  app.innerHTML = `
  <div class="container-fluid px-3 px-md-4 fade-in">
    <div class="page-header mb-4">
      <h4 class="fw-700 mb-0"><i class="fa-solid fa-circle-user me-2 text-accent"></i>Mi Perfil</h4>
    </div>
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="intra-card mb-3">
          <div class="card-body text-center py-4">
            <div style="position:relative;width:96px;height:96px;margin:0 auto .75rem">
              <img id="avatarPreview" src="${ava}"
                   width="96" height="96"
                   style="width:96px;height:96px;max-width:96px;max-height:96px;
                          border-radius:50%;object-fit:cover;border:2px solid var(--accent);display:block">
              <label for="avatarInput"
                     style="position:absolute;bottom:2px;right:2px;width:26px;height:26px;
                            border-radius:50%;background:var(--accent);display:flex;
                            align-items:center;justify-content:center;cursor:pointer;
                            border:2px solid var(--bg-card);font-size:.7rem;color:#fff">
                <i class="fa-solid fa-camera"></i>
              </label>
              <input type="file" id="avatarInput" class="d-none"
                     accept="image/jpeg,image/png,image/gif,image/webp">
            </div>
            <h5 class="fw-700 mb-1">${xss(perfil.nombre)} ${xss(perfil.apellido)}</h5>
            <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.5rem">${xss(perfil.email||_authUser.email)}</div>
            <span class="rol-badge rol-${xss(perfil.rol)}">${perfil.rol}</span>
            ${perfil.departamento ? `<div class="mt-2"><span class="badge-dept">${xss(perfil.departamento)}</span></div>` : ''}
          </div>
        </div>

        <!-- Tema -->
        <div class="intra-card">
          <div class="card-header"><i class="fa-solid fa-palette"></i> Tema</div>
          <div class="card-body d-flex flex-column gap-2">
            ${[['system','fa-circle-half-stroke','Sistema'],['light','fa-sun','Claro'],['dark','fa-moon','Oscuro']].map(([val,ico,label]) => `
            <label style="cursor:pointer">
              <input type="radio" name="temaRad" value="${val}" class="d-none"
                     ${(perfil.tema||'system')===val?'checked':''}>
              <div class="tema-opt ${(perfil.tema||'system')===val?'activa':''}"
                   style="display:flex;align-items:center;gap:.65rem;padding:.6rem .85rem;
                          border:2px solid ${(perfil.tema||'system')===val?'var(--accent)':'var(--border)'};
                          border-radius:var(--radius);background:var(--bg-card2);cursor:pointer;
                          transition:border-color .2s">
                <i class="fa-solid ${ico}" style="color:${(perfil.tema||'system')===val?'var(--accent)':'var(--text-dim)'}"></i>
                <span style="font-size:.85rem;font-weight:600">${label}</span>
              </div>
            </label>`).join('')}
          </div>
        </div>
      </div>

      <div class="col-lg-8">
        <div class="intra-card">
          <div class="card-header"><i class="fa-solid fa-pen"></i> Editar Información</div>
          <div class="card-body">
            <div id="perfilErr" class="alert-intra alert-danger mb-3" style="display:none"></div>
            <div id="perfilOk"  class="alert-intra alert-success mb-3" style="display:none"></div>
            <form id="perfilForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Nombre *</label>
                  <input type="text" id="pNombre" class="form-control" value="${xss(perfil.nombre)}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Apellido *</label>
                  <input type="text" id="pApellido" class="form-control" value="${xss(perfil.apellido)}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Teléfono</label>
                  <input type="text" id="pTel" class="form-control" value="${xss(perfil.telefono||'')}" placeholder="+1 555 0000">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Departamento</label>
                  <input type="text" id="pDept" class="form-control" value="${xss(perfil.departamento||'')}">
                </div>
              </div>
              <div class="mt-4 mb-2" style="font-size:.82rem;font-weight:600;color:var(--text-muted)">
                <i class="fa-solid fa-lock me-1"></i>Cambiar contraseña
                <small style="font-weight:400;color:var(--text-dim)">&nbsp;(vacío = no cambiar)</small>
              </div>
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Nueva contraseña</label>
                  <input type="password" id="pPass" class="form-control" placeholder="Mín. 8 caracteres">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Confirmar</label>
                  <input type="password" id="pPass2" class="form-control" placeholder="Repetir">
                </div>
              </div>
              <button type="submit" class="btn btn-intra mt-4 px-4">
                <i class="fa-solid fa-floppy-disk me-2"></i>Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  // Cambiar tema al seleccionar radio
  document.querySelectorAll('[name="temaRad"]').forEach(r => {
    r.addEventListener('change', () => {
      setTema(r.value);
      document.querySelectorAll('.tema-opt').forEach((d,i) => {
        const rad = document.querySelectorAll('[name="temaRad"]')[i];
        d.style.borderColor = rad.checked ? 'var(--accent)' : 'var(--border)';
        d.querySelector('i').style.color = rad.checked ? 'var(--accent)' : 'var(--text-dim)';
      });
    });
  });

  // Avatar preview
  document.getElementById('avatarInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('avatarPreview').src = URL.createObjectURL(file);
    // Subir a Cloudinary
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY.preset);
    fd.append('folder', 'intranet-corp/avatares');
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloud}/image/upload`, { method:'POST', body:fd });
    const data = await res.json();
    if (!data.error) {
      const url = CLOUDINARY.avatar(data.public_id);
      await sb.from('perfiles').update({ avatar_url: url }).eq('id', _usuario.id);
      _usuario.avatar_url = url;
      toast('Foto actualizada', 'ok');
    }
  });

  // Guardar perfil
  document.getElementById('perfilForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = document.getElementById('perfilErr');
    const ok  = document.getElementById('perfilOk');
    err.style.display = 'none'; ok.style.display = 'none';

    const nombre   = document.getElementById('pNombre').value.trim();
    const apellido = document.getElementById('pApellido').value.trim();
    const tel      = document.getElementById('pTel').value.trim();
    const dept     = document.getElementById('pDept').value.trim();
    const pass     = document.getElementById('pPass').value;
    const pass2    = document.getElementById('pPass2').value;
    const tema     = document.querySelector('[name="temaRad"]:checked')?.value || 'system';

    if (pass && pass !== pass2) {
      err.textContent = 'Las contraseñas no coinciden.'; err.style.display='block'; return;
    }
    if (pass && pass.length < 8) {
      err.textContent = 'La contraseña debe tener al menos 8 caracteres.'; err.style.display='block'; return;
    }

    const updates = { nombre, apellido, telefono:tel, departamento:dept, tema };
    const { error } = await sb.from('perfiles').update(updates).eq('id', _usuario.id);
    if (error) { err.textContent = error.message; err.style.display='block'; return; }

    if (pass) {
      const { error: passErr } = await sb.auth.updateUser({ password: pass });
      if (passErr) { err.textContent = passErr.message; err.style.display='block'; return; }
    }

    Object.assign(_usuario, updates);
    ok.textContent = 'Perfil actualizado correctamente.'; ok.style.display='block';
    toast('Perfil guardado', 'ok');
  });
}

// ══════════════════════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════════════════════
async function renderAdmin() {
  if (!tieneRol(ROLES.puedeAdmin)) { toast('Sin permiso de administrador','err'); navigate('/dashboard'); return; }
  const app = document.getElementById('app');

  const [usrsRes, archRes] = await Promise.all([
    sb.from('perfiles').select('*').order('nombre'),
    sb.from('archivos').select('id,titulo,tamano,activo,created_at,perfiles(nombre,apellido)')
      .order('created_at', { ascending: false }).limit(20),
  ]);

  app.innerHTML = `
  <div class="container-fluid px-3 px-md-4 fade-in">
    <div class="page-header mb-4">
      <h4 class="fw-700 mb-0"><i class="fa-solid fa-shield-halved me-2 text-accent"></i>Panel de Administración</h4>
    </div>
    <ul class="nav nav-tabs mb-4" id="adminTabs">
      <li class="nav-item"><a class="nav-link active" href="#" onclick="adminTab('usuarios',this);return false">Usuarios</a></li>
      <li class="nav-item"><a class="nav-link" href="#" onclick="adminTab('archivos',this);return false">Archivos</a></li>
      <li class="nav-item"><a class="nav-link" href="#" onclick="adminTab('anuncios',this);return false">Anuncios</a></li>
    </ul>
    <div id="adminContent">
      <!-- Usuarios -->
      <div id="tabUsuarios">
        <div class="intra-card mb-3">
          <div class="card-header">
            <i class="fa-solid fa-users"></i> Usuarios (${usrsRes.data?.length||0})
            <button class="btn btn-intra btn-sm ms-auto" onclick="adminNuevoUsuario()">
              <i class="fa-solid fa-user-plus me-1"></i>Nuevo
            </button>
          </div>
          <div class="table-responsive">
            <table class="intra-table">
              <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Depto.</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
              ${(usrsRes.data||[]).map(u => `
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <img src="${avatarUrl(u.avatar_url,u.nombre,u.apellido)}"
                         width="32" height="32"
                         style="width:32px;height:32px;max-width:32px;max-height:32px;border-radius:50%;object-fit:cover" alt="">
                    <span style="font-weight:600;font-size:.84rem">${xss(u.nombre)} ${xss(u.apellido)}</span>
                  </div>
                </td>
                <td style="font-size:.8rem">${xss(_authUser.id===u.id ? _authUser.email : '—')}</td>
                <td><span class="rol-badge rol-${xss(u.rol)}">${u.rol}</span></td>
                <td style="font-size:.78rem">${xss(u.departamento||'—')}</td>
                <td><span style="font-size:.72rem;padding:2px 8px;border-radius:20px;font-weight:700;
                  ${u.activo ? 'background:rgba(30,126,52,.12);color:#1e7e34' : 'background:rgba(192,57,43,.12);color:#c0392b'}">
                  ${u.activo?'Activo':'Inactivo'}</span></td>
                <td>
                  <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-intra-outline" onclick="adminEditarRol('${u.id}','${u.rol}')">
                      <i class="fa-solid fa-pen"></i>
                    </button>
                    ${u.id !== _usuario.id ? `
                    <button class="btn btn-sm btn-outline-danger-soft"
                            onclick="adminToggleUsuario('${u.id}',${u.activo})">
                      <i class="fa-solid fa-${u.activo?'ban':'circle-check'}"></i>
                    </button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  window.adminTab = (tab, el) => {
    document.querySelectorAll('#adminTabs .nav-link').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
    const content = document.getElementById('adminContent');
    if (tab === 'usuarios') { document.getElementById('tabUsuarios').style.display='block'; }
  };

  window.adminEditarRol = async (uid, rolActual) => {
    const nuevo = prompt('Rol actual: ' + rolActual + '\n\nNuevo rol (admin/editor/moderador/lector):', rolActual);
    if (!nuevo || !['admin','editor','moderador','lector'].includes(nuevo)) return;
    await sb.from('perfiles').update({ rol: nuevo }).eq('id', uid);
    toast('Rol actualizado', 'ok');
    renderAdmin();
  };

  window.adminToggleUsuario = async (uid, activo) => {
    if (!confirm(`¿${activo?'Desactivar':'Activar'} este usuario?`)) return;
    await sb.from('perfiles').update({ activo: !activo }).eq('id', uid);
    toast(`Usuario ${activo?'desactivado':'activado'}`, 'ok');
    renderAdmin();
  };

  window.adminNuevoUsuario = async () => {
    const email = prompt('Email del nuevo usuario:');
    if (!email) return;
    const pass  = prompt('Contraseña temporal (mín. 8 caracteres):');
    if (!pass || pass.length < 8) { toast('Contraseña demasiado corta','err'); return; }
    const nombre   = prompt('Nombre:') || 'Usuario';
    const apellido = prompt('Apellido:') || 'Nuevo';
    const rol      = prompt('Rol (admin/editor/moderador/lector):', 'lector') || 'lector';

    const { error } = await sb.auth.admin.createUser({
      email, password: pass, email_confirm: true,
      user_metadata: { nombre, apellido, rol },
    });
    if (error) toast(error.message, 'err');
    else { toast('Usuario creado correctamente', 'ok'); renderAdmin(); }
  };
}

// ══════════════════════════════════════════════════════════════
//  ENCUESTAS
// ══════════════════════════════════════════════════════════════
async function renderEncuestas() {
  const app = document.getElementById('app');
  const params = new URLSearchParams(window.location.search);
  const filtro = params.get('f') === 'cerradas' ? false : true;

  const [encRes, votosRes] = await Promise.all([
    sb.from('encuestas').select('*,perfiles(nombre,apellido),encuestas_opciones(*)')
      .eq('activa', filtro).order('created_at', { ascending: false }),
    sb.from('encuestas_votos').select('encuesta_id,opcion_id').eq('usuario_id', _usuario.id),
  ]);

  const misVotos = {};
  (votosRes.data||[]).forEach(v => {
    if (!misVotos[v.encuesta_id]) misVotos[v.encuesta_id] = [];
    misVotos[v.encuesta_id].push(v.opcion_id);
  });

  app.innerHTML = `
  <div class="container-fluid px-3 px-md-4 fade-in">
    <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
      <h4 class="fw-700 mb-0"><i class="fa-solid fa-chart-bar me-2 text-accent"></i>Encuestas</h4>
      ${tieneRol(ROLES.puedeCrearEncuesta) ? `
      <button class="btn btn-intra btn-sm" onclick="mostrarFormEncuesta()">
        <i class="fa-solid fa-plus me-1"></i>Nueva Encuesta
      </button>` : ''}
    </div>
    <div class="d-flex gap-2 mb-4">
      <a href="#" onclick="navigate('/encuestas');return false"
         class="btn btn-sm ${filtro?'btn-intra':'btn-intra-outline'}">Activas</a>
      <a href="#" onclick="navigate('/encuestas?f=cerradas');return false"
         class="btn btn-sm ${!filtro?'btn-intra':'btn-intra-outline'}">Cerradas</a>
    </div>
    <div id="encuestaFormWrap"></div>
    <div class="row g-4" id="encuestasList">
      ${(encRes.data||[]).length ? (encRes.data||[]).map(enc => renderEncuestaCard(enc, misVotos)).join('')
        : '<div class="col-12"><div class="intra-card"><div class="card-body text-center py-5 text-muted">No hay encuestas.</div></div></div>'}
    </div>
  </div>`;

  window.votar = async (encId, opId, esMultiple) => {
    const { error } = await sb.from('encuestas_votos').insert({ encuesta_id: encId, opcion_id: opId, usuario_id: _usuario.id });
    if (error) { toast('Ya votaste o error al votar','err'); return; }
    toast('¡Voto registrado!','ok');
    renderEncuestas();
  };

  window.cerrarEncuesta = async (id) => {
    if (!confirm('¿Cerrar esta encuesta?')) return;
    await sb.from('encuestas').update({ activa: false }).eq('id', id);
    renderEncuestas();
  };

  window.mostrarFormEncuesta = () => {
    document.getElementById('encuestaFormWrap').innerHTML = `
    <div class="intra-card mb-4">
      <div class="card-header"><i class="fa-solid fa-plus"></i> Nueva Encuesta</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-12"><label class="form-label">Pregunta *</label>
            <input type="text" id="encTitulo" class="form-control" placeholder="¿Cuál es tu preferencia?"></div>
          <div class="col-12"><label class="form-label">Opciones (mín. 2) *</label>
            <div id="opcionesWrap">
              <input type="text" name="opc" class="form-control mb-2" placeholder="Opción 1">
              <input type="text" name="opc" class="form-control mb-2" placeholder="Opción 2">
            </div>
            <button type="button" class="btn btn-intra-outline btn-sm"
                    onclick="document.getElementById('opcionesWrap').insertAdjacentHTML('beforeend','<input type=\\'text\\' name=\\'opc\\' class=\\'form-control mb-2\\' placeholder=\\'Opción \\'+document.querySelectorAll(\\'#opcionesWrap [name=opc]\\').length)')">
              <i class="fa-solid fa-plus me-1"></i>Agregar opción
            </button>
          </div>
          <div class="col-md-4">
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem">
              <input type="checkbox" id="encAnonima" style="accent-color:var(--accent)"> Anónima
            </label>
          </div>
          <div class="col-md-4">
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem">
              <input type="checkbox" id="encMultiple" style="accent-color:var(--accent)"> Respuesta múltiple
            </label>
          </div>
        </div>
        <button onclick="crearEncuesta()" class="btn btn-intra mt-3">
          <i class="fa-solid fa-chart-bar me-1"></i>Publicar
        </button>
        <button onclick="document.getElementById('encuestaFormWrap').innerHTML=''" class="btn btn-intra-outline mt-3 ms-2">Cancelar</button>
      </div>
    </div>`;
  };

  window.crearEncuesta = async () => {
    const titulo   = document.getElementById('encTitulo')?.value.trim();
    const opciones = [...document.querySelectorAll('#opcionesWrap [name="opc"]')]
                       .map(i => i.value.trim()).filter(Boolean);
    if (!titulo || opciones.length < 2) { toast('Título y al menos 2 opciones son requeridos','err'); return; }

    const { data: enc, error } = await sb.from('encuestas').insert({
      titulo,
      autor_id:  _usuario.id,
      anonima:   document.getElementById('encAnonima')?.checked || false,
      multiple:  document.getElementById('encMultiple')?.checked || false,
    }).select().single();
    if (error) { toast(error.message,'err'); return; }

    await sb.from('encuestas_opciones').insert(opciones.map((t,i) => ({ encuesta_id:enc.id, texto:t, orden:i })));
    toast('Encuesta publicada','ok');
    renderEncuestas();
  };
}

function renderEncuestaCard(enc, misVotos) {
  const yaVote  = !!misVotos[enc.id];
  const opciones = enc.encuestas_opciones || [];
  const totalV   = opciones.reduce((s,o) => s + (o.votos||0), 0);

  return `
  <div class="col-lg-6">
    <div class="intra-card h-100">
      <div class="card-header" style="flex-wrap:wrap;gap:.4rem">
        <i class="fa-solid fa-chart-bar" style="color:var(--warning)"></i>
        <span class="fw-600">${xss(enc.titulo)}</span>
        ${enc.anonima ? '<span style="font-size:.65rem;background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:1px 7px"><i class="fa-solid fa-mask me-1"></i>Anónima</span>' : ''}
        ${enc.activa && tieneRol(ROLES.puedeCrearEncuesta) ? `
        <button onclick="cerrarEncuesta(${enc.id})" class="ms-auto btn btn-sm"
                style="background:rgba(192,57,43,.1);color:#c0392b;border:1px solid rgba(192,57,43,.3);padding:2px 9px;font-size:.72rem">
          <i class="fa-solid fa-xmark me-1"></i>Cerrar
        </button>` : ''}
      </div>
      <div class="card-body">
        ${yaVote || !enc.activa
          ? opciones.map(o => {
              const pct = totalV > 0 ? Math.round((o.votos||0)/totalV*100) : 0;
              const mine = (misVotos[enc.id]||[]).includes(o.id);
              return `<div class="mb-2">
                <div class="d-flex justify-content-between" style="font-size:.83rem;margin-bottom:3px">
                  <span>${mine?'<strong>✓ ':''} ${xss(o.texto)} ${mine?'</strong>':''}</span>
                  <span style="color:var(--accent)">${pct}%</span>
                </div>
                <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;${mine?'background:var(--accent)':''}"></div></div>
              </div>`;
            }).join('')
          : `<div class="d-flex flex-column gap-2 mb-3">
              ${opciones.map(o => `
              <label style="display:flex;align-items:center;gap:.6rem;padding:.45rem .75rem;
                             background:var(--bg-card2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:.85rem">
                <input type="${enc.multiple?'checkbox':'radio'}" name="enc${enc.id}"
                       style="accent-color:var(--accent)"
                       onchange="votar(${enc.id},${o.id},${enc.multiple})">
                <span>${xss(o.texto)}</span>
              </label>`).join('')}
            </div>`}
        <div style="font-size:.72rem;color:var(--text-dim);margin-top:.5rem">
          <i class="fa-solid fa-user me-1"></i>${xss(enc.perfiles?.nombre||'—')} ·
          <i class="fa-solid fa-clock me-1 ms-1"></i>${fmtFecha(enc.created_at)}
        </div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  LLAMADAS / VIDEO
// ══════════════════════════════════════════════════════════════
async function renderLlamadas() {
  const app = document.getElementById('app');
  const { data: salas } = await sb.from('salas_voz').select('*,perfiles(nombre,apellido)')
    .eq('activa', true).order('created_at', { ascending: false }).limit(10);
  const { data: misParticipaciones } = await sb.from('salas_participantes')
    .select('sala_id').eq('usuario_id', _usuario.id);
  const misIds = new Set((misParticipaciones||[]).map(s => s.sala_id));

  app.innerHTML = `
  <div class="container-fluid px-3 px-md-4 fade-in">
    <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
      <h4 class="fw-700 mb-0"><i class="fa-solid fa-phone-volume me-2 text-accent"></i>Salas de Voz y Video</h4>
      <button class="btn btn-intra btn-sm" onclick="crearSala()">
        <i class="fa-solid fa-plus me-1"></i>Nueva Sala
      </button>
    </div>
    <div class="alert-intra alert-warning mb-4">
      <i class="fa-solid fa-triangle-exclamation me-2"></i>
      La voz y video entre dispositivos distintos requiere <strong>HTTPS</strong>.
      En Vercel funciona automáticamente.
    </div>
    <div class="row g-3" id="salasList">
      ${(salas||[]).length ? (salas||[]).map(s => `
      <div class="col-md-6 col-lg-4">
        <div class="intra-card">
          <div class="card-body">
            <div class="d-flex align-items-center gap-3 mb-3">
              <div style="width:44px;height:44px;border-radius:10px;flex-shrink:0;
                          background:${s.tipo==='video'?'rgba(192,57,43,.12)':'rgba(30,126,52,.12)'};
                          display:flex;align-items:center;justify-content:center;font-size:1.2rem;
                          color:${s.tipo==='video'?'#c0392b':'#1e7e34'}">
                <i class="fa-solid fa-${s.tipo==='video'?'video':'phone'}"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:.92rem">${xss(s.nombre)}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">
                  ${s.tipo==='video'?'Videollamada':'Llamada de voz'} · ${s.alcance}
                </div>
                <div style="font-size:.7rem;color:var(--text-dim)">
                  Por ${xss(s.perfiles?.nombre||'—')} · ${fmtHora(s.created_at)}
                </div>
              </div>
            </div>
            <div class="d-flex gap-2">
              <button onclick="entrarSala(${s.id},'${xss(s.nombre)}')" class="btn btn-intra btn-sm flex-fill">
                <i class="fa-solid fa-arrow-right-to-bracket me-1"></i>
                ${misIds.has(s.id)?'Volver':'Unirse'}
              </button>
              ${s.creada_por===_usuario.id?`
              <button onclick="cerrarSala(${s.id})" class="btn btn-sm btn-outline-danger-soft" title="Cerrar sala">
                <i class="fa-solid fa-phone-slash"></i>
              </button>`:''}
            </div>
          </div>
        </div>
      </div>`).join('') : `
      <div class="col-12">
        <div class="intra-card"><div class="card-body text-center py-5 text-muted">
          <i class="fa-solid fa-phone-slash fa-2x d-block mb-2" style="color:var(--text-dim)"></i>
          No hay salas activas. ¡Crea la primera!
        </div></div>
      </div>`}
    </div>
  </div>`;

  window.crearSala = async () => {
    const nombre = prompt('Nombre de la sala:') || `Sala ${new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}`;
    const tipo   = confirm('¿Videollamada? (Aceptar = video, Cancelar = solo audio)') ? 'video' : 'audio';
    const codigo = Math.random().toString(36).substr(2,10);

    const { data: sala } = await sb.from('salas_voz').insert({
      codigo, nombre, tipo, alcance: 'todos', creada_por: _usuario.id
    }).select().single();

    // Invitar a todos
    const { data: todos } = await sb.from('perfiles').select('id').eq('activo', true);
    if (todos) {
      const invs = todos.filter(u => u.id !== _usuario.id).map(u => ({ sala_id: sala.id, usuario_id: u.id }));
      if (invs.length) await sb.from('salas_invitaciones').insert(invs);
    }

    entrarSala(sala.id, sala.nombre);
  };

  window.entrarSala = async (salaId, nombre) => {
    await sb.from('salas_participantes').upsert({ sala_id: salaId, usuario_id: _usuario.id });
    // Abrir en nueva ventana/tab para no perder la app
    const url = `${APP.baseUrl}/sala?id=${salaId}&nombre=${encodeURIComponent(nombre)}`;
    window.open(url, `sala_${salaId}`, 'width=900,height=700');
  };

  window.cerrarSala = async (id) => {
    if (!confirm('¿Cerrar esta sala?')) return;
    await sb.from('salas_voz').update({ activa: false }).eq('id', id);
    renderLlamadas();
  };
}
