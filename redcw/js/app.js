// ============================================================
//  RedCW — App Core (router, UI helpers, theme, notificaciones)
// ============================================================

/* ── Theme ─────────────────────────────────────────────────── */
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("rcw_theme", t);
  AppState.theme = t;
  const track = document.querySelector(".toggle-track");
  if (track) track.classList.toggle("on", t === "light");
}
applyTheme(AppState.theme);

/* ── Router ────────────────────────────────────────────────── */
const PAGES = ["inicio","noticias","comunidades","foros","perfil","admin","login","register","planes"];

function navigateTo(pageId, opts = {}) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById("page-" + pageId);
  if (target) { target.classList.add("active"); target.scrollTop = 0; }

  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === pageId);
  });

  const noLayout = ["login","register"].includes(pageId);
  document.getElementById("app-header").style.display = noLayout ? "none" : "";
  document.getElementById("app-nav").style.display = noLayout ? "none" : "";
  document.body.style.paddingTop = noLayout ? "0" : "";
  document.body.style.paddingBottom = noLayout ? "0" : "";

  window.history.pushState({ page: pageId }, "", "#" + pageId);
  Notifs.clearBadge(pageId);

  const loaders = {
    inicio: loadInicioPage, noticias: loadNoticiasPage,
    comunidades: loadComunidadesPage, foros: loadForosPage,
    perfil: loadPerfilPage, admin: loadAdminPage, planes: loadPlanesPage,
  };
  if (loaders[pageId]) loaders[pageId]();
}

window.addEventListener("popstate", (e) => navigateTo(e.state?.page || "inicio"));

/* ── Toasts ─────────────────────────────────────────────────── */
function showToast(msg, type, duration) {
  type = type || "info"; duration = duration || 3200;
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(function() {
    t.style.transition = ".25s ease";
    t.style.opacity = "0";
    t.style.transform = "translateY(6px) scale(.95)";
    setTimeout(function() { t.remove(); }, 280);
  }, duration);
}

/* ── Lightbox ───────────────────────────────────────────────── */
function openLightbox(src) {
  var lb = document.getElementById("lightbox");
  lb.querySelector("img").src = src;
  lb.classList.add("open");
}
document.getElementById("lightbox") && document.getElementById("lightbox").addEventListener("click", function() {
  document.getElementById("lightbox").classList.remove("open");
});

/* ── Drawer ─────────────────────────────────────────────────── */
function openMenu() {
  var drawer = document.getElementById("menu-drawer");
  drawer.closest(".drawer-overlay").classList.add("open");
  renderMenuAccounts();
}
function closeMenu() {
  var drawer = document.getElementById("menu-drawer");
  drawer.closest(".drawer-overlay").classList.remove("open");
}

function renderMenuAccounts() {
  var user = AppState.currentUser;
  if (!user) return;
  var chip = document.querySelector(".session-chip .chip-name");
  var chipAv = document.querySelector(".session-chip .avatar-xs");
  if (chip) chip.textContent = user.username || "Usuario";
  if (chipAv) chipAv.innerHTML = user.avatar_url
    ? '<img src="'+user.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : (user.username || "U")[0].toUpperCase();
  var planEl = document.getElementById("menu-plan-info");
  if (planEl) planEl.innerHTML = (user.plan && user.plan !== "free")
    ? '<span class="plan-badge plan-'+user.plan+'">'+user.plan.toUpperCase()+'</span>' : "";
  var mu = document.getElementById("menu-username");
  var ma = document.getElementById("menu-avatar");
  if (mu) mu.textContent = user.username || "Usuario";
  if (ma) ma.innerHTML = user.avatar_url
    ? '<img src="'+user.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : (user.username || "U")[0].toUpperCase();
}

var themeToggle = document.getElementById("theme-toggle-track");
if (themeToggle) themeToggle.addEventListener("click", function() {
  applyTheme(AppState.theme === "dark" ? "light" : "dark");
});

var drawerOverlay = document.querySelector(".drawer-overlay");
if (drawerOverlay) drawerOverlay.addEventListener("click", function(e) {
  if (e.target === e.currentTarget) closeMenu();
});

/* ── Nav items ──────────────────────────────────────────────── */
document.querySelectorAll(".nav-item").forEach(function(item) {
  item.addEventListener("click", function() {
    var page = item.dataset.page;
    if (!AppState.currentUser && !["login","register"].includes(page)) {
      showToast("Inicia sesión para continuar", "error");
      navigateTo("login");
      return;
    }
    navigateTo(page);
  });
});

var sessionChip = document.querySelector(".session-chip");
if (sessionChip) sessionChip.addEventListener("click", function() { navigateTo("perfil"); });

/* ── Render post ─────────────────────────────────────────────── */
function renderPost(post, opts) {
  opts = opts || {};
  var user = AppState.currentUser;
  var isAnon = post.is_anon && !opts.showIdentity;
  var authorName = isAnon ? "Anónimo" : (post.profiles && post.profiles.username ? post.profiles.username : "Usuario");
  var authorAvatar = isAnon ? null : (post.profiles && post.profiles.avatar_url);
  var nameClass = planNameClass(post.profiles && post.profiles.plan);
  var initials = authorName[0].toUpperCase();
  var section = opts.section || "inicio";
  var forumId = opts.forumId || "";

  var imagesHtml = "";
  if (post.images && post.images.length) {
    var count = Math.min(post.images.length, 4);
    imagesHtml = "<div class=\"post-images count-"+count+"\">"; 
    for (var i = 0; i < count; i++) {
      var imgSrc = post.images[i];
      if (typeof cloudinaryOptimizedUrl === "function") imgSrc = cloudinaryOptimizedUrl(imgSrc, {width:800});
      imagesHtml += "<img src=\""+imgSrc+"\" class=\"img-"+i+"\" loading=\"lazy\" alt=\"\" onclick=\"openLightbox('"+post.images[i]+"')\">";
    }
    imagesHtml += "</div>";
  }
  if (post.media_url) {
    imagesHtml += "<video src=\""+post.media_url+"\" controls style=\"width:100%;border-radius:var(--radius-sm);margin-bottom:.75rem;max-height:300px;background:#000\" preload=\"metadata\"></video>";
  }

  var canDelete = user && (user.id === post.user_id || user.role === "administrador" || user.role === "propietario");
  var deleteBtn = canDelete
    ? '<button class="btn-icon" onclick="deletePost(\''+post.id+'\',\''+section+'\',\''+forumId+'\')">'
      +'<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>'
      +'</button>'
    : "";

  var avatarHtml = authorAvatar
    ? '<img src="'+authorAvatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : initials;

  return '<div class="card post-card" data-post-id="'+post.id+'">'
    +'<div class="post-header">'
      +'<div class="avatar">'+avatarHtml+'</div>'
      +'<div class="post-meta">'
        +'<div class="post-author '+nameClass+'">'+escHtml(authorName)+'</div>'
        +'<div class="post-time">'+timeAgo(post.created_at)+'</div>'
      +'</div>'
      +deleteBtn
    +'</div>'
    +'<div class="post-body">'+escHtml(post.content)+'</div>'
    +imagesHtml
    +'<div class="post-actions">'
      +'<button class="btn-action '+(post.user_liked?"liked":"")+'" onclick="toggleLike(\''+post.id+'\',\''+section+'\',\''+forumId+'\',this)">'
        +'<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.8z"/></svg>'
        +'<span class="like-count">'+(post.likes_count||0)+'</span>'
      +'</button>'
      +'<button class="btn-action" onclick="openComments(\''+post.id+'\',\''+section+'\',\''+forumId+'\')">'
        +'<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
        +'<span>'+(post.comments_count||0)+'</span>'
      +'</button>'
    +'</div>'
  +'</div>';
}

function planNameClass(plan) {
  if (plan === "n1") return "color-n1";
  if (plan === "n2") return "color-n2";
  if (plan === "n3") return "color-n3";
  return "";
}
function escHtml(str) {
  return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  var diff = Date.now() - new Date(dateStr);
  var s = Math.floor(diff/1000);
  if (s < 60) return "ahora";
  var m = Math.floor(s/60); if (m < 60) return m+"m";
  var h = Math.floor(m/60); if (h < 24) return h+"h";
  var d = Math.floor(h/24); if (d < 7) return d+"d";
  return new Date(dateStr).toLocaleDateString("es",{day:"2-digit",month:"short"});
}

/* ── Like: optimista, sin .single() ─────────────────────────── */
async function toggleLike(postId, section, forumId, btn) {
  if (!AppState.currentUser) { showToast("Inicia sesión", "error"); return; }
  var isLiked = btn.classList.contains("liked");
  btn.classList.toggle("liked", !isLiked);
  var countEl = btn.querySelector(".like-count");
  var prev = parseInt(countEl.textContent) || 0;
  countEl.textContent = isLiked ? Math.max(prev-1,0) : prev+1;
  try {
    var sb = await initSupabase();
    var uid = AppState.currentUser.id;
    if (isLiked) {
      var res = await sb.from("likes").delete().eq("post_id",postId).eq("user_id",uid);
      if (res.error) throw res.error;
    } else {
      var res2 = await sb.from("likes").insert({post_id:postId,user_id:uid});
      if (res2.error) throw res2.error;
    }
  } catch(e) {
    btn.classList.toggle("liked", isLiked);
    countEl.textContent = prev;
    console.error("toggleLike:", e.message);
    showToast("Error al reaccionar: "+(e.message||""), "error");
  }
}

/* ── Delete ──────────────────────────────────────────────────── */
async function deletePost(postId, section, forumId) {
  if (!confirm("¿Eliminar esta publicación?")) return;
  try {
    var sb = await initSupabase();
    var res = await sb.from("posts").delete().eq("id",postId);
    if (res.error) throw res.error;
    showToast("Publicación eliminada", "success");
    if (section === "forum" && forumId) {
      loadForumPosts(forumId);
    } else {
      var loaders = {inicio:loadInicioPage, noticias:loadNoticiasPage};
      if (loaders[section]) loaders[section]();
    }
  } catch(e) { showToast("Error al eliminar: "+(e.message||""), "error"); }
}

/* ── Comentarios ─────────────────────────────────────────────── */
function openComments(postId, section, forumId) {
  var modal = document.getElementById("comments-modal");
  modal.dataset.postId = postId;
  modal.dataset.section = section;
  modal.dataset.forumId = forumId || "";
  modal.classList.add("open");
  loadComments(postId);
}

async function loadComments(postId) {
  var container = document.getElementById("comments-list");
  container.innerHTML = '<div class="skeleton" style="height:60px;margin-bottom:.5rem"></div>'.repeat(2);
  try {
    var sb = await initSupabase();
    var res = await sb.from("comments")
      .select("*, profiles(username,avatar_url,plan)")
      .eq("post_id", postId)
      .order("created_at", {ascending:true});
    if (res.error) throw res.error;
    var comments = res.data || [];
    container.innerHTML = comments.length
      ? comments.map(function(c) {
          var av = c.profiles && c.profiles.avatar_url
            ? '<img src="'+c.profiles.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
            : ((c.profiles && c.profiles.username)||"U")[0].toUpperCase();
          return '<div style="display:flex;gap:.6rem;margin-bottom:.75rem">'
            +'<div class="avatar" style="width:30px;height:30px;font-size:.7rem;flex-shrink:0">'+av+'</div>'
            +'<div style="flex:1">'
              +'<div style="font-size:.8rem;font-weight:600;color:var(--text)" class="'+planNameClass(c.profiles&&c.profiles.plan)+'">'+escHtml((c.profiles&&c.profiles.username)||"Usuario")+'</div>'
              +'<div style="font-size:.85rem;color:var(--text);margin-top:.15rem">'+escHtml(c.content)+'</div>'
              +'<div style="font-size:.7rem;color:var(--text-3);margin-top:.15rem">'+timeAgo(c.created_at)+'</div>'
            +'</div></div>';
        }).join("")
      : '<div class="empty-state" style="padding:1.5rem"><p>Sin comentarios aún</p></div>';
  } catch(e) {
    container.innerHTML = '<p style="color:var(--text-3);font-size:.82rem;padding:.5rem">Error: '+e.message+'</p>';
  }
}

async function submitComment() {
  var modal = document.getElementById("comments-modal");
  var input = document.getElementById("comment-input");
  var text = input.value.trim();
  if (!text || !AppState.currentUser) return;
  try {
    var sb = await initSupabase();
    var res = await sb.from("comments").insert({
      post_id: modal.dataset.postId,
      user_id: AppState.currentUser.id,
      content: text,
    });
    if (res.error) throw res.error;
    input.value = "";
    await loadComments(modal.dataset.postId);
    showToast("Comentario añadido", "success");
  } catch(e) { showToast("Error al comentar: "+(e.message||""), "error"); }
}

/* ── Upload images — ahora usa Cloudinary ────────────────────── */
async function uploadImages(files, bucket) {
  // bucket se ignora — todo va a Cloudinary ahora
  // Llama a uploadMultipleImages de uploader.js que comprime + sube
  return uploadMultipleImages(files, 4);
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICACIONES
══════════════════════════════════════════════════════════════ */
var Notifs = {
  _interval: null,
  _lastCheck: {},

  start: function() {
    if (this._interval) return;
    var now = new Date().toISOString();
    this._lastCheck = {
      inicio:   localStorage.getItem("rcw_lc_inicio")   || now,
      noticias: localStorage.getItem("rcw_lc_noticias") || now,
    };
    var self = this;
    this._interval = setInterval(function() { self.poll(); }, 20000);
    this.poll();
  },

  stop: function() {
    clearInterval(this._interval);
    this._interval = null;
  },

  poll: async function() {
    if (!AppState.currentUser) return;
    try {
      var sb = await initSupabase();
      var activePage = (document.querySelector(".nav-item.active")||{}).dataset && document.querySelector(".nav-item.active").dataset.page;

      // Inicio
      if (activePage !== "inicio") {
        var ri = await sb.from("posts").select("id").eq("section","inicio").gt("created_at", this._lastCheck.inicio);
        if (!ri.error && ri.data && ri.data.length > 0) this._showBadge("inicio", ri.data.length);
      }

      // Noticias
      if (activePage !== "noticias") {
        var rn = await sb.from("posts").select("id").eq("section","noticias").gt("created_at", this._lastCheck.noticias);
        if (!rn.error && rn.data && rn.data.length > 0) this._showBadge("noticias", rn.data.length);
      }

      // Foros
      if (activePage !== "foros") {
        var rm = await sb.from("forum_members").select("forum_id").eq("user_id", AppState.currentUser.id);
        var total = 0;
        if (!rm.error && rm.data) {
          for (var i = 0; i < rm.data.length; i++) {
            var fid = rm.data[i].forum_id;
            var key = "forum_"+fid;
            var since = this._lastCheck[key] || new Date().toISOString();
            var rf = await sb.from("posts").select("id").eq("section","forum").eq("forum_id",fid).gt("created_at",since);
            if (!rf.error && rf.data) total += rf.data.length;
          }
        }
        if (total > 0) this._showBadge("foros", total);
      }
    } catch(e) { console.warn("poll error:", e.message); }
  },

  _showBadge: function(navPage, count) {
    var names = {inicio:"Inicio", noticias:"Noticias", foros:"Mis Foros"};
    showToast((count>1?count+" nuevas publicaciones en ":"Nueva publicación en ")+names[navPage], "info", 5000);
    var navItem = document.querySelector('.nav-item[data-page="'+navPage+'"]');
    if (navItem) {
      var dot = navItem.querySelector(".nav-dot");
      if (!dot) { dot = document.createElement("div"); dot.className = "nav-dot"; navItem.appendChild(dot); }
      // Push notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("RedCW — "+names[navPage], {body: (count>1?count+" nuevas publicaciones":"Nueva publicación"), icon:"/icons/icon-192.png"});
      } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  },

  clearBadge: function(navPage) {
    var navItem = document.querySelector('.nav-item[data-page="'+navPage+'"]');
    if (navItem) { var dot = navItem.querySelector(".nav-dot"); if (dot) dot.remove(); }
    var now = new Date().toISOString();
    if (navPage === "inicio" || navPage === "noticias") {
      this._lastCheck[navPage] = now;
      localStorage.setItem("rcw_lc_"+navPage, now);
    }
  },

  clearForumBadge: function(forumId) {
    var now = new Date().toISOString();
    this._lastCheck["forum_"+forumId] = now;
  },
};

/* ── Init ──────────────────────────────────────────────────── */
async function initApp() {
  await initSupabase();
  var session = await getCurrentSession();
  var hash = window.location.hash.replace("#","") || "inicio";
  if (!session) {
    navigateTo("login");
  } else {
    renderMenuAccounts();
    navigateTo(PAGES.includes(hash) ? hash : "inicio");
    Notifs.start();
  }
  var sb = await initSupabase();
  sb.auth.onAuthStateChange(async function(event, session) {
    if (event === "SIGNED_IN" && session) {
      await loadUserProfile(session.user.id);
      renderMenuAccounts();
      Notifs.start();
    } else if (event === "SIGNED_OUT") {
      Notifs.stop();
      navigateTo("login");
    }
  });
}

document.addEventListener("DOMContentLoaded", initApp);
