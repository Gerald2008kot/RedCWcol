// RedCW — Supabase Client + Auth
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  REDCW_CONFIG.supabase.url,
  REDCW_CONFIG.supabase.anonKey
);

// ── Estado global del usuario ────────────────────────────────
let currentUser = null;
let currentProfile = null;

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (!error) {
    currentProfile = data;
    applyUserPreferences(data);
  }
  return data;
}

function applyUserPreferences(profile) {
  if (profile.dark_mode) {
    document.body.classList.add("dark");
    document.body.classList.remove("light");
  } else {
    document.body.classList.add("light");
    document.body.classList.remove("dark");
  }
  if (profile.lang) localStorage.setItem("redcw_lang", profile.lang);
}

// ── Auth Actions ─────────────────────────────────────────────
async function signUp(email, password, username, displayName) {
  // Check blacklist
  const { data: bl } = await supabase
    .from("blacklist").select("id").eq("email", email).single();
  if (bl) return { error: { message: t("errPermission") } };

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { username, display_name: displayName } }
  });
  return { data, error };
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data.user) {
    currentUser = data.user;
    await loadProfile(data.user.id);
  }
  return { data, error };
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  window.location.href = "login.html";
}

// ── Role Checks ──────────────────────────────────────────────
function isOwner()   { return currentProfile?.role === "propietario"; }
function isAdmin()   { return ["administrador", "propietario"].includes(currentProfile?.role); }
function isEncargado() { return ["encargado", "administrador", "propietario"].includes(currentProfile?.role); }

function canCreateNewsPost() { return isEncargado(); }

function canCreateForums() {
  const plan = currentProfile?.plan || "free";
  const role = currentProfile?.role || "usuario";
  return { normal: planForumLimits(plan, role).normal, anonymous: planForumLimits(plan, role).anonymous };
}

function planForumLimits(plan, role) {
  if (["administrador", "propietario"].includes(role)) return { normal: 999, anonymous: 999 };
  const limits = {
    free:     { normal: 1, anonymous: 0 },
    n1:       { normal: 2, anonymous: 1 },
    n2:       { normal: 2, anonymous: 1 },
    n3:       { normal: 3, anonymous: 2 },
  };
  return limits[plan] || limits.free;
}

function canHiddenForum() {
  return currentProfile?.plan === "n3" || isAdmin();
}

function canAnonymousComment() {
  return ["n3", "administrador", "propietario"].includes(currentProfile?.plan || currentProfile?.role);
}

function hasBannerUpload() {
  return ["n1","n2","n3"].includes(currentProfile?.plan) || isAdmin();
}

function hasNameColor() {
  return ["n1","n2","n3"].includes(currentProfile?.plan) || isAdmin();
}

function canCreateNewsGroup() {
  const plan = currentProfile?.plan;
  const role = currentProfile?.role;
  if (["administrador","propietario"].includes(role)) return true;
  return ["n2","n3"].includes(plan);
}

function maxNewsGroups() {
  const plan = currentProfile?.plan;
  const role = currentProfile?.role;
  if (["administrador","propietario"].includes(role)) return 999;
  if (plan === "n3") return 2;
  if (plan === "n2") return 1;
  return 0;
}

// ── Guard: redirigir si no autenticado ───────────────────────
async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.href = "login.html"; return null; }
  currentUser = session.user;
  if (!currentProfile) await loadProfile(session.user.id);
  return session;
}

// ── Auth state change listener ───────────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session) {
    currentUser = session.user;
    await loadProfile(session.user.id);
    updateHeaderUI();
  } else if (event === "SIGNED_OUT") {
    currentUser = null;
    currentProfile = null;
  }
});

function updateHeaderUI() {
  const chip = document.querySelector(".session-chip");
  if (!chip || !currentProfile) return;
  const avatar = currentProfile.avatar_url
    ? `<img src="${currentProfile.avatar_url}" alt="">`
    : `<span class="avatar-initials">${(currentProfile.display_name||currentProfile.username||"U")[0].toUpperCase()}</span>`;
  chip.innerHTML = avatar + `<span>${currentProfile.display_name || currentProfile.username}</span>`;
}
