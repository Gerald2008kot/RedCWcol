// ============================================================
//  RedCW — Supabase Client & Auth
// ============================================================

// Carga dinámica del SDK de Supabase
let supabase = null;

async function initSupabase() {
  if (supabase) return supabase;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
  supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return supabase;
}

// ── Estado de sesión global ──────────────────────────────────
const AppState = {
  currentUser: null,       // perfil completo desde DB
  session: null,           // sesión de Supabase
  accounts: [],            // cuentas guardadas localmente
  theme: localStorage.getItem("rcw_theme") || "dark",

  setUser(profile, session) {
    this.currentUser = profile;
    this.session = session;
    document.dispatchEvent(new CustomEvent("rcw:userchange", { detail: profile }));
  },

  clearUser() {
    this.currentUser = null;
    this.session = null;
    document.dispatchEvent(new CustomEvent("rcw:userchange", { detail: null }));
  },

  hasRole(role) {
    if (!this.currentUser) return false;
    const order = ["usuario", "encargado", "administrador", "propietario"];
    return order.indexOf(this.currentUser.role) >= order.indexOf(role);
  },

  hasPlan(plan) {
    if (!this.currentUser) return false;
    const order = ["free", "n1", "n2", "n3"];
    return order.indexOf(this.currentUser.plan || "free") >= order.indexOf(plan);
  },

  canDo(permission) {
    if (!this.currentUser) return false;
    return PERMISSIONS[permission]?.includes(this.currentUser.role) ?? false;
  },
};

// ── Auth helpers ─────────────────────────────────────────────
async function signIn(email, password) {
  const sb = await initSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await loadUserProfile(data.user.id);
  saveAccountLocally(email);
  return data;
}

async function signUp(email, password, username) {
  const sb = await initSupabase();
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
  if (error) throw error;
  return data;
}

async function signOut() {
  const sb = await initSupabase();
  await sb.auth.signOut();
  AppState.clearUser();
  navigateTo("login");
}

async function loadUserProfile(userId) {
  const sb = await initSupabase();
  const { data } = await sb.from("profiles").select("*").eq("id", userId).single();
  const { data: { session } } = await sb.auth.getSession();
  if (data) AppState.setUser(data, session);
  return data;
}

async function getCurrentSession() {
  const sb = await initSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await loadUserProfile(session.user.id);
  }
  return session;
}

// ── Cuentas múltiples (localStorage) ───────────────────────
function saveAccountLocally(email) {
  let accounts = JSON.parse(localStorage.getItem("rcw_accounts") || "[]");
  if (!accounts.includes(email)) accounts.push(email);
  localStorage.setItem("rcw_accounts", JSON.stringify(accounts));
}

function getSavedAccounts() {
  return JSON.parse(localStorage.getItem("rcw_accounts") || "[]");
}

// ── DB helpers genéricos ─────────────────────────────────────
async function dbSelect(table, query = {}) {
  const sb = await initSupabase();
  let q = sb.from(table).select(query.select || "*");
  if (query.eq) Object.entries(query.eq).forEach(([k, v]) => (q = q.eq(k, v)));
  if (query.order) q = q.order(query.order, { ascending: query.asc ?? false });
  if (query.limit) q = q.limit(query.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function dbInsert(table, payload) {
  const sb = await initSupabase();
  const { data, error } = await sb.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function dbUpdate(table, id, payload) {
  const sb = await initSupabase();
  const { data, error } = await sb.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function dbDelete(table, id) {
  const sb = await initSupabase();
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw error;
}

// uploadFile() deshabilitada — ahora la provee uploader.js (Cloudinary)
// async function uploadFile(bucket, path, file) { ... }

// ── Token de sesión: lee directamente de localStorage ────────
// Mismo método que usa el test_full_flow.html — no depende del
// cliente JS de Supabase para obtener el token (evita race conditions).
function getSessionToken() {
  var sbKey = CONFIG.SUPABASE_ANON_KEY;
  try {
    // Supabase guarda la sesión en localStorage con esta clave
    var sbUrl    = CONFIG.SUPABASE_URL || "";
    var projRef  = sbUrl.replace("https://", "").split(".")[0];
    var lsKey    = "sb-" + projRef + "-auth-token";
    var stored   = localStorage.getItem(lsKey);
    if (stored) {
      var parsed = JSON.parse(stored);
      var token  = parsed && (parsed.access_token || (parsed.session && parsed.session.access_token));
      if (token) {
        console.log("[getSessionToken] token OK desde localStorage");
        return token;
      }
    }
    // Fallback: buscar cualquier clave de supabase en localStorage
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.includes("auth-token")) {
        var v = localStorage.getItem(k);
        try {
          var obj = JSON.parse(v);
          var t   = obj && (obj.access_token || (obj.session && obj.session.access_token));
          if (t) {
            console.log("[getSessionToken] token OK desde localStorage key:", k);
            return t;
          }
        } catch(e) {}
      }
    }
  } catch(e) {
    console.warn("[getSessionToken] Error leyendo localStorage:", e.message);
  }
  console.warn("[getSessionToken] Usando anon key como fallback");
  return sbKey;
}

// ── sbFetch: helper interno para hacer fetch a Supabase REST API ──
async function sbFetch(path, method, body) {
  var sbUrl  = CONFIG.SUPABASE_URL.replace(/\/$/, "");
  var sbKey  = CONFIG.SUPABASE_ANON_KEY;
  var token  = getSessionToken();

  console.log("[sbFetch]", method, path, "| token[:20]:", token.slice(0, 20) + "…");

  var opts = {
    method:  method,
    headers: {
      "Content-Type":  "application/json",
      "apikey":        sbKey,
      "Authorization": "Bearer " + token,
      "Prefer":        "return=minimal",
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  var resp = await fetch(sbUrl + path, opts);
  var text = await resp.text();
  console.log("[sbFetch] HTTP", resp.status, "|", text.slice(0, 200) || "(vacío — OK)");

  if (!resp.ok) {
    throw new Error("Supabase " + method + " " + resp.status + ": " + text);
  }
  return resp;
}

// ── sbUpdateProfile ────────────────────────────────────────────
async function sbUpdateProfile(fields) {
  var userId = AppState.currentUser && AppState.currentUser.id;
  if (!userId) throw new Error("No hay usuario autenticado");
  await sbFetch("/rest/v1/profiles?id=eq." + userId, "PATCH", fields);
  if (AppState.currentUser) Object.assign(AppState.currentUser, fields);
  return true;
}

// ── sbInsertPost ───────────────────────────────────────────────
async function sbInsertPost(payload) {
  await sbFetch("/rest/v1/posts", "POST", payload);
  return true;
}
