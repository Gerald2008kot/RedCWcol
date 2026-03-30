// ============================================================
//  RedCW — Page Loaders
// ============================================================

/* ── LAZY LOAD STATE ─────────────────────────────────────────── */
const LazyState = {
  inicio:   { page: 0, loading: false, done: false, observer: null },
  noticias: { page: 0, loading: false, done: false, observer: null },
  forum:    { page: 0, loading: false, done: false, observer: null, id: null },
};
const PAGE_SIZE = 15;

function resetLazy(section) {
  var s = LazyState[section];
  if (!s) return;
  s.page = 0; s.loading = false; s.done = false;
  if (s.observer) { s.observer.disconnect(); s.observer = null; }
}

function attachLazySentinel(feedId, section, loadFn) {
  var feed = document.getElementById(feedId);
  if (!feed) return;
  var existing = feed.querySelector(".lazy-sentinel");
  if (existing) existing.remove();
  var sentinel = document.createElement("div");
  sentinel.className = "lazy-sentinel";
  sentinel.style.cssText = "height:1px;width:100%";
  feed.appendChild(sentinel);
  if (LazyState[section].observer) LazyState[section].observer.disconnect();
  LazyState[section].observer = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting && !LazyState[section].loading && !LazyState[section].done) {
      loadFn();
    }
  }, { rootMargin: "200px" });
  LazyState[section].observer.observe(sentinel);
}

/* ── INICIO ─────────────────────────────────────────────────── */
async function loadInicioPage() {
  resetLazy("inicio");
  const feed = document.getElementById("inicio-feed");
  if (!feed) return;
  feed.innerHTML = skeletonPosts(3);
  await fetchInicioPage();
  attachLazySentinel("inicio-feed", "inicio", fetchInicioPage);
}

async function fetchInicioPage() {
  const s = LazyState.inicio;
  if (s.loading || s.done) return;
  s.loading = true;
  const feed = document.getElementById("inicio-feed");
  if (!feed) { s.loading = false; return; }

  // Remove sentinel temporarily
  var sentinel = feed.querySelector(".lazy-sentinel");
  if (sentinel) sentinel.remove();

  try {
    const sb = await initSupabase();
    const { data: posts, error } = await sb.from("posts")
      .select("*, profiles(username, avatar_url, plan, role)")
      .eq("section", "inicio")
      .order("created_at", { ascending: false })
      .range(s.page * PAGE_SIZE, (s.page + 1) * PAGE_SIZE - 1);
    if (error) throw error;

    let likedIds = new Set();
    if (AppState.currentUser) {
      const { data: lk } = await sb.from("likes").select("post_id").eq("user_id", AppState.currentUser.id);
      if (lk) likedIds = new Set(lk.map(l => l.post_id));
    }

    if (!posts || posts.length === 0) {
      if (s.page === 0) feed.innerHTML = emptyState("Aún no hay publicaciones", "Sé el primero en compartir algo");
      s.done = true;
    } else {
      var html = posts.map(p => renderPost({ ...p, user_liked: likedIds.has(p.id) }, { section: "inicio", showIdentity: AppState.canDo("canSeeAnonIdentity") })).join("");
      if (s.page === 0) feed.innerHTML = html;
      else feed.insertAdjacentHTML("beforeend", html);
      if (posts.length < PAGE_SIZE) s.done = true;
      s.page++;
    }
  } catch (e) {
    if (s.page === 0) feed.innerHTML = '<div class="empty-state"><p>Error al cargar</p></div>';
  } finally {
    s.loading = false;
    if (!s.done) attachLazySentinel("inicio-feed", "inicio", fetchInicioPage);
  }
}

async function createInicioPost() {
  const user = AppState.currentUser;
  if (!user) { showToast("Debes iniciar sesión", "error"); return; }

  const textarea = document.getElementById("inicio-compose");
  const content = textarea.value.trim();
  if (!content) { showToast("Escribe algo primero", "error"); return; }

  const btn = document.getElementById("btn-inicio-publish");
  if (btn) { btn.disabled = true; btn.textContent = "Publicando…"; }

  try {
    let images = [];
    let media_url = null;

    // Imágenes — rcwUpload en serie
    const fileInput = document.getElementById("inicio-images");
    if (fileInput && fileInput.files && fileInput.files.length) {
      showToast("Subiendo imágenes…");
      var imgFiles = Array.from(fileInput.files).slice(0, 4);
      for (var _i = 0; _i < imgFiles.length; _i++) {
        var _url = await rcwUpload(imgFiles[_i], "image");
        images.push(_url);
      }
    }

    // Video — rcwUpload directo
    const vidInput = document.getElementById("inicio-video");
    if (vidInput && vidInput.files && vidInput.files[0]) {
      showToast("Subiendo video…");
      media_url = await rcwUpload(vidInput.files[0], "video");
    }

    const isAnon = document.getElementById("inicio-anon")?.checked && canPostAnon();

    await sbInsertPost({
      section:   "inicio",
      user_id:   user.id,
      content,
      images:    images.length > 0 ? images : null,
      media_url: media_url || null,
      is_anon:   isAnon,
    });

    textarea.value = "";
    if (fileInput) fileInput.value = "";
    if (vidInput) vidInput.value = "";
    document.getElementById("inicio-media-preview").innerHTML = "";
    showToast("Publicado", "success");
    loadInicioPage();
  } catch (e) {
    console.error("createInicioPost:", e);
    showToast("Error al publicar: " + (e.message || ""), "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Publicar"; }
  }
}

function canPostAnon() {
  return AppState.hasPlan("n2");
}

/* ── NOTICIAS ────────────────────────────────────────────────── */
async function loadNoticiasPage() {
  const feed = document.getElementById("noticias-feed");
  if (!feed) return;

  const user = AppState.currentUser;
  const canPost = user && AppState.hasRole("encargado");
  document.getElementById("news-create-section").classList.toggle("hidden", !canPost);
  document.getElementById("btn-create-news-group").classList.toggle("hidden", !AppState.hasRole("administrador"));

  feed.innerHTML = skeletonPosts(2);

  try {
    const groups = await dbSelect("news_groups", { order: "created_at" });
    if (!groups.length) { feed.innerHTML = emptyState("Sin grupos de noticias", "Los administradores deben crear grupos primero"); return; }

    let html = "";
    for (const g of groups) {
      const posts = await dbSelect("posts", {
        eq: { section: "noticias", news_group_id: g.id },
        order: "created_at",
        limit: 3,
        select: "*, profiles(username, avatar_url, plan)",
      });
      var groupPhotoHtml = g.photo_url
        ? '<img src="'+escHtml(g.photo_url)+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0">'
        : '<div class="news-group-dot"></div>';
      var isGroupAdmin = AppState.hasRole("administrador") || AppState.currentUser?.id === g.created_by;
      html += '<div class="news-group">'
        +'<div class="news-group-header">'
          +groupPhotoHtml
          +'<span class="news-group-name">'+escHtml(g.name)+'</span>'
          +(canPost ? '<button class="btn btn-sm btn-primary" onclick="openNewsPostModal(\''+g.id+'\')">&plus; Publicar</button>' : '')
          +(isGroupAdmin ? '<button class="btn btn-secondary btn-sm" style="padding:.25rem .5rem" onclick="openNewsGroupAdmin(\''+g.id+'\')">⚙️</button>' : '')
        +'</div>'
        +(posts.length
          ? posts.map(p => renderPost(p, { section: "noticias", showIdentity: AppState.canDo("canSeeAnonIdentity") })).join("")
          : '<div style="padding:.75rem 0;font-size:.82rem;color:var(--text-3)">Sin publicaciones aún en este grupo</div>')
      +'</div>';
    }
    feed.innerHTML = html || emptyState("Sin grupos de noticias", "");
  } catch (e) { feed.innerHTML = `<div class="empty-state"><p>Error al cargar noticias</p></div>`; }
}

function openNewsGroupModal() {
  document.getElementById("news-group-modal").classList.add("open");
}

async function createNewsGroup() {
  const name = document.getElementById("news-group-name").value.trim();
  if (!name) return;
  try {
    await dbInsert("news_groups", { name, created_by: AppState.currentUser.id });
    document.getElementById("news-group-modal").classList.remove("open");
    document.getElementById("news-group-name").value = "";
    showToast("Grupo creado", "success");
    loadNoticiasPage();
  } catch (e) { showToast("Error", "error"); }
}

function openNewsPostModal(groupId) {
  const m = document.getElementById("news-post-modal");
  m.dataset.groupId = groupId;
  m.classList.add("open");
}

async function submitNewsPost() {
  const m = document.getElementById("news-post-modal");
  const content = document.getElementById("news-post-content").value.trim();
  if (!content) { showToast("Escribe algo primero", "error"); return; }

  const btn = document.getElementById("btn-submit-news-post");
  if (btn) { btn.disabled = true; btn.textContent = "Publicando…"; }

  try {
    let images = [];
    let media_url = null;
    const fileInput = document.getElementById("news-post-images");
    if (fileInput && fileInput.files && fileInput.files.length) {
      showToast("Subiendo imágenes…");
      var _imgs = Array.from(fileInput.files).slice(0, 4);
      for (var _j = 0; _j < _imgs.length; _j++) {
        images.push(await rcwUpload(_imgs[_j], "image"));
      }
    }
    const vidInput = document.getElementById("news-post-video");
    if (vidInput && vidInput.files && vidInput.files[0]) {
      showToast("Subiendo video…");
      media_url = await rcwUpload(vidInput.files[0], "video");
    }
    await sbInsertPost({
      section:       "noticias",
      news_group_id: m.dataset.groupId,
      user_id:       AppState.currentUser.id,
      content,
      images:        images.length > 0 ? images : null,
      media_url:     media_url || null,
    });
    m.classList.remove("open");
    document.getElementById("news-post-content").value = "";
    if (fileInput) fileInput.value = "";
    if (vidInput) vidInput.value = "";
    showToast("Publicado en noticias", "success");
    loadNoticiasPage();
  } catch (e) {
    console.error("submitNewsPost:", e);
    showToast("Error al publicar: " + (e.message || ""), "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Publicar"; }
  }
}

/* ── COMUNIDADES ─────────────────────────────────────────────── */
async function loadComunidadesPage() {
  const grid = document.getElementById("comunidades-grid");
  if (!grid) return;
  grid.innerHTML = skeletonCards(4);

  try {
    const forums = await dbSelect("forums", { order: "created_at", select: "id,name,is_anon,is_private,is_hidden,member_count,created_by" });
    // hide hidden forums (only admin/owner can see)
    const visible = forums.filter(f => !f.is_hidden || AppState.hasRole("administrador"));
    grid.innerHTML = visible.length
      ? visible.map(f => renderForumCard(f)).join("")
      : emptyState("Sin comunidades", "Crea la primera comunidad");
  } catch (e) { grid.innerHTML = "<p>Error al cargar</p>"; }
}

function renderForumCard(f) {
  return `<div class="forum-card" onclick="openForum('${f.id}')">
    ${f.is_private ? `<div class="forum-private-icon"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>` : ""}
    <div class="forum-card-name">${escHtml(f.name)}</div>
    <div class="forum-card-meta">${f.member_count || 0} miembros</div>
    ${f.is_anon ? `<div class="forum-card-anon">ANÓNIMO</div>` : ""}
  </div>`;
}

async function openForum(forumId) {
  const user = AppState.currentUser;
  if (!user) { showToast("Debes iniciar sesión", "error"); return; }

  const sb = await initSupabase();
  const { data: forum, error: forumErr } = await sb.from("forums").select("*").eq("id", forumId).single();
  if (forumErr || !forum) { showToast("No se pudo cargar el foro", "error"); return; }

  // Verificar membresía
  const { data: member } = await sb.from("forum_members")
    .select("id, role")
    .eq("forum_id", forumId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (forum.is_private && !member) {
    showToast("Este foro es privado. Necesitas invitación.", "error");
    return;
  }

  // Auto-unirse a foros públicos al entrar por primera vez
  if (!member) {
    try {
      await sbFetch("/rest/v1/forum_members", "POST", {
        forum_id: forumId, user_id: user.id, role: "member"
      });
    } catch(e) {
      console.warn("Auto-join error:", e.message);
    }
  }

  openForumDetail(forum, member);
}

function createForumModal() {
  // Mostrar/ocultar opciones según plan y rol antes de abrir
  const canAnon = AppState.hasRole("propietario") || AppState.hasPlan("n1");
  const canHidden = AppState.hasPlan("n3");
  document.getElementById("anon-forum-option").classList.toggle("hidden", !canAnon);
  document.getElementById("hidden-forum-option").classList.toggle("hidden", !canHidden);
  // Resetear checkboxes
  document.getElementById("forum-name").value = "";
  document.getElementById("forum-private").checked = false;
  document.getElementById("forum-anon").checked = false;
  if (document.getElementById("forum-hidden")) document.getElementById("forum-hidden").checked = false;
  document.getElementById("create-forum-modal").classList.add("open");
}

async function submitCreateForum() {
  const user = AppState.currentUser;
  if (!user) { showToast("Debes iniciar sesión", "error"); return; }

  const name = document.getElementById("forum-name").value.trim();
  const isPrivate = document.getElementById("forum-private").checked;
  const isAnon = document.getElementById("forum-anon").checked;
  const isHidden = document.getElementById("forum-hidden")?.checked || false;

  if (!name) { showToast("Ponle un nombre al foro", "error"); return; }

  const btn = document.getElementById("btn-create-forum");
  btn.disabled = true;
  btn.textContent = "Creando…";

  try {
    const sb = await initSupabase();
    // Insertar foro y obtener el id directamente
    const { data: newForum, error: forumErr } = await sb
      .from("forums")
      .insert({ name, is_private: isPrivate, is_anon: isAnon, is_hidden: isHidden, created_by: user.id, member_count: 1 })
      .select("id")
      .single();

    if (forumErr) throw forumErr;

    // Auto-unir al creador
    const { error: memberErr } = await sb
      .from("forum_members")
      .insert({ forum_id: newForum.id, user_id: user.id, role: "admin" });

    if (memberErr) console.warn("No se pudo unir al creador:", memberErr.message);

    document.getElementById("create-forum-modal").classList.remove("open");
    showToast("Foro creado correctamente", "success");
    loadComunidadesPage();
    loadForosPage();
  } catch (e) {
    console.error("Error al crear foro:", e);
    showToast(e.message || "Error al crear foro", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear";
  }
}

/* ── FOROS (los míos) ────────────────────────────────────────── */
async function loadForosPage() {
  // Si hay un foro abierto, no sobreescribir
  if (_currentForum) return;
  const container = document.getElementById("foros-list");
  if (!container || !AppState.currentUser) return;
  container.innerHTML = skeletonCards(3);

  try {
    const sb = await initSupabase();
    const { data: memberships, error } = await sb.from("forum_members")
      .select("*, forums(id,name,is_anon,is_private,member_count)")
      .eq("user_id", AppState.currentUser.id);
    if (error) throw error;
    // Restaurar la clase grid al volver a la lista
  container.className = "forum-grid";
  container.style.display = "";
  container.innerHTML = memberships && memberships.length
      ? memberships.map(m => renderForumCard(m.forums)).join("")
      : emptyState("Aún no estás en ningún foro", "Explora comunidades para unirte");
  } catch (e) { container.innerHTML = '<p style="color:var(--text-3);padding:1rem">Error: '+e.message+'</p>'; }
}

// Flag para que loadForosPage sepa que hay un foro abierto
let _currentForum = null;

function openForumDetail(forum, membership) {
  _currentForum = forum;
  // Navegar sin llamar al loader automático
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById("page-foros");
  if (target) { target.classList.add("active"); target.scrollTop = 0; }
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.page === "foros"));
  window.history.pushState({ page: "foros" }, "", "#foros");
  Notifs.clearForumBadge(forum.id);

  // Salir del grid para mostrar detalle correctamente
  const container = document.getElementById("foros-list");
  var isForumAdmin = membership && membership.role === "admin";
  var canManage    = isForumAdmin || AppState.hasRole("administrador");

  container.className = "";
  container.style.cssText = "display:block;width:100%;min-width:0";
  container.innerHTML =
    '<div style="margin-bottom:1rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
    +'<button class="btn btn-secondary btn-sm" onclick="_currentForum=null;loadForosPage()">← Mis foros</button>'
    +'<h2 style="font-size:1rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(forum.name)+'</h2>'
    +(forum.is_anon ? '<span class="forum-card-anon">ANÓNIMO</span>' : "")
    +(canManage ? '<button class="btn btn-secondary btn-sm" onclick="openForumAdminModal(\''+(forum.id)+'\')">⚙️ Gestionar</button>' : '')
    +'<button class="btn btn-secondary btn-sm" style="color:#ff4c4c;border-color:rgba(255,76,76,.3)" onclick="leaveForumConfirm(\''+(forum.id)+'\')">✕ Salir</button>'
    +'</div>'
    +'<div id="forum-detail-feed">'+skeletonPosts(2)+'</div>'
    +'<div class="create-post mt-md">'
      +'<div style="display:flex;flex-direction:column;gap:.5rem">'
        +'<textarea class="create-input" id="forum-compose" placeholder="Escribe algo en este foro..." rows="2" style="width:100%;box-sizing:border-box"></textarea>'
        +'<div id="forum-media-preview" style="display:flex;gap:.4rem;flex-wrap:wrap"></div>'
        +'<div style="display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end">'
          +'<label class="btn btn-secondary btn-sm" style="cursor:pointer">'
            +'<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Foto'
            +'<input type="file" accept="image/*" multiple style="display:none" id="forum-images" onchange="previewForumMedia(this,\'image\')">'
          +'</label>'
          +'<label class="btn btn-secondary btn-sm" style="cursor:pointer">'
            +'<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Video'
            +'<input type="file" accept="video/*" style="display:none" id="forum-video" onchange="previewForumMedia(this,\'video\')">'
          +'</label>'
          +'<button class="btn btn-primary btn-sm" id="btn-submit-forum-post" onclick="submitForumPost(\''+forum.id+'\','+forum.is_anon+')">Publicar</button>'
        +'</div>'
      +'</div>'
    +'</div>';

  loadForumPosts(forum.id);
}

function previewForumMedia(input, type) {
  var preview = document.getElementById("forum-media-preview");
  if (!preview) return;
  if (type === "video") {
    var f = input.files[0];
    if (!f) return;
    var url = URL.createObjectURL(f);
    preview.innerHTML = '<video src="'+url+'" style="height:80px;border-radius:6px;object-fit:cover" muted controls></video>';
  } else {
    preview.innerHTML = Array.from(input.files).slice(0,4).map(function(f) {
      return '<img src="'+URL.createObjectURL(f)+'" style="height:55px;border-radius:6px;object-fit:cover">';
    }).join("");
  }
}

async function loadForumPosts(forumId) {
  resetLazy("forum");
  LazyState.forum.id = forumId;
  const feed = document.getElementById("forum-detail-feed");
  if (feed) feed.innerHTML = skeletonPosts(2);
  await fetchForumPage(forumId);
  attachLazySentinel("forum-detail-feed", "forum", function() { fetchForumPage(forumId); });
}

async function fetchForumPage(forumId) {
  const s = LazyState.forum;
  if (s.loading || s.done) return;
  s.loading = true;
  const feed = document.getElementById("forum-detail-feed");
  if (!feed) { s.loading = false; return; }

  var sentinel = feed.querySelector(".lazy-sentinel");
  if (sentinel) sentinel.remove();

  try {
    const sb = await initSupabase();
    const { data: posts, error } = await sb.from("posts")
      .select("*, profiles(username, avatar_url, plan)")
      .eq("section", "forum")
      .eq("forum_id", forumId)
      .order("created_at", { ascending: false })
      .range(s.page * PAGE_SIZE, (s.page + 1) * PAGE_SIZE - 1);
    if (error) throw error;

    let likedIds = new Set();
    if (AppState.currentUser) {
      const { data: lk } = await sb.from("likes").select("post_id").eq("user_id", AppState.currentUser.id);
      if (lk) likedIds = new Set(lk.map(l => l.post_id));
    }

    if (!posts || posts.length === 0) {
      if (s.page === 0) feed.innerHTML = emptyState("Sin publicaciones aún", "Sé el primero en publicar");
      s.done = true;
    } else {
      var html = posts.map(p => renderPost(
        { ...p, user_liked: likedIds.has(p.id) },
        { section: "forum", forumId: forumId, showIdentity: AppState.canDo("canSeeAnonIdentity") }
      )).join("");
      if (s.page === 0) feed.innerHTML = html;
      else feed.insertAdjacentHTML("beforeend", html);
      if (posts.length < PAGE_SIZE) s.done = true;
      s.page++;
    }
  } catch(e) {
    if (s.page === 0) feed.innerHTML = '<p style="color:var(--text-3);padding:1rem;font-size:.85rem">Error: '+e.message+'</p>';
  } finally {
    s.loading = false;
    if (!s.done) attachLazySentinel("forum-detail-feed", "forum", function() { fetchForumPage(forumId); });
  }
}

async function submitForumPost(forumId, isAnon) {
  const user = AppState.currentUser;
  if (!user) { showToast("Debes iniciar sesión", "error"); return; }
  const content = document.getElementById("forum-compose").value.trim();
  if (!content) { showToast("Escribe algo primero", "error"); return; }

  const btn = document.getElementById('btn-submit-forum-post');
  if (btn) { btn.disabled = true; btn.textContent = "Publicando…"; }

  try {
    let images = [];
    let media_url = null;

    // Imágenes — rcwUpload en serie
    const imgInput = document.getElementById("forum-images");
    if (imgInput && imgInput.files && imgInput.files.length) {
      showToast("Subiendo imágenes…");
      var _fimgs = Array.from(imgInput.files).slice(0, 4);
      for (var _k = 0; _k < _fimgs.length; _k++) {
        images.push(await rcwUpload(_fimgs[_k], "image"));
      }
    }

    // Video — rcwUpload directo
    const vidInput = document.getElementById("forum-video");
    if (vidInput && vidInput.files && vidInput.files[0]) {
      showToast("Subiendo video…");
      media_url = await rcwUpload(vidInput.files[0], "video");
    }

    await sbInsertPost({
      section:   "forum",
      forum_id:  forumId,
      user_id:   user.id,
      content,
      images:    images.length > 0 ? images : null,
      media_url: media_url || null,
      is_anon:   isAnon === "true" || isAnon === true,
    });

    document.getElementById("forum-compose").value = "";
    if (imgInput) imgInput.value = "";
    if (vidInput) vidInput.value = "";
    const preview = document.getElementById("forum-media-preview");
    if (preview) preview.innerHTML = "";
    showToast("Publicado ✓", "success");
    await loadForumPosts(forumId);
    // Scroll al tope del feed para ver la nueva publicación
    var feed = document.getElementById("forum-detail-feed");
    if (feed) feed.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    console.error("submitForumPost:", e);
    showToast("Error al publicar: " + (e.message || ""), "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Publicar"; }
  }
}

/* ── PERFIL ──────────────────────────────────────────────────── */
async function loadPerfilPage() {
  const user = AppState.currentUser;
  if (!user) return;

  document.getElementById("profile-username").textContent = user.username || "Usuario";
  document.getElementById("profile-bio").textContent = user.bio || "Sin biografía";
  document.getElementById("profile-role-badge").innerHTML = roleBadge(user.role);
  document.getElementById("profile-plan-badge").innerHTML = user.plan && user.plan !== "free"
    ? '<span class="plan-badge plan-'+user.plan+'">'+user.plan.toUpperCase()+'</span>' : "";

  // Mostrar botón de subir banner si tiene plan N1+ o es admin/propietario
  const canBanner = AppState.hasPlan("n1") || AppState.hasRole("administrador");
  const bannerBtn = document.getElementById("btn-upload-banner-wrap");
  if (bannerBtn) bannerBtn.classList.toggle("hidden", !canBanner);

  // Banner — aplicar color O imagen
  const bannerEl = document.getElementById("profile-banner");
  if (user.banner_url) {
    // Conservar el div del avatar dentro del banner
    const avatarWrap = document.getElementById("profile-avatar-wrap");
    bannerEl.style.background = "";
    // Insertar imagen como background para no desplazar el avatar
    bannerEl.style.backgroundImage = 'url("' + user.banner_url + '")';
    bannerEl.style.backgroundSize = "cover";
    bannerEl.style.backgroundPosition = "center";
  } else {
    bannerEl.style.backgroundImage = "";
    bannerEl.style.background = user.banner_color || "linear-gradient(135deg,var(--accent),var(--accent-2))";
  }

  // Avatar
  const avatarEl = document.getElementById("profile-avatar-img");
  if (user.avatar_url) {
    avatarEl.innerHTML = '<img src="'+user.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
  } else {
    avatarEl.textContent = (user.username || "U")[0].toUpperCase();
  }

  loadProfileGallery(user.id);
  loadProfileForums(user.id);
  renderRequestButtons(user);
}


function makeReqBtn(type, label, extraStyle) {
  var btn = document.createElement("button");
  btn.className = "btn btn-secondary btn-sm w-full";
  if (extraStyle) btn.style.cssText = extraStyle;
  btn.textContent = label;
  btn.onclick = function() { sendRequest(type); };
  return btn;
}
function renderRequestButtons(user) {
  var container = document.getElementById("profile-request-btns");
  if (!container) return;
  container.innerHTML = "";

  var planOrder = ["free","n1","n2","n3"];
  var pidx = planOrder.indexOf(user.plan || "free");
  var count = 0;

  // Solicitar Encargado — solo para usuarios normales
  if (user.role === "usuario") {
    container.appendChild(makeReqBtn("encargado", "Solicitar Rol de Encargado", ""));
    count++;
  }

  // Planes — visibles para TODOS los roles según el plan que ya tienen
  if (pidx < 1) {
    container.appendChild(makeReqBtn("n1", "Solicitar Plan N1",
      "color:#6C63FF;border-color:rgba(108,99,255,.3);background:rgba(108,99,255,.07)"));
    count++;
  }
  if (pidx < 2) {
    container.appendChild(makeReqBtn("n2", "Solicitar Plan N2",
      "color:#FF6B9D;border-color:rgba(255,107,157,.3);background:rgba(255,107,157,.07)"));
    count++;
  }
  if (pidx < 3) {
    container.appendChild(makeReqBtn("n3", "Solicitar Plan N3",
      "color:#FF6B9D;border-color:rgba(255,107,157,.3);background:linear-gradient(135deg,rgba(108,99,255,.08),rgba(255,107,157,.08))"));
    count++;
  }

  // Si tiene plan N3 (máximo) y no es usuario normal, mostrar mensaje
  if (!count) {
    var p = document.createElement("p");
    p.style.cssText = "font-size:.8rem;color:var(--text-3)";
    p.textContent = "Ya tienes el plan máximo (N3).";
    container.appendChild(p);
  }

  // La tarjeta siempre se muestra — siempre hay algo útil aquí
  var card = document.getElementById("profile-requests-card");
  if (card) card.style.display = "";
}

async function loadProfileGallery(userId) {
  const container = document.getElementById("profile-gallery");
  if (!container) return;
  try {
    const sb = await initSupabase();
    const { data: posts } = await sb.from("posts").select("images").eq("user_id", userId).not("images", "is", null);
    const images = posts?.flatMap(p => p.images || []) || [];
    container.innerHTML = images.length
      ? images.slice(0, 9).map(src => `<img src="${src}" onclick="openLightbox('${src}')" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-sm);cursor:pointer">`).join("")
      : `<p style="color:var(--text-3);font-size:.82rem;grid-column:1/-1">Sin imágenes aún</p>`;
  } catch {}
}

async function loadProfileForums(userId) {
  const container = document.getElementById("profile-forums");
  if (!container) return;
  try {
    const sb = await initSupabase();
    const { data } = await sb.from("forum_members").select("forums(name)").eq("user_id", userId);
    container.innerHTML = data?.length
      ? data.map(m => `<span class="plan-badge plan-n1" style="margin:.2rem">${escHtml(m.forums?.name||"")}</span>`).join("")
      : `<p style="color:var(--text-3);font-size:.82rem">Sin foros</p>`;
  } catch {}
}

async function saveProfile() {
  const user = AppState.currentUser;
  if (!user) return;

  const btn = document.getElementById("btn-save-profile");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; }

  try {
    const username = (document.getElementById("edit-username")?.value || "").trim();
    const bio = (document.getElementById("edit-bio")?.value || "").trim();
    const bannerColor = document.getElementById("edit-banner-color")?.value || "#6C63FF";

    const updates = {};
    if (username) updates.username = username;
    updates.bio = bio;
    updates.banner_color = bannerColor;

    const avatarInput = document.getElementById("upload-avatar-modal");
    if (avatarInput && avatarInput.files && avatarInput.files[0]) {
      showToast("Subiendo foto…");
      console.log("[saveProfile] subiendo avatar…");
      updates.avatar_url = await rcwUpload(avatarInput.files[0], "avatar");
      console.log("[saveProfile] avatar_url OK:", updates.avatar_url);
      if (!updates.avatar_url) throw new Error("Cloudinary no devolvió URL de avatar");
    }

    const bannerInput = document.getElementById("upload-banner");
    if (bannerInput && bannerInput.files && bannerInput.files[0]) {
      if (!AppState.hasPlan("n1") && !AppState.hasRole("administrador")) {
        showToast("Necesitas Plan N1 para banner", "error");
      } else {
        showToast("Subiendo banner…");
        console.log("[saveProfile] subiendo banner…");
        updates.banner_url = await rcwUpload(bannerInput.files[0], "banner");
        console.log("[saveProfile] banner_url OK:", updates.banner_url);
        if (!updates.banner_url) throw new Error("Cloudinary no devolvió URL de banner");
      }
    }

    await sbUpdateProfile(updates);

    const newPass = document.getElementById("edit-new-password")?.value || "";
    const confirmPass = document.getElementById("edit-confirm-password")?.value || "";
    if (newPass) {
      if (newPass.length < 6) {
        showToast("La contraseña debe tener al menos 6 caracteres", "error");
      } else if (newPass !== confirmPass) {
        showToast("Las contraseñas no coinciden", "error");
      } else {
        const sb = await initSupabase();
        const { error: passErr } = await sb.auth.updateUser({ password: newPass });
        if (passErr) showToast("Error al cambiar contraseña: " + passErr.message, "error");
        else {
          showToast("Contraseña actualizada", "success");
          if (document.getElementById("edit-new-password")) document.getElementById("edit-new-password").value = "";
          if (document.getElementById("edit-confirm-password")) document.getElementById("edit-confirm-password").value = "";
          const ps = document.getElementById("password-section");
          if (ps) ps.classList.add("hidden");
        }
      }
    }

    AppState.currentUser = Object.assign({}, user, updates);
    renderMenuAccounts();
    showToast("Perfil guardado", "success");
    const modal = document.getElementById("edit-profile-modal");
    if (modal) modal.classList.remove("open");
    loadPerfilPage();

  } catch (e) {
    console.error("saveProfile error:", e);
    showToast((e.message || "Error al guardar perfil"), "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Guardar"; }
  }
}

/* ── ADMIN PANEL ─────────────────────────────────────────────── */
async function loadAdminPage() {
  const user = AppState.currentUser;
  if (!user || !AppState.hasRole("administrador")) {
    navigateTo("inicio");
    return;
  }
  const isOwner = AppState.hasRole("propietario");
  document.getElementById("owner-panel-section").classList.toggle("hidden", !isOwner);
  const ownerPlansTab = document.getElementById("owner-plans-tab");
  if (ownerPlansTab) ownerPlansTab.classList.toggle("hidden", !isOwner);
  const ownerReqTab = document.getElementById("owner-requests-tab");
  if (ownerReqTab) ownerReqTab.classList.toggle("hidden", !isOwner);
  loadAdminUsers();
  if (isOwner) { loadPlanUsers(); loadRequests(); }
}

async function loadAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;
  container.innerHTML = skeletonCards(3);
  try {
    const users = await dbSelect("profiles", { order: "created_at" });
    var isOwner = AppState.hasRole("propietario");
    container.innerHTML = users.map(u => {
      var me = AppState.currentUser;
      var isSelf = me && u.id === me.id;
      var avatarInner = u.avatar_url
        ? '<img src="'+escHtml(u.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : (u.username||"U")[0].toUpperCase();

      var roleSelect = "";
      if (isOwner && !isSelf && u.role !== "propietario") {
        roleSelect = '<select onchange="changeUserRole(\''+u.id+'\',this.value,this)" '
          +'style="background:var(--bg-3);color:var(--text);border:1px solid var(--border);'
          +'border-radius:8px;padding:.25rem .5rem;font-size:.75rem;cursor:pointer;max-width:130px">'
          +'<option value="usuario"'   +(u.role==="usuario"   ?" selected":"")+'>Usuario</option>'
          +'<option value="encargado"'+(u.role==="encargado" ?" selected":"")+'>Encargado</option>'
          +'<option value="administrador"'+(u.role==="administrador"?" selected":"")+'>Admin</option>'
          +'</select>';
      }

      return '<div class="user-list-item" style="gap:.4rem;flex-wrap:wrap">'
        +'<div class="avatar" style="width:36px;height:36px;font-size:.8rem;flex-shrink:0">'+avatarInner+'</div>'
        +'<div class="user-list-info" style="flex:1;min-width:120px">'
          +'<div class="user-list-name">'+escHtml(u.username||"Sin nombre")+'</div>'
          +'<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.2rem;align-items:center">'
            +roleBadge(u.role)
            +(u.plan && u.plan !== "free" ? '<span class="plan-badge plan-'+u.plan+'">'+u.plan.toUpperCase()+'</span>' : '')
            +(u.suspended ? '<span style="font-size:.65rem;color:#ff4c4c;font-weight:700">SUSPENDIDO</span>' : '')
          +'</div>'
        +'</div>'
        +'<div style="display:flex;gap:.3rem;align-items:center;flex-wrap:wrap">'
          +roleSelect
          +(canSuspend(u)
            ? '<button class="btn btn-sm" style="background:rgba(255,76,76,.12);color:#ff4c4c;border:1px solid rgba(255,76,76,.3)" '
              +'onclick="suspendUser(\''+u.id+'\')">'
              +(u.suspended ? "Desuspender" : "Suspender")
              +'</button>'
            : '')
        +'</div>'
      +'</div>';
    }).join("");
  } catch (e) { container.innerHTML = "<p>Error</p>"; }
}

function canSuspend(targetUser) {
  const me = AppState.currentUser;
  if (!me) return false;
  if (me.role === "propietario") return ["usuario", "encargado", "administrador"].includes(targetUser.role) && targetUser.id !== me.id;
  if (me.role === "administrador") return ["usuario", "encargado"].includes(targetUser.role);
  return false;
}

async function suspendUser(userId) {
  try {
    var sb = await initSupabase();
    var { data: u } = await sb.from("profiles").select("suspended,username").eq("id", userId).single();
    if (u && u.suspended) {
      if (!confirm("¿Desuspender a " + (u.username||"este usuario") + "?")) return;
      await sbFetch("/rest/v1/profiles?id=eq."+userId, "PATCH", { suspended: false, suspend_reason: null });
      showToast("Usuario reactivado", "success");
    } else {
      var reason = prompt("Razón de la suspensión:");
      if (!reason) return;
      await sbFetch("/rest/v1/profiles?id=eq."+userId, "PATCH", { suspended: true, suspend_reason: reason });
      showToast("Usuario suspendido", "success");
    }
    loadAdminUsers();
  } catch (e) { showToast("Error: "+(e.message||""), "error"); }
}

async function changeUserRole(userId, newRole, selectEl) {
  if (!AppState.hasRole("propietario")) return;
  if (!newRole) return;
  var prev = selectEl.dataset.prev || selectEl.value;
  try {
    await sbFetch("/rest/v1/profiles?id=eq."+userId, "PATCH", { role: newRole });
    selectEl.dataset.prev = newRole;
    showToast("Rol cambiado a " + newRole + " ✓", "success");
    loadAdminUsers();
  } catch (e) {
    selectEl.value = prev;
    showToast("Error: "+(e.message||""), "error");
  }
}

async function createUserFromPanel() {
  if (!AppState.hasRole("propietario")) return;
  const email = document.getElementById("new-user-email").value.trim();
  const password = document.getElementById("new-user-password").value;
  const username = document.getElementById("new-user-username").value.trim();
  const role = document.getElementById("new-user-role").value;
  if (!email || !password || !username) { showToast("Completa todos los campos", "error"); return; }
  try {
    const { data } = await signUp(email, password, username);
    if (data?.user) await dbUpdate("profiles", data.user.id, { role });
    showToast("Usuario creado", "success");
    loadAdminUsers();
  } catch (e) { showToast(e.message || "Error", "error"); }
}

async function setUserPlan(userId, plan) {
  if (!AppState.hasRole("propietario")) return;
  if (!plan) return;
  try {
    var fields = plan === "free"
      ? { plan: "free", plan_expires: null }
      : { plan: plan, plan_expires: new Date(Date.now() + (CONFIG["PLAN_"+plan.toUpperCase()+"_DAYS"]||30)*86400000).toISOString() };
    await sbFetch("/rest/v1/profiles?id=eq."+userId, "PATCH", fields);
    showToast(plan === "free" ? "Plan revocado" : "Plan "+plan.toUpperCase()+" asignado ✓", "success");
    loadPlanUsers();
    loadAdminUsers();
  } catch (e) { showToast("Error: "+(e.message||""), "error"); }
}

async function loadPlanUsers() {
  const container = document.getElementById("plans-users-list");
  if (!container) return;
  container.innerHTML = skeletonCards(3);
  try {
    const sb = await initSupabase();
    const { data: users, error } = await sb.from("profiles").select("id,username,avatar_url,plan,plan_expires,role").order("created_at");
    if (error) throw error;
    if (!users || !users.length) { container.innerHTML = '<p style="color:var(--text-3);font-size:.85rem">No hay usuarios</p>'; return; }
    container.innerHTML = users.map(u => {
      var planExpiry = u.plan_expires ? new Date(u.plan_expires).toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"}) : null;
      var avatarInner = u.avatar_url
        ? '<img src="'+escHtml(u.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : (u.username||"U")[0].toUpperCase();
      return '<div class="user-list-item" style="flex-wrap:wrap;gap:.5rem">'
        +'<div class="avatar" style="width:34px;height:34px;font-size:.8rem;flex-shrink:0">'+avatarInner+'</div>'
        +'<div class="user-list-info" style="min-width:100px">'
          +'<div class="user-list-name">'+escHtml(u.username||"—")+'</div>'
          +'<div style="display:flex;gap:.3rem;align-items:center;margin-top:.2rem;flex-wrap:wrap">'
            +(u.plan && u.plan !== "free" ? '<span class="plan-badge plan-'+u.plan+'">'+u.plan.toUpperCase()+'</span>' : '<span style="font-size:.72rem;color:var(--text-3)">Sin plan</span>')
            +(planExpiry ? '<span style="font-size:.7rem;color:var(--text-3)">hasta '+planExpiry+'</span>' : '')
          +'</div>'
        +'</div>'
        +'<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-left:auto">'
          +'<select onchange="setUserPlan(\''+u.id+'\',this.value)" style="background:var(--bg-3);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:.3rem .5rem;font-size:.78rem;cursor:pointer">'
            +'<option value="">— Plan —</option>'
            +'<option value="free"'+(u.plan==="free"?" selected":"")+'>Free (revocar)</option>'
            +'<option value="n1"'+(u.plan==="n1"?" selected":"")+'>N1</option>'
            +'<option value="n2"'+(u.plan==="n2"?" selected":"")+'>N2</option>'
            +'<option value="n3"'+(u.plan==="n3"?" selected":"")+'>N3</option>'
          +'</select>'
        +'</div>'
      +'</div>';
    }).join("");
  } catch(e) { container.innerHTML = '<p style="color:var(--text-3)">Error: '+e.message+'</p>'; }
}

/* ── PLANES ──────────────────────────────────────────────────── */
async function loadPlanesPage() {
  const user = AppState.currentUser;
  if (!user) return;
  document.querySelectorAll(".plan-card").forEach(c => {
    c.style.borderColor = c.dataset.plan === user.plan ? "var(--accent)" : "";
  });
}

/* ── HELPERS ─────────────────────────────────────────────────── */
function previewMedia(inputId, previewId, type) {
  var input = document.getElementById(inputId);
  var preview = document.getElementById(previewId);
  if (!input || !preview) return;
  if (type === "video") {
    var f = input.files[0];
    if (!f) return;
    preview.innerHTML = '<video src="'+URL.createObjectURL(f)+'" style="height:80px;border-radius:6px;object-fit:cover" muted controls></video>';
  } else {
    preview.innerHTML = Array.from(input.files).slice(0,4).map(function(f) {
      return '<img src="'+URL.createObjectURL(f)+'" style="height:55px;border-radius:6px;object-fit:cover">';
    }).join("");
  }
}

function skeletonPosts(n) {
  return Array(n).fill(`
    <div class="card post-card">
      <div style="display:flex;gap:.65rem;margin-bottom:.75rem">
        <div class="skeleton" style="width:38px;height:38px;border-radius:50%;flex-shrink:0"></div>
        <div style="flex:1"><div class="skeleton" style="height:14px;width:60%;margin-bottom:.4rem"></div><div class="skeleton" style="height:10px;width:35%"></div></div>
      </div>
      <div class="skeleton" style="height:14px;width:90%;margin-bottom:.35rem"></div>
      <div class="skeleton" style="height:14px;width:75%"></div>
    </div>`).join("");
}

function skeletonCards(n) {
  return `<div class="forum-grid">${Array(n).fill('<div class="forum-card"><div class="skeleton" style="height:14px;width:70%;margin-bottom:.4rem"></div><div class="skeleton" style="height:10px;width:45%"></div></div>').join("")}</div>`;
}

function emptyState(title, desc) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
    <h3>${title}</h3>${desc ? `<p>${desc}</p>` : ""}
  </div>`;
}

function roleBadge(role) {
  const map = { encargado: "Encargado", administrador: "Admin", propietario: "Propietario" };
  if (!map[role]) return "";
  return `<span class="role-badge role-${role}">${map[role]}</span>`;
}

function loadEditForm() {
  const u = AppState.currentUser;
  if (!u) return;
  document.getElementById("edit-username").value = u.username || "";
  document.getElementById("edit-bio").value = u.bio || "";
  const color = u.banner_color || "#6C63FF";
  document.getElementById("edit-banner-color").value = color;
  previewBannerColor(color);

  const prev = document.getElementById("edit-avatar-preview");
  if (prev) {
    if (u.avatar_url) {
      prev.innerHTML = `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      prev.textContent = (u.username || "U")[0].toUpperCase();
    }
  }

  const bannerField = document.getElementById("banner-image-field");
  if (bannerField) bannerField.classList.toggle("hidden", !AppState.hasPlan("n1"));

  const passSection = document.getElementById("password-section");
  if (passSection) passSection.classList.add("hidden");
  const np = document.getElementById("edit-new-password");
  if (np) np.value = "";
  const cp = document.getElementById("edit-confirm-password");
  if (cp) cp.value = "";
}

function previewBannerColor(value) {
  const preview = document.getElementById("banner-color-preview");
  if (preview) preview.style.background = value;
}

function previewAvatarModal(input) {
  if (!input.files[0]) return;
  const prev = document.getElementById("edit-avatar-preview");
  if (!prev) return;
  const url = URL.createObjectURL(input.files[0]);
  prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
}

function togglePasswordSection() {
  const section = document.getElementById("password-section");
  const btn = document.getElementById("btn-toggle-password");
  if (!section) return;
  const isHidden = section.classList.contains("hidden");
  section.classList.toggle("hidden", !isHidden);
  btn.textContent = isHidden ? "Cancelar cambio de contraseña" : "Cambiar contraseña";
}

// Admin tab switching
document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".admin-panel-section").forEach(s => s.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab)?.classList.add("active");
  });
});

// Image preview for inicio
document.getElementById("inicio-images")?.addEventListener("change", function() {
  const preview = document.getElementById("inicio-media-preview");
  if (!preview) return;
  preview.innerHTML = Array.from(this.files).slice(0,4).map(f => {
    const url = URL.createObjectURL(f);
    return `<img src="${url}" style="height:60px;border-radius:6px;object-fit:cover">`;
  }).join("");
});

async function addToWhitelist() {
  const email = document.getElementById("whitelist-email").value.trim();
  if (!email) return;
  try {
    await dbInsert("whitelist", { email });
    document.getElementById("whitelist-email").value = "";
    loadWhitelist();
    showToast("Correo añadido a la lista blanca", "success");
  } catch (e) { showToast("Error", "error"); }
}

async function loadWhitelist() {
  const container = document.getElementById("whitelist-list");
  if (!container) return;
  try {
    const entries = await dbSelect("whitelist", { order: "created_at" });
    container.innerHTML = entries.map(e => `
      <div class="user-list-item">
        <span style="flex:1;font-size:.85rem">${escHtml(e.email)}</span>
        <button class="btn btn-danger btn-sm" onclick="removeWhitelist('${e.id}')">✕</button>
      </div>`).join("") || `<p style="font-size:.82rem;color:var(--text-3)">Sin correos aún</p>`;
  } catch {}
}

async function removeWhitelist(id) {
  await dbDelete("whitelist", id);
  loadWhitelist();
}

function filterForums(query) {
  const q = query.toLowerCase();
  document.querySelectorAll("#comunidades-grid .forum-card").forEach(card => {
    const name = card.querySelector(".forum-card-name")?.textContent.toLowerCase() || "";
    card.style.display = name.includes(q) ? "" : "none";
  });
}

/* ══════════════════════════════════════════════════════════════
   FORO — Gestión de miembros
══════════════════════════════════════════════════════════════ */
async function openForumAdminModal(forumId) {
  var modal = document.getElementById("forum-admin-modal");
  if (!modal) return;
  modal.dataset.forumId = forumId;
  modal.classList.add("open");
  loadForumMembers(forumId);
}

async function loadForumMembers(forumId) {
  var list = document.getElementById("forum-members-list");
  if (!list) return;
  list.innerHTML = skeletonCards(3);
  try {
    var sb = await initSupabase();
    var { data, error } = await sb.from("forum_members")
      .select("*, profiles(id, username, avatar_url, role)")
      .eq("forum_id", forumId);
    if (error) throw error;
    var me = AppState.currentUser;
    list.innerHTML = (data||[]).map(function(m) {
      var p = m.profiles || {};
      var av = p.avatar_url
        ? '<img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : (p.username||"U")[0].toUpperCase();
      var isSelf = me && p.id === me.id;
      return '<div class="user-list-item">'
        +'<div class="avatar" style="width:32px;height:32px;font-size:.75rem;flex-shrink:0">'+av+'</div>'
        +'<div class="user-list-info"><div class="user-list-name">'+escHtml(p.username||"—")+'</div>'
          +'<div style="font-size:.72rem;color:var(--text-3)">'+(m.role==="admin"?"Admin del foro":"Miembro")+'</div>'
        +'</div>'
        +(!isSelf
          ? '<button class="btn btn-danger btn-sm" onclick="kickForumMember(\''+forumId+'\',\''+p.id+'\')">Expulsar</button>'
          : '')
      +'</div>';
    }).join("") || '<p style="color:var(--text-3);font-size:.82rem">Sin miembros</p>';
  } catch(e) {
    list.innerHTML = '<p style="color:var(--text-3)">Error: '+e.message+'</p>';
  }
}

async function kickForumMember(forumId, userId) {
  if (!confirm("¿Expulsar a este miembro del foro?")) return;
  try {
    await sbFetch("/rest/v1/forum_members?forum_id=eq."+forumId+"&user_id=eq."+userId, "DELETE");
    showToast("Miembro expulsado", "success");
    loadForumMembers(forumId);
  } catch(e) { showToast("Error: "+e.message, "error"); }
}

async function inviteToForum(forumId) {
  var usernameInput = document.getElementById("forum-invite-username");
  if (!usernameInput) return;
  var username = usernameInput.value.trim();
  if (!username) { showToast("Escribe un nombre de usuario", "error"); return; }
  try {
    var sb = await initSupabase();
    var { data: profile } = await sb.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!profile) { showToast("Usuario '"+username+"' no encontrado", "error"); return; }
    await sbFetch("/rest/v1/forum_members", "POST", { forum_id: forumId, user_id: profile.id, role: "member" });
    usernameInput.value = "";
    showToast("Usuario añadido al foro ✓", "success");
    loadForumMembers(forumId);
  } catch(e) { showToast("Error: "+e.message, "error"); }
}

async function uploadForumPhoto(forumId, input) {
  if (!input.files[0]) return;
  showToast("Subiendo foto del foro…");
  try {
    var url = await rcwUpload(input.files[0], "image");
    await sbFetch("/rest/v1/forums?id=eq."+forumId, "PATCH", { photo_url: url });
    showToast("Foto del foro actualizada ✓", "success");
    loadComunidadesPage();
  } catch(e) { showToast("Error: "+e.message, "error"); }
}

async function leaveForumConfirm(forumId) {
  if (!confirm("¿Salir de este foro?")) return;
  try {
    var userId = AppState.currentUser.id;
    await sbFetch("/rest/v1/forum_members?forum_id=eq."+forumId+"&user_id=eq."+userId, "DELETE");
    _currentForum = null;
    showToast("Saliste del foro", "success");
    loadForosPage();
  } catch(e) { showToast("Error: "+e.message, "error"); }
}

/* ══════════════════════════════════════════════════════════════
   GRUPO DE NOTICIAS — Gestión
══════════════════════════════════════════════════════════════ */
function openNewsGroupAdmin(groupId) {
  var modal = document.getElementById("news-group-admin-modal");
  if (!modal) return;
  modal.dataset.groupId = groupId;
  modal.classList.add("open");
}

async function uploadNewsGroupPhoto(input) {
  var modal = document.getElementById("news-group-admin-modal");
  if (!input.files[0] || !modal) return;
  var groupId = modal.dataset.groupId;
  showToast("Subiendo foto del grupo…");
  try {
    var url = await rcwUpload(input.files[0], "image");
    await sbFetch("/rest/v1/news_groups?id=eq."+groupId, "PATCH", { photo_url: url });
    showToast("Foto del grupo actualizada ✓", "success");
    loadNoticiasPage();
  } catch(e) { showToast("Error: "+e.message, "error"); }
}

async function renameNewsGroup() {
  var modal = document.getElementById("news-group-admin-modal");
  if (!modal) return;
  var input = document.getElementById("news-group-rename");
  var name = input && input.value.trim();
  if (!name) { showToast("Escribe un nombre", "error"); return; }
  try {
    await sbFetch("/rest/v1/news_groups?id=eq."+modal.dataset.groupId, "PATCH", { name: name });
    showToast("Grupo renombrado ✓", "success");
    modal.classList.remove("open");
    loadNoticiasPage();
  } catch(e) { showToast("Error: "+e.message, "error"); }
}

async function deleteNewsGroup() {
  var modal = document.getElementById("news-group-admin-modal");
  if (!modal || !confirm("¿Eliminar este grupo y todas sus publicaciones?")) return;
  try {
    await sbFetch("/rest/v1/news_groups?id=eq."+modal.dataset.groupId, "DELETE");
    modal.classList.remove("open");
    showToast("Grupo eliminado", "success");
    loadNoticiasPage();
  } catch(e) { showToast("Error: "+e.message, "error"); }
}

/* ══════════════════════════════════════════════════════════════
   SOLICITUDES
══════════════════════════════════════════════════════════════ */
async function sendRequest(type) {
  var user = AppState.currentUser;
  if (!user) { showToast("Debes iniciar sesión", "error"); return; }

  if (type === "encargado" && AppState.hasRole("encargado")) {
    showToast("Ya eres Encargado o tienes un rol superior", "info"); return;
  }
  if (type !== "encargado" && AppState.hasPlan(type)) {
    showToast("Ya tienes ese plan o uno superior", "info"); return;
  }

  var labels = { encargado:"Rol de Encargado", n1:"Plan N1", n2:"Plan N2", n3:"Plan N3" };
  var reason = prompt("¿Por qué solicitas " + (labels[type]||type) + "? (opcional)");
  if (reason === null) return;

  try {
    await sbFetch("/rest/v1/requests", "POST", {
      user_id:      user.id,
      username:     user.username,
      request_type: type,
      reason:       reason || "",
      status:       "pending",
    });
    showToast("Solicitud enviada. El propietario la revisará.", "success");
  } catch(e) {
    showToast("Error al enviar solicitud: " + (e.message||""), "error");
  }
}

async function loadRequests() {
  var container = document.getElementById("requests-list");
  if (!container) return;
  container.innerHTML = skeletonCards(2);
  try {
    var sb = await initSupabase();
    var { data, error } = await sb.from("requests")
      .select("*, profiles(username, avatar_url)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!data || !data.length) {
      container.innerHTML = '<p style="color:var(--text-3);font-size:.85rem;padding:.5rem 0">Sin solicitudes pendientes</p>';
      return;
    }
    var labels = { encargado:"Rol Encargado", n1:"Plan N1", n2:"Plan N2", n3:"Plan N3" };
    container.innerHTML = data.map(function(r) {
      var p = r.profiles || {};
      var av = p.avatar_url
        ? '<img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : (p.username||"U")[0].toUpperCase();
      return '<div class="user-list-item" style="flex-wrap:wrap;gap:.4rem">'
        +'<div class="avatar" style="width:34px;height:34px;font-size:.8rem;flex-shrink:0">'+av+'</div>'
        +'<div class="user-list-info" style="flex:1;min-width:120px">'
          +'<div class="user-list-name">'+escHtml(p.username||"—")+'</div>'
          +'<div style="font-size:.8rem;color:var(--text-2);margin-top:.15rem">'
            +'Solicita: <strong>'+(labels[r.request_type]||r.request_type)+'</strong>'
          +'</div>'
          +(r.reason ? '<div style="font-size:.75rem;color:var(--text-3);margin-top:.15rem;font-style:italic">&ldquo;'+escHtml(r.reason)+'&rdquo;</div>' : '')
        +'</div>'
        +'<div style="display:flex;gap:.3rem">'
          +'<button class="btn btn-primary btn-sm" onclick="resolveRequest(\''+r.id+'\',\''+r.user_id+'\',\''+r.request_type+'\',true)">Aprobar</button>'
          +'<button class="btn btn-secondary btn-sm" onclick="resolveRequest(\''+r.id+'\',\''+r.user_id+'\',\''+r.request_type+'\',false)">Rechazar</button>'
        +'</div>'
      +'</div>';
    }).join("");
  } catch(e) {
    container.innerHTML = '<p style="color:var(--text-3)">Error: '+e.message+'</p>';
  }
}

async function resolveRequest(reqId, userId, type, approve) {
  try {
    if (approve) {
      var fields = {};
      if (type === "encargado") {
        fields.role = "encargado";
      } else if (["n1","n2","n3"].includes(type)) {
        var days = CONFIG["PLAN_"+type.toUpperCase()+"_DAYS"] || 30;
        fields.plan = type;
        fields.plan_expires = new Date(Date.now() + days*86400000).toISOString();
      }
      if (Object.keys(fields).length) {
        await sbFetch("/rest/v1/profiles?id=eq."+userId, "PATCH", fields);
      }
    }
    await sbFetch("/rest/v1/requests?id=eq."+reqId, "PATCH", {
      status: approve ? "approved" : "rejected"
    });
    showToast(approve ? "Solicitud aprobada ✓" : "Solicitud rechazada", approve ? "success" : "info");
    loadRequests();
    if (approve) loadAdminUsers();
  } catch(e) { showToast("Error: "+(e.message||""), "error"); }
}