// RedCW — Foros / Comunidades

// ── Crear foro ───────────────────────────────────────────────
async function createForum({ name, description, type, isHidden, coverFile }) {
  if (!currentProfile) return { error: "No autenticado" };

  // Verificar límites
  const limits = planForumLimits(currentProfile.plan, currentProfile.role);
  const { data: myForums } = await supabase
    .from("forums").select("id, type").eq("owner_id", currentUser.id);

  const normalCount = (myForums || []).filter(f => f.type === "normal").length;
  const anonCount   = (myForums || []).filter(f => f.type === "anonimo").length;

  if (type === "normal"   && normalCount >= limits.normal)   return { error: `Límite de foros normales alcanzado (${limits.normal})` };
  if (type === "anonimo"  && anonCount  >= limits.anonymous) return { error: `Límite de foros anónimos alcanzado (${limits.anonymous})` };
  if (type === "oculto"   && !canHiddenForum())              return { error: t("errPermission") };

  let coverUrl = null;
  if (coverFile) coverUrl = await uploadImage(coverFile);

  const { data, error } = await supabase.from("forums").insert({
    name, description, type, is_hidden: isHidden || false,
    owner_id: currentUser.id, cover_url: coverUrl,
  }).select().single();

  if (!error) {
    // El creador es miembro automáticamente
    await supabase.from("forum_members").insert({ forum_id: data.id, user_id: currentUser.id });
  }
  return { data, error };
}

// ── Unirse a un foro ─────────────────────────────────────────
async function joinForum(forumId) {
  const { data: existing } = await supabase
    .from("forum_members").select("id").eq("forum_id", forumId).eq("user_id", currentUser.id).single();
  if (existing) return { alreadyJoined: true };

  const { error } = await supabase.from("forum_members").insert({
    forum_id: forumId, user_id: currentUser.id
  });
  if (!error) {
    await supabase.from("forums").update({ members_count: supabase.rpc("increment") }).eq("id", forumId);
  }
  return { error };
}

// ── Cargar foros públicos (Comunidades) ──────────────────────
async function loadPublicForums({ limit = 20, offset = 0, search = "" } = {}) {
  let query = supabase
    .from("forums")
    .select(`*, owner:profiles(id, username, display_name, avatar_url)`)
    .eq("is_hidden", false)
    .order("members_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  return data || [];
}

// ── Mis foros (unidos) ───────────────────────────────────────
async function loadMyForums() {
  const { data } = await supabase
    .from("forum_members")
    .select(`forum:forums(*, owner:profiles(id, username, display_name, avatar_url))`)
    .eq("user_id", currentUser.id)
    .order("joined_at", { ascending: false });
  return (data || []).map(d => d.forum).filter(Boolean);
}

// ── Renderizar tarjeta de foro ───────────────────────────────
function renderForumCard(forum, containerId, joined = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cover = forum.cover_url
    ? `<img src="${forum.cover_url}" class="forum-cover" loading="lazy" alt="">`
    : `<div class="forum-cover-placeholder"><span>${forum.name[0]}</span></div>`;

  const typeIcon = { normal: "🌐", anonimo: "🎭", oculto: "🔒" }[forum.type] || "🌐";

  const card = document.createElement("div");
  card.className = "forum-card";
  card.dataset.id = forum.id;
  card.innerHTML = `
    ${cover}
    <div class="forum-card-body">
      <div class="forum-title-row">
        <span class="forum-type-icon">${typeIcon}</span>
        <h3 class="forum-name">${forum.name}</h3>
      </div>
      ${forum.description ? `<p class="forum-desc">${forum.description}</p>` : ""}
      <div class="forum-stats">
        <span>👥 ${forum.members_count || 0} ${t("members")}</span>
      </div>
      <button class="btn-primary join-forum-btn ${joined ? "joined" : ""}" data-id="${forum.id}">
        ${joined ? t("joined") : t("join")}
      </button>
    </div>
  `;

  card.querySelector(".join-forum-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!joined) showJoinModal(forum);
  });

  card.addEventListener("click", () => {
    if (joined) window.location.href = `forum.html?id=${forum.id}`;
    else showJoinModal(forum);
  });

  container.appendChild(card);
}

// ── Modal de unirse ──────────────────────────────────────────
function showJoinModal(forum) {
  const modal = document.getElementById("join-modal");
  if (!modal) return;
  document.getElementById("join-modal-name").textContent = forum.name;
  document.getElementById("join-modal-confirm").onclick = async () => {
    const { error } = await joinForum(forum.id);
    if (!error) {
      showToast(t("success"), "success");
      modal.classList.remove("active");
      location.reload();
    }
  };
  modal.classList.add("active");
}

// ── News Groups ──────────────────────────────────────────────
async function createNewsGroup({ name, description, coverFile }) {
  if (!canCreateNewsGroup()) return { error: t("errPermission") };

  // Verificar límite
  const maxGroups = maxNewsGroups();
  const { data: myGroups } = await supabase
    .from("news_groups").select("id").eq("owner_id", currentUser.id);
  if ((myGroups || []).length >= maxGroups) return { error: `Límite de grupos alcanzado (${maxGroups})` };

  let coverUrl = null;
  if (coverFile) coverUrl = await uploadImage(coverFile);

  const { data, error } = await supabase.from("news_groups").insert({
    name, description, owner_id: currentUser.id, cover_url: coverUrl,
  }).select().single();
  return { data, error };
}

async function loadNewsGroups() {
  const { data } = await supabase
    .from("news_groups")
    .select(`*, owner:profiles(id, username, display_name, avatar_url),
      last_post:posts(content, media_url, created_at)`)
    .order("created_at", { ascending: false });
  return data || [];
}

// ── Invitaciones a foros ocultos ─────────────────────────────
async function inviteToForum(forumId, targetUserId) {
  const { data: forum } = await supabase.from("forums").select("owner_id").eq("id", forumId).single();
  if (forum?.owner_id !== currentUser.id && !isAdmin()) return { error: t("errPermission") };

  const { data, error } = await supabase.from("forum_invites").insert({
    forum_id: forumId, invited_by: currentUser.id, invited_user: targetUserId
  }).select().single();
  return { data, error };
}

async function acceptInvite(token) {
  const { data: invite } = await supabase.from("forum_invites").select("*").eq("token", token).single();
  if (!invite || invite.used) return { error: "Invitación no válida" };
  if (invite.invited_user !== currentUser.id) return { error: t("errPermission") };

  await joinForum(invite.forum_id);
  await supabase.from("forum_invites").update({ used: true }).eq("id", invite.id);
  return { success: true };
}
