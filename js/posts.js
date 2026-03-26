// RedCW — Posts / Feed Logic

// ── Crear publicación ────────────────────────────────────────
async function createPost({ content, mediaFile, mediaType, section, forumId, newsGroupId, isAnonymous }) {
  let mediaUrl = null;

  if (mediaFile) {
    try {
      if (mediaType === "imagen") mediaUrl = await uploadImage(mediaFile);
      else if (mediaType === "audio") mediaUrl = await uploadAudio(mediaFile);
      // Guardar en galería
      if (mediaUrl && mediaType === "imagen") {
        await supabase.from("gallery").insert({ user_id: currentUser.id, url: mediaUrl });
      }
    } catch (e) {
      showToast(t("errUpload"), "error");
      return { error: e };
    }
  }

  const postData = {
    author_id: currentUser.id,
    content,
    media_url: mediaUrl,
    media_type: mediaType || "texto",
    section: section || "inicio",
    is_anonymous: isAnonymous || false,
  };
  if (forumId) postData.forum_id = forumId;
  if (newsGroupId) postData.news_group_id = newsGroupId;

  const { data, error } = await supabase.from("posts").insert(postData).select().single();
  return { data, error };
}

// ── Cargar feed con lazy load ─────────────────────────────────
async function loadFeed(section, { limit = 10, offset = 0, forumId, newsGroupId } = {}) {
  let query = supabase
    .from("posts")
    .select(`
      *,
      author:profiles(id, username, display_name, avatar_url, name_color, role, plan),
      _likes:post_likes(count),
      _comments:comments(count)
    `)
    .eq("section", section)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (forumId) query = query.eq("forum_id", forumId);
  if (newsGroupId) query = query.eq("news_group_id", newsGroupId);

  const { data, error } = await query;
  return data || [];
}

// ── Renderizar tarjeta de post ───────────────────────────────
async function renderPost(post, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isAnon = post.is_anonymous;
  const author = post.author;
  const nameColor = author?.name_color && hasNameColor() ? author.name_color : "var(--text-primary)";
  const authorName = isAnon ? t("anonymous") : (author?.display_name || author?.username || "Usuario");
  const avatar = (!isAnon && author?.avatar_url)
    ? `<img src="${author.avatar_url}" class="post-avatar" alt="">`
    : `<div class="post-avatar-placeholder">${isAnon ? "?" : authorName[0]}</div>`;

  const timeAgo = formatTimeAgo(post.created_at);
  const likeCount = post._likes?.[0]?.count || post.likes_count || 0;
  const commentCount = post._comments?.[0]?.count || post.comments_count || 0;

  let mediaHtml = "";
  if (post.media_url) {
    if (post.media_type === "imagen") {
      mediaHtml = `<div class="post-media"><img src="${post.media_url}" alt="media" loading="lazy"></div>`;
    } else if (post.media_type === "audio") {
      mediaHtml = `<div class="post-media"><audio controls src="${post.media_url}"></audio></div>`;
    }
  }

  const card = document.createElement("article");
  card.className = "post-card";
  card.dataset.id = post.id;
  card.innerHTML = `
    <div class="post-header">
      ${avatar}
      <div class="post-meta">
        <span class="post-author" style="color:${nameColor}">${authorName}</span>
        <span class="post-time">${timeAgo}</span>
      </div>
    </div>
    ${post.content ? `<p class="post-content">${escapeHtml(post.content)}</p>` : ""}
    ${mediaHtml}
    <div class="post-actions">
      <button class="btn-action like-btn" data-id="${post.id}">
        <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        <span class="like-count">${likeCount}</span>
      </button>
      <button class="btn-action comment-btn" data-id="${post.id}">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span>${commentCount}</span>
      </button>
    </div>
    <div class="comments-section" id="comments-${post.id}" style="display:none"></div>
  `;

  container.appendChild(card);

  // Like handler
  card.querySelector(".like-btn").addEventListener("click", () => toggleLike(post.id, card));
  // Comment toggle
  card.querySelector(".comment-btn").addEventListener("click", () => toggleComments(post.id));
}

async function toggleLike(postId, card) {
  if (!currentUser) return;
  const { data: existing } = await supabase
    .from("post_likes").select("id").eq("post_id", postId).eq("user_id", currentUser.id).single();

  if (existing) {
    await supabase.from("post_likes").delete().eq("id", existing.id);
    card.querySelector(".like-btn").classList.remove("liked");
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: currentUser.id });
    card.querySelector(".like-btn").classList.add("liked");
  }

  // Refresh count
  const { data: post } = await supabase.from("posts").select("likes_count").eq("id", postId).single();
  if (post) card.querySelector(".like-count").textContent = post.likes_count;
}

async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;
  if (section.style.display === "none") {
    section.style.display = "block";
    await loadComments(postId, section);
  } else {
    section.style.display = "none";
  }
}

async function loadComments(postId, container) {
  container.innerHTML = '<p class="loading-text">Cargando...</p>';
  const { data: comments } = await supabase
    .from("comments")
    .select(`*, author:profiles(id, username, display_name, avatar_url, name_color)`)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  container.innerHTML = "";
  (comments || []).forEach(c => {
    const isAnon = c.is_anonymous;
    const name = isAnon ? t("anonymous") : (c.author?.display_name || c.author?.username);
    const color = c.author?.name_color || "var(--text-primary)";
    const div = document.createElement("div");
    div.className = "comment-item";
    div.innerHTML = `
      <span class="comment-author" style="color:${color}">${name}</span>
      <p class="comment-text">${escapeHtml(c.content)}</p>
      <span class="comment-time">${formatTimeAgo(c.created_at)}</span>
    `;
    container.appendChild(div);
  });

  // Caja de comentario
  const canAnon = canAnonymousComment();
  const inputArea = document.createElement("div");
  inputArea.className = "comment-input-area";
  inputArea.innerHTML = `
    <input type="text" placeholder="${t("writeComment")}" class="comment-input" id="ci-${postId}">
    ${canAnon ? `<label class="anon-check"><input type="checkbox" id="anon-${postId}"> ${t("anonymous")}</label>` : ""}
    <button class="btn-primary btn-sm" onclick="submitComment('${postId}')">→</button>
  `;
  container.appendChild(inputArea);
}

async function submitComment(postId) {
  const input = document.getElementById(`ci-${postId}`);
  const anonCb = document.getElementById(`anon-${postId}`);
  const content = input?.value?.trim();
  if (!content) return;
  const isAnonymous = anonCb ? anonCb.checked : false;
  const { error } = await supabase.from("comments").insert({
    post_id: postId, author_id: currentUser.id, content, is_anonymous: isAnonymous
  });
  if (!error) {
    input.value = "";
    const section = document.getElementById(`comments-${postId}`);
    await loadComments(postId, section);
  }
}

// ── Subscripción en tiempo real al feed ──────────────────────
function subscribeToFeed(section, containerId) {
  supabase.channel(`feed:${section}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "posts",
      filter: `section=eq.${section}`
    }, async (payload) => {
      const { data: full } = await supabase
        .from("posts")
        .select(`*, author:profiles(id, username, display_name, avatar_url, name_color)`)
        .eq("id", payload.new.id)
        .single();
      if (full) {
        const container = document.getElementById(containerId);
        if (container) container.insertAdjacentHTML("afterbegin", "");
        renderPost(full, containerId);
      }
    })
    .subscribe();
}

// ── Utilidades ───────────────────────────────────────────────
function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "justo ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function showToast(msg, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
