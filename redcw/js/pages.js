// ============================================================
//  RedCW — Page Loaders
// ============================================================

/* ── INICIO ─────────────────────────────────────────────────── */
async function loadInicioPage() {
  const feed = document.getElementById("inicio-feed");
  if (!feed) return;
  feed.innerHTML = skeletonPosts(3);

  try {
    const posts = await dbSelect("posts", {
      eq: { section: "inicio" },
      order: "created_at",
      limit: 30,
      select: "*, profiles(username, avatar_url, plan, role)",
    });

    // Check likes for current user
    const user = AppState.currentUser;
    let likedIds = new Set();
    if (user) {
      const likes = await dbSelect("likes", { eq: { user_id: user.id } });
      likedIds = new Set(likes.map(l => l.post_id));
    }

    feed.innerHTML = posts.length
      ? posts.map(p => renderPost({ ...p, user_liked: likedIds.has(p.id) }, { section: "inicio", showIdentity: AppState.canDo("canSeeAnonIdentity") })).join("")
      : emptyState("Aún no hay publicaciones", "Sé el primero en compartir algo");
  } catch (e) {
    feed.innerHTML = `<div class="empty-state"><p>Error al cargar el feed</p></div>`;
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

    // Imágenes
    const fileInput = document.getElementById("inicio-images");
    if (fileInput && fileInput.files && fileInput.files.length) {
      showToast("Subiendo imágenes…");
      try { images = await uploadMultipleImages(fileInput.files, 4); }
      catch (e) { showToast("Error subiendo imágenes: " + (e.message || ""), "error"); }
    }

    // Video
    const vidInput = document.getElementById("inicio-video");
    if (vidInput && vidInput.files && vidInput.files[0]) {
      showToast("Subiendo video…");
      try { media_url = await uploadVideo(vidInput.files[0]); }
      catch (e) { showToast("Error subiendo video: " + (e.message || ""), "error"); }
    }

    const isAnon = document.getElementById("inicio-anon")?.checked && canPostAnon();

    const sb = await initSupabase();
    const { error } = await sb.from("posts").insert({
      section: "inicio",
      user_id: user.id,
      content,
      images: images.length > 0 ? images : null,
      media_url: media_url || null,
      is_anon: isAnon,
    });
    if (error) throw error;

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
        limit: 1,
        select: "*, profiles(username, avatar_url, plan)",
      });
      if (!posts.length) continue;
      html += `<div class="news-group">
        <div class="news-group-header">
          <div class="news-group-dot"></div>
          <span class="news-group-name">${escHtml(g.name)}</span>
          ${canPost ? `<button class="btn btn-sm btn-primary" onclick="openNewsPostModal('${g.id}')">+ Publicar</button>` : ""}
        </div>
        ${posts.map(p => renderPost(p, { section: "noticias", showIdentity: AppState.canDo("canSeeAnonIdentity") })).join("")}
      </div>`;
    }
    feed.innerHTML = html || emptyState("Sin publicaciones recientes", "");
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
      images = await uploadMultipleImages(fileInput.files, 4);
    }
    const vidInput = document.getElementById("news-post-video");
    if (vidInput && vidInput.files && vidInput.files[0]) {
      showToast("Subiendo video…");
      media_url = await uploadVideo(vidInput.files[0]);
    }
    const sb = await initSupabase();
    const { error } = await sb.from("posts").insert({
      section: "noticias",
      news_group_id: m.dataset.groupId,
      user_id: AppState.currentUser.id,
      content,
      images: images.length > 0 ? images : null,
      media_url: media_url || null,
    });
    if (error) throw error;
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
  const sb = await initSupabase();
  const { data: forum, error: forumErr } = await sb.from("forums").select("*").eq("id", forumId).single();
  if (forumErr || !forum) { showToast("No se pudo cargar el foro", "error"); return; }

  if (forum.is_private) {
    const user = AppState.currentUser;
    if (!user) { showToast("Debes iniciar sesión", "error"); return; }
    // Usar .maybeSingle() para no arrojar error si no existe
    const { data: member } = await sb.from("forum_members")
      .select("id")
      .eq("forum_id", forumId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) { showToast("Este foro es privado. Necesitas invitación.", "error"); return; }
  }

  openForumDetail(forum);
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

function openForumDetail(forum) {
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
  container.className = "";
  container.style.cssText = "display:block;width:100%;min-width:0";
  container.innerHTML =
    '<div style="margin-bottom:1rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
    +'<button class="btn btn-secondary btn-sm" onclick="_currentForum=null;loadForosPage()">\u2190 Mis foros</button>'
    +'<h2 style="font-size:1rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(forum.name)+'</h2>'
    +(forum.is_anon ? '<span class="forum-card-anon">AN\u00d3NIMO</span>' : "")
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
  const feed = document.getElementById("forum-detail-feed");
  if (!feed) return;
  try {
    const sb = await initSupabase();
    const { data: posts, error } = await sb.from("posts")
      .select("*, profiles(username, avatar_url, plan)")
      .eq("section", "forum")
      .eq("forum_id", forumId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;

    // Likes del usuario actual
    let likedIds = new Set();
    if (AppState.currentUser) {
      const { data: lk } = await sb.from("likes").select("post_id").eq("user_id", AppState.currentUser.id);
      if (lk) likedIds = new Set(lk.map(l => l.post_id));
    }

    feed.innerHTML = posts && posts.length
      ? posts.map(p => renderPost(
          { ...p, user_liked: likedIds.has(p.id) },
          { section: "forum", forumId: forumId, showIdentity: AppState.canDo("canSeeAnonIdentity") }
        )).join("")
      : emptyState("Sin publicaciones aún", "Sé el primero en publicar");
  } catch (e) {
    feed.innerHTML = '<p style="color:var(--text-3);padding:1rem;font-size:.85rem">Error: '+e.message+'</p>';
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

    // Imágenes
    const imgInput = document.getElementById("forum-images");
    if (imgInput && imgInput.files && imgInput.files.length) {
      showToast("Subiendo imágenes…");
      images = await uploadMultipleImages(imgInput.files, 4);
    }

    // Video
    const vidInput = document.getElementById("forum-video");
    if (vidInput && vidInput.files && vidInput.files[0]) {
      showToast("Subiendo video…");
      media_url = await uploadVideo(vidInput.files[0]);
    }

    const sb = await initSupabase();
    const { error } = await sb.from("posts").insert({
      section: "forum",
      forum_id: forumId,
      user_id: user.id,
      content,
      images: images.length > 0 ? images : null,
      media_url: media_url || null,
      is_anon: isAnon === "true" || isAnon === true,
    });
    if (error) throw error;

    document.getElementById("forum-compose").value = "";
    if (imgInput) imgInput.value = "";
    if (vidInput) vidInput.value = "";
    const preview = document.getElementById("forum-media-preview");
    if (preview) preview.innerHTML = "";
    showToast("Publicado", "success");
    loadForumPosts(forumId);
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

    // Avatar desde el modal
    const avatarInput = document.getElementById("upload-avatar-modal");
    if (avatarInput && avatarInput.files && avatarInput.files[0]) {
      showToast("Subiendo foto de perfil…");
      updates.avatar_url = await uploadAvatar(avatarInput.files[0]);
      console.log("[saveProfile] avatar_url guardado:", updates.avatar_url);
    }

    // Banner imagen (solo N1+)
    const bannerInput = document.getElementById("upload-banner");
    if (bannerInput && bannerInput.files && bannerInput.files[0]) {
      if (!AppState.hasPlan("n1") && !AppState.hasRole("administrador")) {
        showToast("Necesitas Plan N1 para subir imagen de banner", "error");
      } else {
        showToast("Subiendo banner…");
        updates.banner_url = await uploadBanner(bannerInput.files[0]);
        console.log("[saveProfile] banner_url guardado:", updates.banner_url);
      }
    }

    // Guardar en Supabase sin .select() para evitar bloqueo RLS
    const sb = await initSupabase();
    const { error: updateErr } = await sb
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (updateErr) throw updateErr;

    // Cambio de contraseña
    const newPass = document.getElementById("edit-new-password")?.value || "";
    const confirmPass = document.getElementById("edit-confirm-password")?.value || "";
    if (newPass) {
      if (newPass.length < 6) {
        showToast("La contraseña debe tener al menos 6 caracteres", "error");
      } else if (newPass !== confirmPass) {
        showToast("Las contraseñas no coinciden", "error");
      } else {
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

    // Actualizar AppState localmente con los cambios que aplicamos
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
  document.getElementById("owner-panel-section").classList.toggle("hidden", !AppState.hasRole("propietario"));
  loadAdminUsers();
}

async function loadAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;
  container.innerHTML = skeletonCards(3);
  try {
    const users = await dbSelect("profiles", { order: "created_at" });
    container.innerHTML = users.map(u => `
      <div class="user-list-item">
        <div class="avatar" style="width:34px;height:34px;font-size:.8rem">${(u.username||"U")[0].toUpperCase()}</div>
        <div class="user-list-info">
          <div class="user-list-name">${escHtml(u.username||"Sin nombre")}</div>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.2rem">
            ${roleBadge(u.role)}
            ${u.plan && u.plan !== "free" ? `<span class="plan-badge plan-${u.plan}">${u.plan.toUpperCase()}</span>` : ""}
          </div>
        </div>
        ${canSuspend(u) ? `<button class="btn btn-danger btn-sm" onclick="suspendUser('${u.id}')">Suspender</button>` : ""}
      </div>`).join("");
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
  const reason = prompt("Razón de la suspensión:");
  if (!reason) return;
  try {
    await dbUpdate("profiles", userId, { suspended: true, suspend_reason: reason });
    showToast("Usuario suspendido", "success");
    loadAdminUsers();
  } catch (e) { showToast("Error", "error"); }
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
  const days = CONFIG[`PLAN_${plan.toUpperCase()}_DAYS`] || 30;
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  try {
    await dbUpdate("profiles", userId, { plan, plan_expires: expires });
    showToast(`Plan ${plan.toUpperCase()} asignado`, "success");
    loadAdminUsers();
  } catch (e) { showToast("Error", "error"); }
}

/* ── PLANES ──────────────────────────────────────────────────── */
async function loadPlanesPage() {
  // Data is static (rendered in HTML), just mark current plan
  const user = AppState.currentUser;
  if (!user) return;
  document.querySelectorAll(".plan-card").forEach(c => {
    c.style.borderColor = c.dataset.plan === user.plan ? "var(--accent)" : "";
  });
}

/* ── HELPERS ─────────────────────────────────────────────────── */
/* ── previewMedia: helper global para previews de archivo ───── */
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
  const preview = document.getElementById("inicio-image-preview");
  preview.innerHTML = Array.from(this.files).slice(0,4).map(f => {
    const url = URL.createObjectURL(f);
    return `<img src="${url}" style="height:60px;border-radius:6px;object-fit:cover">`;
  }).join("");
});

// ── Helpers del modal de edición de perfil ───────────────────

function loadEditForm() {
  const u = AppState.currentUser;
  if (!u) return;
  document.getElementById("edit-username").value = u.username || "";
  document.getElementById("edit-bio").value = u.bio || "";
  const color = u.banner_color || "#6C63FF";
  document.getElementById("edit-banner-color").value = color;
  previewBannerColor(color);

  // Avatar preview
  const prev = document.getElementById("edit-avatar-preview");
  if (prev) {
    if (u.avatar_url) {
      prev.innerHTML = `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      prev.textContent = (u.username || "U")[0].toUpperCase();
    }
  }

  // Banner imagen solo si tiene plan
  const bannerField = document.getElementById("banner-image-field");
  if (bannerField) bannerField.classList.toggle("hidden", !AppState.hasPlan("n1"));

  // Ocultar sección contraseña
  const passSection = document.getElementById("password-section");
  if (passSection) passSection.classList.add("hidden");
  const newPassInput = document.getElementById("edit-new-password");
  if (newPassInput) newPassInput.value = "";
  const confPassInput = document.getElementById("edit-confirm-password");
  if (confPassInput) confPassInput.value = "";
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
