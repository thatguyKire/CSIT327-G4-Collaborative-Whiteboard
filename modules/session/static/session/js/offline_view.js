document.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("snapshotImage");
  const viewport = document.getElementById("snapshotViewport");
  const skeleton = document.getElementById("snapshotSkeleton");

  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const resetZoomBtn = document.getElementById("resetZoomBtn");
  const zoomLevelEl = document.getElementById("zoomLevel");

  const downloadBtn = document.getElementById("downloadBtn");
  const printBtn = document.getElementById("printBtn");
  const copyLinkBtn = document.getElementById("copyLinkBtn");

  if (!img || !viewport) return;

  // State
  let scale = 1;
  let tx = 0, ty = 0;
  let isPanning = false;
  let startX = 0, startY = 0;

  function applyTransform() {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    zoomLevelEl && (zoomLevelEl.textContent = `${Math.round(scale * 100)}%`);
    viewport.classList.toggle("pannable", scale > 1);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function setScale(nextScale, centerX = viewport.clientWidth / 2, centerY = viewport.clientHeight / 2) {
    const prevScale = scale;
    scale = clamp(nextScale, 0.25, 4);

    // Zoom towards the cursor/focal point: adjust translation so the point stays under the pointer
    const rect = img.getBoundingClientRect();
    const imgCenterX = rect.left + rect.width / 2;
    const imgCenterY = rect.top + rect.height / 2;

    const dx = centerX - imgCenterX;
    const dy = centerY - imgCenterY;

    tx += dx * (1 - prevScale / scale);
    ty += dy * (1 - prevScale / scale);

    applyTransform();
  }

  function resetZoom() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  // Buttons
  zoomInBtn?.addEventListener("click", () => setScale(scale * 1.2));
  zoomOutBtn?.addEventListener("click", () => setScale(scale / 1.2));
  resetZoomBtn?.addEventListener("click", resetZoom);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setScale(scale * 1.2);
    } else if (e.key === "-") {
      e.preventDefault();
      setScale(scale / 1.2);
    } else if (e.key === "0") {
      e.preventDefault();
      resetZoom();
    }
  });

  // Mouse wheel zoom (Ctrl+Wheel for accessibility)
  viewport.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return; // avoid hijacking page scroll
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setScale(scale * delta, cx, cy);
  }, { passive: false });

  // Panning
  viewport.addEventListener("mousedown", (e) => {
    if (scale <= 1) return;
    isPanning = true;
    viewport.classList.add("panning");
    startX = e.clientX - tx;
    startY = e.clientY - ty;
  });
  document.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    tx = e.clientX - startX;
    ty = e.clientY - startY;
    applyTransform();
  });
  document.addEventListener("mouseup", () => {
    if (!isPanning) return;
    isPanning = false;
    viewport.classList.remove("panning");
  });

  // Download / Print / Copy link
  downloadBtn?.addEventListener("click", () => {
    try {
      const a = document.createElement("a");
      a.href = img.currentSrc || img.src;
      a.download = "whiteboard-snapshot.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      window.WhiteboardApp?.showToast?.("Download failed.", "error");
    }
  });

  printBtn?.addEventListener("click", () => window.print());

  copyLinkBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.WhiteboardApp?.showToast?.("Link copied.", "success");
    } catch {
      window.WhiteboardApp?.showToast?.("Copy failed.", "error");
    }
  });

  // Loading skeleton and errors
  function hideSkeleton() {
    skeleton && (skeleton.style.display = "none");
  }

  if (img.complete && img.naturalWidth) {
    hideSkeleton();
    applyTransform();
  } else {
    img.addEventListener("load", () => {
      hideSkeleton();
      applyTransform();
    });
  }
  img.addEventListener("error", () => {
    hideSkeleton();
    const msg = document.createElement("p");
    msg.className = "no-snapshot";
    msg.textContent = "Failed to load snapshot.";
    viewport.replaceChildren(msg);
    window.WhiteboardApp?.showToast?.("Failed to load snapshot.", "error");
  });
});