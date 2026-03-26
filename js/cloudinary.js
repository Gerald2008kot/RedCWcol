// RedCW — Cloudinary Upload Manager

async function uploadToCloudinary(file, type = "images") {
  const account = getCloudinaryAccount(type);
  if (!account) throw new Error("No Cloudinary account configured for: " + type);

  const maxMB = type === "images"
    ? REDCW_CONFIG.app.maxImageMB
    : type === "audio"
    ? REDCW_CONFIG.app.maxAudioMB
    : REDCW_CONFIG.app.maxVideoMB;

  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`El archivo supera el límite de ${maxMB}MB`);
  }

  const resourceType = type === "images" ? "image" : type === "audio" ? "video" : "video";
  const url = `https://api.cloudinary.com/v1_1/${account.cloudName}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", account.uploadPreset);
  formData.append("folder", `redcw/${type}`);

  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed: " + res.statusText);
  const data = await res.json();
  return data.secure_url;
}

// Wrapper específicos
async function uploadImage(file) { return uploadToCloudinary(file, "images"); }
async function uploadAudio(file) { return uploadToCloudinary(file, "audio"); }
async function uploadVideo(file) { return uploadToCloudinary(file, "videos"); }

// Preview local antes de subir
function previewFile(file, imgEl) {
  const reader = new FileReader();
  reader.onload = e => { imgEl.src = e.target.result; imgEl.style.display = "block"; };
  reader.readAsDataURL(file);
}
