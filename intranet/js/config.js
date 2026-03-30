// ============================================================
//  INTRANET REDCW — Configuración global
//  IMPORTANTE: este archivo es público. Las claves aquí son
//  "anon keys" de Supabase (seguras con RLS activado).
//  Las credenciales de Storj/Cloudinary con escritura se usan
//  solo en Edge Functions de Supabase (server-side).
// ============================================================

const APP = {
  nombre:  'IntraNet RedCW',
  version: '2.0.0',
  baseUrl: window.location.origin,
};

// ── Supabase ─────────────────────────────────────────────────
const SUPABASE_URL  = 'https://jwrsrwgmnyppgwagwqzb.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Hul2iMtUAqjYBryu6r58kg_kYi4XYFD';

// ── Cloudinary (solo lectura / upload sin firma) ──────────────
const CLOUDINARY = {
  cloud:     'dlxy4yl5t',
  preset:    'ml_default',   // upload preset sin firma
  baseUrl:   'https://res.cloudinary.com/dlxy4yl5t/image/upload',
  // Transformaciones CSS útiles:
  // /w_200,h_200,c_fill,g_face,r_max/ → avatar circular 200px
  avatar:    (publicId) =>
    `https://res.cloudinary.com/dq0s8t3fj/image/upload/w_200,h_200,c_fill,g_face,r_max,q_auto,f_auto/${publicId}`,
  thumb:     (publicId) =>
    `https://res.cloudinary.com/dq0s8t3fj/image/upload/w_400,h_300,c_fill,q_auto,f_auto/${publicId}`,
};

// ── Storj (solo lectura pública, escritura vía Supabase Edge) ─
const STORJ = {
  gateway:   'https://gateway.storjshare.io',
  bucket:    'intranet-corp',
  // URL pública de un archivo:
  fileUrl:   (key) => `https://link.storjshare.io/s/intranet-corp/${key}`,
};

// ── Roles y permisos ─────────────────────────────────────────
const ROLES = {
  puedeSubir:    ['admin','editor'],
  puedeModerar:  ['admin'],
  puedeCrearEncuesta: ['admin','moderador'],
  puedeAdmin:    ['admin'],
};

// ── Extensiones → carpeta ────────────────────────────────────
const EXT_CARPETA = {
  png:'imagenes', jpg:'imagenes', jpeg:'imagenes', gif:'imagenes', webp:'imagenes',
  mp3:'musica', wav:'musica', ogg:'musica', m4a:'musica', aac:'musica', flac:'musica',
  mp4:'videos', webm:'videos',
  pdf:'documentos', doc:'documentos', docx:'documentos',
  xls:'documentos', xlsx:'documentos', ppt:'documentos', pptx:'documentos', txt:'documentos',
  zip:'comprimidos', rar:'comprimidos',
};

function carpetaPorExt(ext) {
  return EXT_CARPETA[(ext||'').toLowerCase()] || 'otros';
}
