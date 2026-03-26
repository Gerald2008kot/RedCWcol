// RedCW — Panel de Administración

// ── ADMIN: Cargar usuarios con lazy load ─────────────────────
async function adminLoadUsers({ limit = 20, offset = 0, search = "" } = {}) {
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, role, plan, plan_expires_at, is_suspended, is_banned, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);

  const { data } = await query;
  return data || [];
}

// ── ADMIN: Suspender cuenta ──────────────────────────────────
async function suspendUser(userId) {
  if (!isAdmin()) return { error: t("errPermission") };
  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
  // No puede suspender mismo rango o superior
  const rankOrder = { usuario: 0, encargado: 1, administrador: 2, propietario: 3 };
  const myRank = rankOrder[currentProfile.role] || 0;
  const targetRank = rankOrder[target?.role] || 0;
  if (targetRank >= myRank) return { error: t("errPermission") };

  const { error } = await supabase.from("profiles")
    .update({ is_suspended: true }).eq("id", userId);
  return { error };
}

async function restoreUser(userId) {
  if (!isAdmin()) return { error: t("errPermission") };
  const { error } = await supabase.from("profiles")
    .update({ is_suspended: false }).eq("id", userId);
  return { error };
}

// ── ADMIN: Vetar (blacklist) ─────────────────────────────────
async function banUser(userId) {
  if (!isAdmin()) return { error: t("errPermission") };
  const { data: target } = await supabase.from("profiles")
    .select("id, role").eq("id", userId).single();
  const rankOrder = { usuario: 0, encargado: 1, administrador: 2, propietario: 3 };
  if ((rankOrder[target?.role] || 0) >= (rankOrder[currentProfile.role] || 0)) return { error: t("errPermission") };

  // Obtener email del usuario
  const { data: authUser } = await supabase.rpc("get_user_email", { uid: userId });
  const email = authUser || userId;

  await supabase.from("blacklist").insert({ email, banned_by: currentUser.id });
  await supabase.from("profiles").update({ is_banned: true }).eq("id", userId);
  return { success: true };
}

// ── ADMIN: Lista negra ───────────────────────────────────────
async function loadBlacklist() {
  const { data } = await supabase.from("blacklist")
    .select("*, banned_by_profile:profiles(username)")
    .order("created_at", { ascending: false });
  return data || [];
}

async function removeFromBlacklist(id, email) {
  if (!isAdmin()) return { error: t("errPermission") };
  await supabase.from("blacklist").delete().eq("id", id);
  await supabase.from("profiles").update({ is_banned: false })
    .eq("id", id); // fallback, ideally match by email
  return { success: true };
}

// ── OWNER: Crear usuario manualmente ─────────────────────────
async function ownerCreateUser({ email, password, username, role, plan }) {
  if (!isOwner()) return { error: t("errPermission") };
  // Crear via Supabase Admin API (solo desde backend/edge function)
  // Aquí se llama a una Edge Function de Supabase para evitar exponer service_role
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(`${REDCW_CONFIG.supabase.url}/functions/v1/admin-create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.session?.access_token}`,
    },
    body: JSON.stringify({ email, password, username, role, plan }),
  });
  const result = await res.json();
  return result;
}

// ── OWNER: Asignar plan ──────────────────────────────────────
async function assignPlan(userId, plan) {
  if (!isOwner()) return { error: t("errPermission") };
  const expires = new Date();
  expires.setDate(expires.getDate() + REDCW_CONFIG.plans[plan]?.duration || 30);

  const { error } = await supabase.from("profiles")
    .update({ plan, plan_expires_at: expires.toISOString() })
    .eq("id", userId);
  return { error };
}

// ── OWNER: Cambiar rol ───────────────────────────────────────
async function changeRole(userId, newRole) {
  if (!isOwner()) return { error: t("errPermission") };
  const validRoles = ["usuario", "encargado", "administrador"];
  if (!validRoles.includes(newRole)) return { error: "Rol no válido" };

  const { error } = await supabase.from("profiles")
    .update({ role: newRole }).eq("id", userId);
  return { error };
}

// ── OWNER: Ver pagos / comprobantes ─────────────────────────
async function loadPlanPayments({ status } = {}) {
  let query = supabase.from("plan_payments")
    .select(`*, user:profiles(id, username, display_name, avatar_url)`)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return data || [];
}

async function approvePayment(paymentId, userId, plan) {
  if (!isOwner() && !isAdmin()) return { error: t("errPermission") };
  await assignPlan(userId, plan);
  await supabase.from("plan_payments").update({
    status: "aprobado", reviewed_by: currentUser.id, reviewed_at: new Date().toISOString()
  }).eq("id", paymentId);
  return { success: true };
}

// ── Renderizar fila de usuario en admin ──────────────────────
function renderUserRow(user, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const roleLabel = { usuario: "Usuario", encargado: "Encargado", administrador: "Admin", propietario: "Propietario" };
  const planBadge = user.plan !== "free" ? `<span class="badge badge-plan">${user.plan.toUpperCase()}</span>` : "";
  const statusBadge = user.is_banned ? `<span class="badge badge-ban">Vetado</span>`
    : user.is_suspended ? `<span class="badge badge-warn">Suspendido</span>` : "";

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>
      <div class="user-cell">
        ${user.avatar_url ? `<img src="${user.avatar_url}" class="mini-avatar">` : `<div class="mini-avatar-placeholder">${(user.display_name||"U")[0]}</div>`}
        <div>
          <span class="user-display">${user.display_name || user.username}</span>
          <span class="user-sub">@${user.username}</span>
        </div>
      </div>
    </td>
    <td><span class="role-badge role-${user.role}">${roleLabel[user.role]}</span></td>
    <td>${planBadge || "Free"} ${statusBadge}</td>
    <td>
      <div class="action-btns">
        ${!user.is_suspended && !user.is_banned ? `<button class="btn-warn btn-sm" onclick="suspendUser('${user.id}').then(()=>location.reload())">${t("suspend")}</button>` : ""}
        ${user.is_suspended ? `<button class="btn-success btn-sm" onclick="restoreUser('${user.id}').then(()=>location.reload())">${t("restore")}</button>` : ""}
        ${!user.is_banned ? `<button class="btn-danger btn-sm" onclick="confirmBan('${user.id}')">${t("ban")}</button>` : ""}
        ${isOwner() ? `
          <select class="role-select" onchange="changeRole('${user.id}', this.value).then(()=>location.reload())">
            <option value="">Cambiar rol</option>
            <option value="usuario">Usuario</option>
            <option value="encargado">Encargado</option>
            <option value="administrador">Administrador</option>
          </select>
          <select class="plan-select" onchange="assignPlan('${user.id}', this.value).then(()=>location.reload())">
            <option value="">Asignar plan</option>
            <option value="n1">N1</option>
            <option value="n2">N2</option>
            <option value="n3">N3</option>
            <option value="free">Free</option>
          </select>
        ` : ""}
      </div>
    </td>
  `;
  container.appendChild(tr);
}

function confirmBan(userId) {
  if (confirm("¿Vetar este usuario permanentemente?")) {
    banUser(userId).then(() => location.reload());
  }
}
