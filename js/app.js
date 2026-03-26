// RedCW — App Shell / UI Principal

// ── Cargar shell dinámicamente ───────────────────────────────
async function loadShell(activePage) {
  const res = await fetch("partials/shell.html");
  const html = await res.text();
  const shellEl = document.getElementById("app-shell");
  if (shellEl) shellEl.innerHTML = html;

  // Marcar página activa en snackbar
  document.querySelectorAll(".snack-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === activePage);
  });

  // Aplicar i18n
  applyI18n();
  initDropdown();
  await initShellUser();
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
}

// ── Inicializar usuario en shell ─────────────────────────────
async function initShellUser() {
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;
  if (!currentProfile) await loadProfile(session.user.id);

  // Chip
  updateChip();
  // Dark mode
  syncDarkModeUI();
  // Admin/Owner
  showAdminOption();
  // Unread messages
  checkUnread();
}

function updateChip() {
  if (!currentProfile) return;
  const avatar = document.getElementById("chip-avatar");
  const name   = document.getElementById("chip-name");
  if (currentProfile.avatar_url) {
    avatar.outerHTML = `<img id="chip-avatar" src="${currentProfile.avatar_url}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`;
  } else {
    avatar.textContent = (currentProfile.display_name || currentProfile.username || "U")[0].toUpperCase();
  }
  if (name) name.textContent = currentProfile.display_name || currentProfile.username;
}

function showAdminOption() {
  if (!currentProfile) return;
  const divider = document.getElementById("admin-divider");
  const btn     = document.getElementById("admin-panel-btn");
  const label   = document.getElementById("admin-panel-label");
  if (!btn) return;

  if (isOwner()) {
    divider.style.display = "";
    btn.style.display = "";
    label.textContent = t("ownerPanel");
    btn.onclick = () => window.location.href = "owner.html";
  } else if (isAdmin()) {
    divider.style.display = "";
    btn.style.display = "";
    label.textContent = t("adminPanel");
    btn.onclick = () => window.location.href = "admin.html";
  }
}

// ── Dropdown ─────────────────────────────────────────────────
function initDropdown() {
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeDropdown(); });
}

function toggleDropdown() {
  const menu    = document.getElementById("dropdown-menu");
  const overlay = document.getElementById("dropdown-overlay");
  if (!menu) return;
  const isOpen = menu.classList.contains("open");
  if (isOpen) closeDropdown();
  else {
    menu.classList.add("open");
    overlay.style.display = "block";
  }
}

function closeDropdown() {
  document.getElementById("dropdown-menu")?.classList.remove("open");
  const overlay = document.getElementById("dropdown-overlay");
  if (overlay) overlay.style.display = "none";
}

// ── Dark Mode ─────────────────────────────────────────────────
function toggleDarkMode() {
  const isDark = document.body.classList.contains("dark");
  if (isDark) {
    document.body.classList.remove("dark");
    document.body.classList.add("light");
  } else {
    document.body.classList.add("dark");
    document.body.classList.remove("light");
  }
  localStorage.setItem("redcw_dark", !isDark ? "1" : "0");
  syncDarkModeUI();

  // Persistir en perfil
  if (currentUser) {
    supabase.from("profiles").update({ dark_mode: !isDark }).eq("id", currentUser.id);
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

// ── Init dark mode from storage ───────────────────────────────
(function initTheme() {
  const stored = localStorage.getItem("redcw_dark");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = stored !== null ? stored === "1" : prefersDark;
  document.body.classList.add(dark ? "dark" : "light");
})();

// ── Unread messages badge ─────────────────────────────────────
async function checkUnread() {
  if (!currentUser) return;
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("read", false)
    .neq("sender_id", currentUser.id);

  const badge = document.getElementById("unread-badge");
  if (!badge) return;
  if (count > 0) { badge.textContent = count > 9 ? "9+" : count; badge.style.display = ""; }
  else badge.style.display = "none";
}

// ── Multi-account stub ────────────────────────────────────────
function showAddAccount() {
  closeDropdown();
  showToast("Para añadir otra cuenta, inicia sesión en una ventana privada.", "info");
}
function showSwitchAccount() {
  closeDropdown();
  showToast("Cierra sesión primero para cambiar de cuenta.", "info");
}

// ── Infinite scroll helper ────────────────────────────────────
function initInfiniteScroll(containerId, loadFn) {
  const sentinel = document.getElementById("scroll-sentinel");
  if (!sentinel) return;
  let loading = false;
  let offset = 0;

  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting && !loading) {
      loading = true;
      offset += 10;
      const more = await loadFn(offset);
      loading = false;
      if (!more || more.length === 0) observer.disconnect();
    }
  }, { rootMargin: "200px" });

  observer.observe(sentinel);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.add("active"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("active"); }

// Cerrar modal al hacer click fuera
document.addEventListener("click", e => {
  document.querySelectorAll(".modal-overlay.active").forEach(m => {
    if (e.target === m) m.classList.remove("active");
  });
});
