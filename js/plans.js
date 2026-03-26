// RedCW — Planes y Pagos

function renderPlansPage(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const plans = REDCW_CONFIG.plans;
  const currentPlan = currentProfile?.plan || "free";

  const features = {
    free: [
      "1 Foro normal",
      "Chats ilimitados",
      "Publicar en Inicio y Foros",
      "Interactuar en todas las secciones",
    ],
    n1: [
      "2 Foros normales + 1 Anónimo",
      "Color personalizado en nombre",
      "Imagen en banner del perfil",
      "Todo lo de Free",
    ],
    n2: [
      "2 Foros normales + 1 Anónimo",
      "1 Grupo en Noticias",
      "Publicar en Noticias",
      "Todo lo de N1",
    ],
    n3: [
      "3 Foros normales + 2 Anónimos",
      "1 Foro oculto (por invitación)",
      "2 Grupos en Noticias",
      "Comentar en modo Anónimo en todas partes",
      "Todo lo de N2",
    ],
  };

  container.innerHTML = Object.entries(plans).map(([key, plan]) => {
    const isCurrent = key === currentPlan;
    const featureList = (features[key] || []).map(f => `<li>✓ ${f}</li>`).join("");
    const price = plan.price > 0
      ? `<span class="plan-price">S/ ${plan.price.toFixed(2)}<small>/mes</small></span>`
      : `<span class="plan-price">${t("planFree")}</span>`;

    return `
      <div class="plan-card ${isCurrent ? "current" : ""} plan-${key}">
        ${isCurrent ? `<div class="plan-current-badge">${t("currentPlan")}</div>` : ""}
        <h3 class="plan-name">${plan.label}</h3>
        ${price}
        <ul class="plan-features">${featureList}</ul>
        ${!isCurrent && plan.price > 0
          ? `<button class="btn-primary" onclick="showPaymentModal('${key}')">${t("upgrade")}</button>`
          : isCurrent
          ? `<button class="btn-secondary" disabled>${t("active")}</button>`
          : `<button class="btn-secondary" disabled>${t("active")}</button>`
        }
      </div>
    `;
  }).join("");
}

// ── Modal de pago ─────────────────────────────────────────────
function showPaymentModal(planKey) {
  const plan = REDCW_CONFIG.plans[planKey];
  const payments = REDCW_CONFIG.payments;
  const contact = REDCW_CONFIG.contact;
  const modal = document.getElementById("payment-modal");
  if (!modal) return;

  document.getElementById("pay-plan-name").textContent = plan.label;
  document.getElementById("pay-plan-price").textContent = `S/ ${plan.price.toFixed(2)}`;

  // QR images
  document.getElementById("yape-qr").src = payments.yapeQR;
  document.getElementById("plin-qr").src = payments.plinQR;
  document.getElementById("yape-number").textContent = payments.yapeNumber;
  document.getElementById("plin-number").textContent = payments.plinNumber;

  // Pre-redact email para comprobante
  document.getElementById("send-receipt-btn").onclick = () => {
    const user = currentProfile;
    const subject = encodeURIComponent(`Comprobante de pago – Plan ${plan.label} – ${user?.username}`);
    const body = encodeURIComponent(
      `Hola equipo RedCW,\n\nAdjunto mi comprobante de pago para el Plan ${plan.label}.\n\n` +
      `── Datos de verificación ──\n` +
      `Usuario: ${user?.display_name || user?.username}\n` +
      `Username: @${user?.username}\n` +
      `Correo de cuenta: (completar)\n` +
      `Plan solicitado: ${plan.label}\n` +
      `Monto pagado: S/ ${plan.price.toFixed(2)}\n` +
      `Método de pago: (Yape / Plin)\n` +
      `Número desde el que se transfirió: \n` +
      `Fecha y hora del pago: \n\n` +
      `Adjunto captura del comprobante.\n\nGracias.`
    );
    window.location.href = `mailto:${contact.helpEmail}?subject=${subject}&body=${body}`;
  };

  modal.classList.add("active");
}

function closePaymentModal() {
  document.getElementById("payment-modal")?.classList.remove("active");
}

// ── Tab Yape / Plin ──────────────────────────────────────────
function selectPayTab(tab) {
  document.querySelectorAll(".pay-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".pay-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  document.getElementById(`panel-${tab}`).classList.add("active");
}
