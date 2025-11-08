(() => {
  "use strict";

  const base = document.getElementById("whiteboardCanvas");
  const host = document.getElementById("whiteboardHost") || base?.parentElement;
  if (!base || !host) return;

  // Create / reuse overlay
  let overlay = document.getElementById("annoCanvas");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "annoCanvas";
    host.appendChild(overlay);
  }
  const ctx = overlay.getContext("2d");

  const highlightBtn = document.getElementById("highlightBtn");
  const pinBtn = document.getElementById("pinBtn");
  const clearBtn = document.getElementById("clearBtn");
  const channel = window.WhiteboardChannel; // if realtime exists

  let tool = "none";
  let highlights = [];
  let pins = [];

  function resizeOverlay() {
    // Use base canvas rect (not host) to avoid collapsed host issues
    const r = base.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.max(1, Math.floor(r.width * dpr));
    overlay.height = Math.max(1, Math.floor(r.height * dpr));
    overlay.style.width = r.width + "px";
    overlay.style.height = r.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAll();
  }

  // Initial + reactive sizing
  resizeOverlay();
  window.addEventListener("resize", resizeOverlay);
  // Observe base canvas for size changes
  if (window.ResizeObserver) {
    new ResizeObserver(resizeOverlay).observe(base);
  }

  function drawAll() {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    for (const h of highlights) {
      ctx.save();
      ctx.fillStyle = "rgba(255,235,59,0.35)";
      ctx.strokeStyle = "rgba(255,193,7,0.9)";
      ctx.lineWidth = 2;
      const x2 = h.x + h.w, y2 = h.y + h.h, r = 8;
      ctx.beginPath();
      ctx.moveTo(h.x + r, h.y);
      ctx.arcTo(x2, h.y, x2, y2, r);
      ctx.arcTo(x2, y2, h.x, y2, r);
      ctx.arcTo(h.x, y2, h.x, h.y, r);
      ctx.arcTo(h.x, h.y, x2, h.y, r);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    for (const p of pins) {
      ctx.save();
      ctx.fillStyle = "#e53935";
      ctx.strokeStyle = "#b71c1c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (p.text) {
        ctx.font = "bold 12px system-ui,sans-serif";
        ctx.fillStyle = "#1b1b1b";
        ctx.fillText(p.text, p.x + 12, p.y + 4);
      }
      ctx.restore();
    }
  }

  function setTool(next) {
    tool = tool === next ? "none" : next;
    overlay.style.pointerEvents = tool === "none" ? "none" : "auto";
    highlightBtn?.classList.toggle("active", tool === "highlight");
    pinBtn?.classList.toggle("active", tool === "pin");
  }

  highlightBtn?.addEventListener("click", () => setTool("highlight"));
  pinBtn?.addEventListener("click", () => setTool("pin"));

  let dragStart = null;

  overlay.addEventListener("pointerdown", (e) => {
    if (tool === "none") return;
    const r = base.getBoundingClientRect(); // align with drawing canvas
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (tool === "pin") {
      pins.push({ id: Date.now() + "", x, y, text: "" });
      drawAll();
      return;
    }
    dragStart = { x, y };
  });

  overlay.addEventListener("pointermove", (e) => {
    if (!dragStart || tool !== "highlight") return;
    const r = base.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const x0 = Math.min(dragStart.x, x), y0 = Math.min(dragStart.y, y);
    const w = Math.abs(x - dragStart.x), h = Math.abs(y - dragStart.y);
    drawAll();
    ctx.save();
    ctx.fillStyle = "rgba(255,235,59,0.25)";
    ctx.strokeStyle = "rgba(255,193,7,0.9)";
    ctx.lineWidth = 2;
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeRect(x0, y0, w, h);
    ctx.restore();
  });

  function endHighlight(e) {
    if (!dragStart || tool !== "highlight") return;
    const r = base.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const x0 = Math.min(dragStart.x, x), y0 = Math.min(dragStart.y, y);
    const w = Math.abs(x - dragStart.x), h = Math.abs(y - dragStart.y);
    dragStart = null;
    highlights.push({ id: Date.now() + "", x: x0, y: y0, w, h });
    drawAll();
  }

  overlay.addEventListener("pointerup", endHighlight);
  overlay.addEventListener("pointerleave", endHighlight);

  function clearAnnotationsLocal() {
    highlights = [];
    pins = [];
    drawAll();
  }
  window.clearAnnotations = clearAnnotationsLocal;

  // Hook Clear All button
  clearBtn?.addEventListener("click", () => {
    clearAnnotationsLocal();
    // Broadcast to others (optional)
    channel?.send?.({ type: "broadcast", event: "anno", payload: { t: "clear" } });
  });

  // Listen for remote clear
  channel?.on?.("broadcast", { event: "anno" }, ({ payload }) => {
    if (!payload) return;
    if (payload.t === "clear") {
      clearAnnotationsLocal();
    }
  });
})();