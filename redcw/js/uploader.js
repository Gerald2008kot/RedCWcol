// ============================================================
//  RedCW — Uploader v6 (sin compresión)
//  Sube el archivo original directamente a Cloudinary.
//  La compresión se agregará en el futuro cuando sea necesaria.
// ============================================================

async function rcwUpload(file, type) {
  type = type || "image";

  var account = (typeof getWeeklyAccount === "function") ? getWeeklyAccount() : null;
  if (!account || !account.cloudName || account.cloudName.startsWith("tu_cloud")) {
    throw new Error("Falta configurar cloud_config.js con tu cloudName y uploadPreset");
  }

  var isVideo    = (file.type && file.type.startsWith("video/")) || type === "video";
  var resType    = isVideo ? "video" : "image";
  var apiUrl     = "https://api.cloudinary.com/v1_1/" + account.cloudName + "/" + resType + "/upload";

  var formData = new FormData();
  formData.append("file",          file);          // archivo original, sin tocar
  formData.append("upload_preset", account.uploadPreset);

  console.log("[rcwUpload] → " + apiUrl + " | " + file.name + " | " + (file.size/1024).toFixed(0) + "KB | " + file.type);

  var response;
  try {
    response = await fetch(apiUrl, { method: "POST", body: formData });
  } catch(e) {
    throw new Error("Error de red al subir a Cloudinary: " + e.message);
  }

  var bodyText;
  try { bodyText = await response.text(); }
  catch(e) { throw new Error("No se pudo leer la respuesta de Cloudinary"); }

  console.log("[rcwUpload] HTTP " + response.status + " — " + bodyText.slice(0, 300));

  var result;
  try { result = JSON.parse(bodyText); }
  catch(e) { throw new Error("Cloudinary HTTP " + response.status + " — respuesta no-JSON: " + bodyText.slice(0, 100)); }

  if (!response.ok || result.error) {
    throw new Error("Cloudinary error: " + (result.error ? result.error.message : "HTTP " + response.status));
  }
  if (!result.secure_url) {
    throw new Error("Cloudinary no devolvió secure_url. Respuesta: " + JSON.stringify(result).slice(0, 200));
  }

  console.log("[rcwUpload] ✓ URL:", result.secure_url);
  return result.secure_url;
}

// ── Alias de compatibilidad ─────────────────────────────────
function uploadAvatar(file)             { return rcwUpload(file, "avatar"); }
function uploadBanner(file)             { return rcwUpload(file, "banner"); }
function uploadVideo(file)              { return rcwUpload(file, "video");  }
function uploadToCloudinary(file, type) { return rcwUpload(file, type || "image"); }

async function uploadMultipleImages(files, max) {
  max = max || 4;
  var arr  = Array.from(files).slice(0, max);
  var urls = [];
  for (var i = 0; i < arr.length; i++) {
    urls.push(await rcwUpload(arr[i], "image"));
  }
  return urls;
}

function uploadFile(bucket, path, file) {
  var m = { avatars:"avatar", banners:"banner", posts:"image", videos:"video" };
  return rcwUpload(file, m[bucket] || "image");
}
