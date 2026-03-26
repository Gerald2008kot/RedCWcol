// RedCW — Sistema de traducciones ES / EN
const REDCW_I18N = {
  es: {
    // Nav
    home: "Inicio", news: "Noticias", communities: "Comunidades",
    myForums: "Mis Foros", chats: "Chats",
    // Auth
    login: "Iniciar Sesión", register: "Registrarse", logout: "Cerrar Sesión",
    email: "Correo electrónico", password: "Contraseña",
    username: "Nombre de usuario", forgotPassword: "¿Olvidaste tu contraseña?",
    noAccount: "¿No tienes cuenta?", hasAccount: "¿Ya tienes cuenta?",
    // Header menu
    viewProfile: "Ver Perfil", addAccount: "Añadir Cuenta",
    switchAccount: "Cambiar Cuenta", darkMode: "Modo Oscuro",
    lightMode: "Modo Claro", plans: "Planes", help: "Ayuda",
    // Posts
    newPost: "Nueva publicación", writePost: "¿Qué piensas?",
    publish: "Publicar", cancel: "Cancelar",
    like: "Me gusta", comment: "Comentar", share: "Compartir",
    addPhoto: "Foto", addAudio: "Audio",
    comments: "Comentarios", writeComment: "Escribe un comentario...",
    // Forums
    createForum: "Crear Foro", joinForum: "Unirse al Foro",
    forumName: "Nombre del Foro", forumDesc: "Descripción",
    normalForum: "Foro Normal", anonymousForum: "Foro Anónimo",
    hiddenForum: "Foro Oculto",
    joinQuestion: "¿Quieres unirte a este foro?",
    join: "Unirse", joined: "Unido",
    // News
    createGroup: "Crear Grupo", groupName: "Nombre del Grupo",
    addMember: "Añadir Miembro",
    // Chat
    newChat: "Nuevo Chat", addFriend: "Añadir Amigo",
    searchUsers: "Buscar usuarios...", sendMessage: "Enviar mensaje...",
    send: "Enviar", friendRequest: "Solicitud de amistad",
    // Profile
    editProfile: "Editar Perfil", saveChanges: "Guardar Cambios",
    displayName: "Nombre visible", description: "Descripción",
    myGallery: "Mi Galería", changePhoto: "Cambiar foto",
    changeBanner: "Cambiar banner",
    // Plans
    currentPlan: "Plan actual", upgrade: "Mejorar Plan",
    planFree: "Gratis", active: "Activo", expired: "Expirado",
    payWith: "Pagar con", scanQR: "Escanea el QR o transfiere al número",
    afterPayment: "Después de pagar, envía tu comprobante",
    sendReceipt: "Enviar Comprobante",
    // Admin
    adminPanel: "Panel de Administrador", ownerPanel: "Administración",
    users: "Usuarios", blacklist: "Lista Negra", permissions: "Permisos",
    suspend: "Suspender", ban: "Vetar", restore: "Restaurar",
    assignPlan: "Asignar Plan", changeRole: "Cambiar Rol",
    // General
    loading: "Cargando...", error: "Error", success: "Éxito",
    save: "Guardar", delete: "Eliminar", edit: "Editar",
    close: "Cerrar", back: "Volver", search: "Buscar",
    noResults: "Sin resultados", seeMore: "Ver más",
    anonymous: "Anónimo", by: "por", in: "en",
    members: "miembros", posts: "publicaciones",
    // Errors
    errRequired: "Este campo es obligatorio",
    errEmail: "Correo no válido",
    errPassword: "Mínimo 6 caracteres",
    errUpload: "Error al subir el archivo",
    errPermission: "No tienes permiso para esto",
  },
  en: {
    home: "Home", news: "News", communities: "Communities",
    myForums: "My Forums", chats: "Chats",
    login: "Log In", register: "Sign Up", logout: "Log Out",
    email: "Email", password: "Password",
    username: "Username", forgotPassword: "Forgot password?",
    noAccount: "Don't have an account?", hasAccount: "Already have an account?",
    viewProfile: "View Profile", addAccount: "Add Account",
    switchAccount: "Switch Account", darkMode: "Dark Mode",
    lightMode: "Light Mode", plans: "Plans", help: "Help",
    newPost: "New Post", writePost: "What's on your mind?",
    publish: "Publish", cancel: "Cancel",
    like: "Like", comment: "Comment", share: "Share",
    addPhoto: "Photo", addAudio: "Audio",
    comments: "Comments", writeComment: "Write a comment...",
    createForum: "Create Forum", joinForum: "Join Forum",
    forumName: "Forum Name", forumDesc: "Description",
    normalForum: "Normal Forum", anonymousForum: "Anonymous Forum",
    hiddenForum: "Hidden Forum",
    joinQuestion: "Do you want to join this forum?",
    join: "Join", joined: "Joined",
    createGroup: "Create Group", groupName: "Group Name",
    addMember: "Add Member",
    newChat: "New Chat", addFriend: "Add Friend",
    searchUsers: "Search users...", sendMessage: "Send a message...",
    send: "Send", friendRequest: "Friend Request",
    editProfile: "Edit Profile", saveChanges: "Save Changes",
    displayName: "Display Name", description: "Description",
    myGallery: "My Gallery", changePhoto: "Change photo",
    changeBanner: "Change banner",
    currentPlan: "Current Plan", upgrade: "Upgrade Plan",
    planFree: "Free", active: "Active", expired: "Expired",
    payWith: "Pay with", scanQR: "Scan the QR or transfer to the number",
    afterPayment: "After paying, send your receipt",
    sendReceipt: "Send Receipt",
    adminPanel: "Admin Panel", ownerPanel: "Administration",
    users: "Users", blacklist: "Blacklist", permissions: "Permissions",
    suspend: "Suspend", ban: "Ban", restore: "Restore",
    assignPlan: "Assign Plan", changeRole: "Change Role",
    loading: "Loading...", error: "Error", success: "Success",
    save: "Save", delete: "Delete", edit: "Edit",
    close: "Close", back: "Back", search: "Search",
    noResults: "No results", seeMore: "See more",
    anonymous: "Anonymous", by: "by", in: "in",
    members: "members", posts: "posts",
    errRequired: "This field is required",
    errEmail: "Invalid email",
    errPassword: "Minimum 6 characters",
    errUpload: "Error uploading file",
    errPermission: "You don't have permission for this",
  },
};

function t(key) {
  const lang = localStorage.getItem("redcw_lang") || REDCW_CONFIG.app.defaultLang;
  return (REDCW_I18N[lang] && REDCW_I18N[lang][key]) || key;
}

function setLang(lang) {
  localStorage.setItem("redcw_lang", lang);
  location.reload();
}
