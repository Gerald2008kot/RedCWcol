// ============================================================
//  RedCW — image_processor.js (stub)
//  Sin compresión activa. Funciones devuelven el archivo original.
// ============================================================
function rcwCompress(file)              { return Promise.resolve(file); }
function compressImage(file)            { return Promise.resolve(file); }
function compressProfileImage(file)     { return Promise.resolve(file); }
async function processImageFiles(files, max) {
  return Array.from(files).slice(0, max || 4);
}
