// RedCW — App Shell

// ── Tema (ejecutar inmediatamente) ───────────────────────────
(function() {
  const stored = localStorage.getItem("redcw_dark");
  const dark = stored !== null ? stored === "1" : window.matchMedia("(prefers-color-scheme:dark)").matches;
  document.body.classList.add(dark ? "dark" : "light");
})();

// ── Cargar shell ──────────────────────────────────────────────
async function loadShell(activePage) {
  // Verificar sesión PRIMERO
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  window.currentUser = session.user;
  if (!window.currentProfile) await loadProfile(session.user.id);

  // Inyectar HTML del shell
  const res  = await fetch("partials/shell.html");
  const html = await res.text();
  const el   = document.getElementById("app-shell");
  if (el) el.innerHTML = html;

  // Marcar página activa
  document.querySelectorAll(".snack-item[data-page]").forEach(item => {
    item.classList.toggle("active", item.dataset.page === activePage);
  });

  _applyI18n();
  _updateChip();
  syncDarkModeUI();
  _showAdminOption();
  _checkUnread();
}

function _applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}

function _updateChip() {
  const p = window.currentProfile;
  if (!p) return;
  const avatarEl = document.getElementById("chip-avatar");
  const nameEl   = document.getElementById("chip-name");
  if (!avatarEl) return;
  if (p.avatar_url) {
    avatarEl.outerHTML = `<img id="chip-avatar" src="${p.avatar_url}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`;
  } else {
    avatarEl.textContent = (p.display_name || p.username || "U")[0].toUpperCase();
  }
  if (nameEl) nameEl.textContent = p.display_name || p.username || "";
}

function _showAdminOption() {
  const divider = document.getElementById("admin-divider");
  const btn     = document.getElementById("admin-panel-btn");
  const label   = document.getElementById("admin-panel-label");
  if (!btn) return;
  if (isOwner()) {
    divider.style.display = ""; btn.style.display = "";
    label.textContent = t("ownerPanel");
    btn.onclick = () => window.location.href = "owner.html";
  } else if (isAdmin()) {
    divider.style.display = ""; btn.style.display = "";
    label.textContent = t("adminPanel");
    btn.onclick = () => window.location.href = "admin.html";
  }
}

async function _checkUnread() {
  if (!window.currentUser) return;
  try {
    const { count } = await window.supabase
      .from("messages")
      .select("id", { count:"exact", head:true })
      .eq("read", false)
      .neq("sender_id", window.currentUser.id);
    const badge = document.getElementById("unread-badge");
    if (!badge) return;
    if (count > 0) { badge.textContent = count > 9 ? "9+" : count; badge.style.display = ""; }
    else badge.style.display = "none";
  } catch(_) {}
}

// ── Dropdown ─────────────────────────────────────────────────
function toggleDropdown() {
  const menu    = document.getElementById("dropdown-menu");
  const overlay = document.getElementById("dropdown-overlay");
  if (!menu) return;
  if (menu.classList.contains("open")) closeDropdown();
  else { menu.classList.add("open"); if (overlay) overlay.style.display = "block"; }
}

function closeDropdown() {
  document.getElementById("dropdown-menu")?.classList.remove("open");
  const ov = document.getElementById("dropdown-overlay");
  if (ov) ov.style.display = "none";
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closeDropdown(); });

// ── Dark mode ─────────────────────────────────────────────────
function toggleDarkMode() {
  const isDark = document.body.classList.contains("dark");
  document.body.classList.toggle("dark",  !isDark);
  document.body.classList.toggle("light",  isDark);
  localStorage.setItem("redcw_dark", !isDark ? "1" : "0");
  syncDarkModeUI();
  if (window.currentUser) {
    window.supabase.from("profiles").update({ dark_mode: !isDark }).eq("id", window.currentUser.id);
  }
  closeDropdown();
}

function syncDarkModeUI() {
  const isDark = document.body.classList.contains("dark");
  const icon  = document.getElementById("mode-icon");
  const label = document.getElementById("mode-label");
  if (icon) icon.innerHTML = isDark
    ? `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
    : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  if (label) label.textContent = isDark ? t("lightMode") : t("darkMode");
}

// ── Multi-cuenta ──────────────────────────────────────────────
function showAddAccount()    { closeDropdown(); showToast("Para añadir otra cuenta, usa una ventana privada.", "info"); }
function showSwitchAccount() { closeDropdown(); showToast("Cierra sesión para cambiar de cuenta.", "info"); }

// ── Modales ───────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add("active"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("active"); }

document.addEventListener("click", e => {
  document.querySelectorAll(".modal-overlay.active").forEach(m => {
    if (e.target === m) m.classList.remove("active");
  });
});

// ── Infinite scroll ───────────────────────────────────────────
function initInfiniteScroll(containerId, loadFn) {
  const sentinel = document.getElementById("scroll-sentinel");
  if (!sentinel) return;
  let loading = false, offset = 0;
  new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting || loading) return;
    loading = true;
    offset += 10;
    const more = await loadFn(offset);
    loading = false;
    if (!more || more.length === 0) observer.disconnect();
  }, { rootMargin: "200px" }).observe(sentinel);
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = "info") {
  document.querySelectorAll(".toast").forEach(t => t.remove()); // limpiar anteriores
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Exponer
Object.assign(window, {
  loadShell, toggleDropdown, closeDropdown, toggleDarkMode, syncDarkModeUI,
  showAddAccount, showSwitchAccount, openModal, closeModal,
  initInfiniteScroll, showToast
});
