// RedCW — Registro del Service Worker (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(reg => console.log("SW registrado:", reg.scope))
      .catch(err => console.warn("SW error:", err));
  });
}
