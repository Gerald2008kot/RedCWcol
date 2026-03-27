// RedCW — Auth (vanilla JS, sin ESM import)
// window.supabase ya fue creado en cada página antes de cargar este script

window.currentUser    = null;
window.currentProfile = null;

// ── Sesión ────────────────────────────────────────────────────
async function getSession() {
  const { data: { session } } = await window.supabase.auth.getSession();
  return session;
}

async function loadProfile(userId) {
  const { data, error } = await window.supabase
    .from("profiles").select("*").eq("id", userId).single();
  if (!error && data) {
    window.currentProfile = data;
    _applyPrefs(data);
  }
  return data || null;
}

function _applyPrefs(profile) {
  if (localStorage.getItem("redcw_dark") === null) {
    const dark = profile.dark_mode !== false;
    document.body.classList.toggle("dark",  dark);
    document.body.classList.toggle("light", !dark);
  }
  if (profile.lang) localStorage.setItem("redcw_lang", profile.lang);
}

// ── Sign out ──────────────────────────────────────────────────
async function signOut() {
  await window.supabase.auth.signOut();
  window.currentUser = null; window.currentProfile = null;
  window.location.href = "login.html";
}

// ── Roles ─────────────────────────────────────────────────────
function isOwner()     { return window.currentProfile?.role === "propietario"; }
function isAdmin()     { return ["administrador","propietario"].includes(window.currentProfile?.role); }
function isEncargado() { return ["encargado","administrador","propietario"].includes(window.currentProfile?.role); }

function planForumLimits(plan, role) {
  if (["administrador","propietario"].includes(role)) return { normal:999, anonymous:999 };
  return ({free:{normal:1,anonymous:0},n1:{normal:2,anonymous:1},n2:{normal:2,anonymous:1},n3:{normal:3,anonymous:2}})[plan] || {normal:1,anonymous:0};
}

function canCreateForums()     { return planForumLimits(window.currentProfile?.plan||"free", window.currentProfile?.role||"usuario"); }
function canHiddenForum()      { return window.currentProfile?.plan==="n3" || isAdmin(); }
function canAnonymousComment() { return window.currentProfile?.plan==="n3" || isAdmin(); }
function hasBannerUpload()     { return ["n1","n2","n3"].includes(window.currentProfile?.plan) || isAdmin(); }
function hasNameColor()        { return ["n1","n2","n3"].includes(window.currentProfile?.plan) || isAdmin(); }
function canCreateNewsGroup()  { return ["n2","n3"].includes(window.currentProfile?.plan) || isAdmin(); }
function maxNewsGroups()       {
  if (isAdmin()) return 999;
  if (window.currentProfile?.plan==="n3") return 2;
  if (window.currentProfile?.plan==="n2") return 1;
  return 0;
}
function canCreateNewsPost() { return isEncargado(); }

// Exponer todo en window
Object.assign(window, {
  getSession, loadProfile, signOut,
  isOwner, isAdmin, isEncargado,
  planForumLimits, canCreateForums, canHiddenForum,
  canAnonymousComment, hasBannerUpload, hasNameColor,
  canCreateNewsGroup, maxNewsGroups, canCreateNewsPost
});
