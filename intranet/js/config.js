// ============================================================
//  INTRANET REDCW — Configuración global
// ============================================================

const APP = {
  nombre:  'IntraNet RedCW',
  version: '2.0.0',
  baseUrl: window.location.origin,
};

// ── Supabase ─────────────────────────────────────────────────
const SUPABASE_URL  = 'https://maizfdgeswdqysgrfxgc.supabase.co';
const SUPABASE_ANON = 'sb_publishable_xBfUwiNLG-m8kNbd3p8oLA_ICHl4PBH';

// ── Cloudinary ───────────────────────────────────────────────
const CLOUDINARY = {
  cloud:   'dlxy4yl5t',
  preset:  'ml_default',
  avatar:  (publicId) =>
    `https://res.cloudinary.com/dlxy4yl5t/image/upload/w_200,h_200,c_fill,g_face,r_max,q_auto,f_auto/${publicId}`,
  thumb:   (publicId) =>
    `https://res.cloudinary.com/dlxy4yl5t/image/upload/w_400,h_300,c_fill,q_auto,f_auto/${publicId}`,
};

// ── Storj ────────────────────────────────────────────────────
const STORJ = {
  gateway: 'https://gateway.storjshare.io',
  bucket:  'intranet-corp',
  fileUrl: (key) => `https://link.storjshare.io/s/intranet-corp/${key}`,
};

// ── Roles ────────────────────────────────────────────────────
const ROLES = {
  puedeSubir:         ['admin','editor'],
  puedeModerar:       ['admin'],
  puedeCrearEncuesta: ['admin','moderador'],
  puedeAdmin:         ['admin'],
};

// ── Extensiones → carpeta ────────────────────────────────────
const EXT_CARPETA = {
  png:'imagenes', jpg:'imagenes', jpeg:'imagenes', gif:'imagenes', webp:'imagenes',
  mp3:'musica',   wav:'musica',   ogg:'musica',    m4a:'musica',   aac:'musica',  flac:'musica',
  mp4:'videos',   webm:'videos',
  pdf:'documentos', doc:'documentos', docx:'documentos',
  xls:'documentos', xlsx:'documentos', ppt:'documentos', pptx:'documentos', txt:'documentos',
  zip:'comprimidos', rar:'comprimidos',
};

function carpetaPorExt(ext) {
  return EXT_CARPETA[(ext||'').toLowerCase()] || 'otros';
}
