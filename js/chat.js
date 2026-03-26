// RedCW — Chat en Tiempo Real (Supabase Realtime)

let activeConversationId = null;
let messageChannel = null;

// ── Obtener o crear conversación entre dos usuarios ──────────
async function getOrCreateConversation(otherUserId) {
  // Buscar conversación existente
  const { data: myConvs } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUser.id);

  if (myConvs && myConvs.length > 0) {
    const myIds = myConvs.map(c => c.conversation_id);
    const { data: shared } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myIds);
    if (shared && shared.length > 0) return shared[0].conversation_id;
  }

  // Crear nueva conversación
  const { data: conv } = await supabase
    .from("conversations")
    .insert({}).select().single();

  await supabase.from("conversation_participants").insert([
    { conversation_id: conv.id, user_id: currentUser.id },
    { conversation_id: conv.id, user_id: otherUserId },
  ]);

  return conv.id;
}

// ── Cargar mensajes ──────────────────────────────────────────
async function loadMessages(conversationId) {
  const { data, error } = await supabase
    .from("messages")
    .select(`*, sender:profiles(id, username, display_name, avatar_url, name_color)`)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return data || [];
}

// ── Enviar mensaje ───────────────────────────────────────────
async function sendMessage(conversationId, content, mediaUrl = null) {
  const { data, error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: currentUser.id,
    content,
    media_url: mediaUrl,
  }).select().single();
  return { data, error };
}

// ── Suscribirse a mensajes en tiempo real ────────────────────
function subscribeToConversation(conversationId, onMessage) {
  if (messageChannel) supabase.removeChannel(messageChannel);
  
  messageChannel = supabase
    .channel(`chat:${conversationId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    }, async (payload) => {
      // Enriquecer con datos del sender
      const { data: sender } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, name_color")
        .eq("id", payload.new.sender_id)
        .single();
      onMessage({ ...payload.new, sender });
    })
    .subscribe();
}

// ── Listar conversaciones del usuario ────────────────────────
async function listConversations() {
  const { data: parts } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUser.id);

  if (!parts || parts.length === 0) return [];
  const convIds = parts.map(p => p.conversation_id);

  // Obtener el otro participante de cada conversación
  const { data: others } = await supabase
    .from("conversation_participants")
    .select(`conversation_id, user:profiles(id, username, display_name, avatar_url, name_color)`)
    .in("conversation_id", convIds)
    .neq("user_id", currentUser.id);

  // Último mensaje de cada conversación
  const results = await Promise.all((others || []).map(async o => {
    const { data: last } = await supabase
      .from("messages")
      .select("content, created_at, read")
      .eq("conversation_id", o.conversation_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return { ...o, lastMessage: last };
  }));

  return results;
}

// ── Renderizar burbuja de mensaje ────────────────────────────
function renderMessage(msg, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isMine = msg.sender_id === currentUser.id;
  const nameColor = msg.sender?.name_color || "var(--text-primary)";
  const avatar = msg.sender?.avatar_url
    ? `<img src="${msg.sender.avatar_url}" class="msg-avatar" alt="">`
    : `<div class="msg-avatar-initials">${(msg.sender?.display_name||"U")[0]}</div>`;

  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const el = document.createElement("div");
  el.className = `message-bubble ${isMine ? "mine" : "theirs"}`;
  el.dataset.id = msg.id;
  el.innerHTML = `
    ${!isMine ? avatar : ""}
    <div class="bubble-inner">
      ${!isMine ? `<span class="msg-sender-name" style="color:${nameColor}">${msg.sender?.display_name || msg.sender?.username || "Usuario"}</span>` : ""}
      ${msg.content ? `<p class="bubble-text">${escapeHtml(msg.content)}</p>` : ""}
      ${msg.media_url ? `<img src="${msg.media_url}" class="bubble-media" alt="">` : ""}
      <span class="bubble-time">${time}</span>
    </div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Buscar usuarios para chat ────────────────────────────────
async function searchUsers(query) {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq("id", currentUser.id)
    .limit(10);
  return data || [];
}
