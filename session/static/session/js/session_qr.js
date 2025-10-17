// Simple QR modal handler: shows image from data-qr-url and allows copying the code.
document.addEventListener("DOMContentLoaded", function () {
  const qrButtons = document.querySelectorAll(".qr-btn");
  const modal = document.getElementById("qrModal");
  const qrImage = document.getElementById("qrImage");
  const qrCodeInput = document.getElementById("qrCodeInput");
  const copyBtn = document.getElementById("copyCodeBtn");
  const closeBtn = document.getElementById("qrClose");

  function openModal(url, code) {
    if (!modal) return;
    if (!url) {
      alert("QR URL is missing for this session. Refresh the page or contact admin.");
      return;
    }
    if (qrImage) {
      qrImage.src = ""; // reset
      qrImage.alt = "Loading QR code...";
      qrImage.src = url + (url.indexOf('?') === -1 ? '?' : '&') + "_=" + Date.now();
      qrImage.onload = () => { qrImage.alt = "QR code"; };
      qrImage.onerror = () => {
        qrImage.alt = "Failed to load QR code";
        qrImage.src = ""; // hide broken icon
      };
    }
    if (qrCodeInput) qrCodeInput.value = code || "";
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    if (qrImage) { qrImage.src = ""; qrImage.onload = qrImage.onerror = null; }
  }

  qrButtons.forEach(btn => btn.addEventListener("click", () => openModal(btn.dataset.qrUrl, btn.dataset.sessionCode)));
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  if (copyBtn && qrCodeInput) copyBtn.addEventListener("click", () => {
    qrCodeInput.select();
    try { document.execCommand("copy"); copyBtn.textContent = "Copied"; setTimeout(()=>copyBtn.textContent="Copy",1200); }
    catch { alert("Copy not supported. Select and copy manually."); }
  });
});