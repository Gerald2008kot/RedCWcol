// ============================================================
//  RedCW — Archivo de Configuración Central
//  Edita este archivo para cambiar credenciales, costos, etc.
// ============================================================

const REDCW_CONFIG = {

  // ── Supabase ─────────────────────────────────────────────
  supabase: {
    url: "https://klitblfegdxdvitgolph.supabase.co",
    anonKey: "sb_publishable_JO4qZK7sBVP4Rv7_Gi3cbQ_6x6Zl1oz",
  },

  // ── Cloudinary ───────────────────────────────────────────
  // Rotación cada 15 días entre cuentas.
  // Añade más objetos a cada array según necesites.
  // El sistema seleccionará automáticamente según el día del mes.
  cloudinary: {
    images: [
      {
        cloudName: "db3w5kcfi",
        uploadPreset: "ml_imagenes",
        // apiKey: "",       // Opcional: solo si usas firma
        // apiSecret: "",    // NUNCA exponer en frontend
      },
      // { cloudName: "CUENTA2", uploadPreset: "PRESET2" },
    ],
    videos: [
      {
        cloudName: "db3w5kcfi",
        uploadPreset: "ml_imagenes",
      },
      // { cloudName: "CUENTA2", uploadPreset: "PRESET2" },
    ],
    audio: [
      {
        cloudName: "db3w5kcfi",
        uploadPreset: "ml_imagenes",
      },
      // { cloudName: "CUENTA2", uploadPreset: "PRESET2" },
    ],
    // Días de rotación entre cuentas (15 = cada 15 días)
    rotationDays: 15,
  },

  // ── Planes y Precios ─────────────────────────────────────
  // Modifica los precios aquí sin tocar el resto del código
  plans: {
    free: {
      name: "Free",
      price: 0,
      currency: "PEN",
      label: "Gratis",
    },
    n1: {
      name: "N1",
      price: 9.90,       // ← Cambia el precio aquí
      currency: "PEN",
      label: "Plan N1",
      duration: 30,      // días de vigencia
    },
    n2: {
      name: "N2",
      price: 19.90,      // ← Cambia el precio aquí
      currency: "PEN",
      label: "Plan N2",
      duration: 30,
    },
    n3: {
      name: "N3",
      price: 29.90,      // ← Cambia el precio aquí
      currency: "PEN",
      label: "Plan N3",
      duration: 30,
    },
  },

  // ── Pagos (Yape / Plin) ──────────────────────────────────
  payments: {
    yapeNumber: "+51 999 999 999",   // ← Tu número Yape
    plinNumber: "+51 999 999 999",   // ← Tu número Plin
    // Ruta local de tu QR (coloca el archivo en assets/)
    yapeQR: "assets/qr-yape.png",   // ← Reemplaza con tu QR
    plinQR: "assets/qr-plin.png",   // ← Reemplaza con tu QR
  },

  // ── Correo de Contacto / Ayuda ───────────────────────────
  contact: {
    helpEmail: "ayuda@redcw.com",   // ← Tu correo de ayuda
    supportEmail: "soporte@redcw.com",
  },

  // ── Aplicación ───────────────────────────────────────────
  app: {
    name: "RedCW",
    tagline: "La red social de tu colegio",
    version: "1.0.0",
    defaultLang: "es",              // "es" o "en"
    maxAudioMB: 10,                 // Tamaño máximo de audio en MB
    maxImageMB: 5,
    maxVideoMB: 50,
  },

};

// ── Utilidad: Selector de cuenta Cloudinary por rotación ──
function getCloudinaryAccount(type = "images") {
  const accounts = REDCW_CONFIG.cloudinary[type];
  if (!accounts || accounts.length === 0) return null;
  if (accounts.length === 1) return accounts[0];
  const day = new Date().getDate();
  const rotDays = REDCW_CONFIG.cloudinary.rotationDays;
  const index = Math.floor(day / rotDays) % accounts.length;
  return accounts[index];
}

// Exportar para uso en módulos (si se usa bundler)
if (typeof module !== "undefined") {
  module.exports = { REDCW_CONFIG, getCloudinaryAccount };
}
