// ============================================================
//  RedCW — Cloudinary Multi-Account Config
//  Archivo: /js/cloud_config.js
//
//  INSTRUCCIONES:
//  1. Crea tantas cuentas Cloudinary gratuitas como necesites.
//  2. En cada cuenta: Settings → Upload → Add upload preset →
//     Signing Mode: "Unsigned" → guarda el preset name.
//  3. Rellena el array CLOUDINARY_ACCOUNTS con tus datos.
//  4. Cada cuenta rota automáticamente cada 7 días.
// ============================================================

const CLOUDINARY_ACCOUNTS = [
  {
    cloudName:    "db3w5kcfi",   // ← reemplaza
    uploadPreset: "ml_imagenes",       // ← reemplaza (unsigned)
    label:        "Cuenta A",
  },
];

/**
 * Devuelve la cuenta activa según la semana del año.
 * Cambia automáticamente cada 7 días usando módulo.
 *
 * Semana 0 → cuenta 0, semana 1 → cuenta 1, etc.
 * Al llegar al final del array vuelve al inicio (rotación circular).
 *
 * @returns {{ cloudName: string, uploadPreset: string, label: string }}
 */
function getWeeklyAccount() {
  // Número de semanas transcurridas desde el 1 ene 1970
  const weekNumber = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  const index = weekNumber % CLOUDINARY_ACCOUNTS.length;
  return CLOUDINARY_ACCOUNTS[index];
}

/**
 * Devuelve la cuenta activa para un tipo de recurso específico.
 * Útil si quieres separar avatares/banners de posts.
 *
 * type: "post" | "avatar" | "banner"
 */
function getAccountForType(type) {
  // Por defecto todos usan la rotación semanal.
  // Puedes personalizar aquí si quieres fijar una cuenta por tipo:
  // if (type === "avatar") return CLOUDINARY_ACCOUNTS[0];
  return getWeeklyAccount();
}

/**
 * Construye la URL pública de Cloudinary con transformaciones
 * de optimización automática (formato + calidad automáticos).
 *
 * @param {string} publicIdOrUrl  - public_id de Cloudinary o URL completa
 * @param {object} opts           - opciones de transformación
 * @param {number} opts.width     - ancho máximo (default: 800)
 * @param {string} opts.crop      - modo de crop (default: "limit")
 * @param {string} opts.cloudName - cloudName si no está en la URL
 * @returns {string} URL optimizada
 */
function cloudinaryOptimizedUrl(publicIdOrUrl, opts) {
  opts = opts || {};

  // Si ya es una URL completa de Cloudinary, inyectar transformaciones
  if (publicIdOrUrl && publicIdOrUrl.includes("cloudinary.com")) {
    const width  = opts.width || 800;
    const crop   = opts.crop  || "limit";
    // Insertar f_auto,q_auto,w_X,c_limit antes del "upload/" en la URL
    return publicIdOrUrl.replace(
      "/upload/",
      "/upload/f_auto,q_auto,w_" + width + ",c_" + crop + "/"
    );
  }

  // Si es un public_id puro, construir la URL desde cero
  const account = opts.cloudName
    ? CLOUDINARY_ACCOUNTS.find(a => a.cloudName === opts.cloudName) || getWeeklyAccount()
    : getWeeklyAccount();
  const width = opts.width || 800;
  const crop  = opts.crop  || "limit";
  return "https://res.cloudinary.com/"
    + account.cloudName
    + "/image/upload/f_auto,q_auto,w_" + width + ",c_" + crop + "/"
    + publicIdOrUrl;
}

// ── Exportar para uso en otros módulos (compatibilidad global) ─
// No se usa import/export para mantener compatibilidad con <script src="">
// Estas funciones quedan disponibles globalmente al cargar el archivo.
