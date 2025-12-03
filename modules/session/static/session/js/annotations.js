(() => {
  "use strict";

  const base = document.getElementById("whiteboardCanvas");
  const host = document.getElementById("whiteboardHost") || base?.parentElement;
  if (!base || !host) return;

  // Overlay canvas (annotations layer)
  let overlay = document.getElementById("annoCanvas");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "annoCanvas";
    host.appendChild(overlay);
  }
  const ctx = overlay.getContext("2d");

  // UI
  const highlightBtn = document.getElementById("highlightBtn");
  const pinBtn = document.getElementById("pinBtn");
  const clearBtn = document.getElementById("clearBtn");
  const clearAnnoBtn = document.getElementById("clearAnnoBtn");

  // Permissions: allow annotations even in view-only mode
  function canAnnotate() {
    // If a stricter rule is needed later, toggle via a global flag.
    return true;
  }

  // Realtime channel (created in whiteboard.js)
  const channel = window.WhiteboardChannel;

  // Data
  let tool = "none";            // "highlight" | "pin" | "none"
  let dragStart = null;
  const highlights = [];        // {id,x,y,w,h,color}
  const pins = [];              // {id,x,y,text}

  // Resize overlay with base canvas
  function resizeOverlay() {
    const r = base.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.max(1, Math.floor(r.width * dpr));
    overlay.height = Math.max(1, Math.floor(r.height * dpr));
    overlay.style.width = r.width + "px";
    overlay.style.height = r.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAll();
  }
  resizeOverlay();
  window.addEventListener("resize", resizeOverlay);
  if (window.ResizeObserver) new ResizeObserver(resizeOverlay).observe(base);

  // Draw all annotations
  function drawAll() {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    // Highlights
    for (const h of highlights) {
      ctx.save();
      ctx.fillStyle = h.color || "rgba(255,235,59,0.30)";
      ctx.strokeStyle = "rgba(255,193,7,0.95)";
      ctx.lineWidth = 2;
      const x2 = h.x + h.w, y2 = h.y + h.h, r = 10;
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
    // Pins
    for (const p of pins) {
      ctx.save();
      ctx.fillStyle = "#e53935";
      ctx.strokeStyle = "#b71c1c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (p.text) {
        ctx.font = "bold 12px system-ui";
        ctx.fillStyle = "#1b1b1b";
        ctx.fillText(p.text, p.x + 12, p.y + 4);
      }
      ctx.restore();
    }
  }

  // Tool toggle
  function setTool(next) {
    if (!canAnnotate()) return;
    tool = tool === next ? "none" : next;
    overlay.style.pointerEvents = tool === "none" ? "none" : "auto";
    highlightBtn?.classList.toggle("active", tool === "highlight");
    pinBtn?.classList.toggle("active", tool === "pin");
  }
  highlightBtn?.addEventListener("click", () => setTool("highlight"));
  pinBtn?.addEventListener("click", () => setTool("pin"));

  // Pointer events on overlay
  overlay.addEventListener("pointerdown", (e) => {
    if (!canAnnotate() || tool === "none") return;
    const r = base.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    if (tool === "pin") {
      const pin = { id: Date.now() + "", x, y, text: "" };
      pins.push(pin);
      drawAll();
      broadcastPin(pin);
      // record annotation change in whiteboard history so undo/redo includes it
      try {
        if (window.WhiteboardApp && typeof window.WhiteboardApp.recordSnapshot === 'function') {
          window.WhiteboardApp.recordSnapshot('pin-add');
        } else if (typeof window.requestSnapshotLocal === 'function') {
          window.requestSnapshotLocal('pin-add');
        }
      } catch(e) { console.warn('pin snapshot failed', e); }
      return;
    }
    // highlight start
    dragStart = { x, y };
  });

  overlay.addEventListener("pointermove", (e) => {
    if (!dragStart || tool !== "highlight" || !canAnnotate()) return;
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
    if (!dragStart || tool !== "highlight" || !canAnnotate()) return;
    const r = base.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const x0 = Math.min(dragStart.x, x), y0 = Math.min(dragStart.y, y);
    const w = Math.abs(x - dragStart.x), h = Math.abs(y - dragStart.y);
    dragStart = null;
    // Skip zero-size
    if (w < 4 || h < 4) { drawAll(); return; }
    const hl = { id: Date.now() + "", x: x0, y: y0, w, h, color: "rgba(255,235,59,0.30)" };
    highlights.push(hl);
    drawAll();
    broadcastHighlight(hl);
    // record annotation change in whiteboard history so undo/redo includes it
    try {
      if (window.WhiteboardApp && typeof window.WhiteboardApp.recordSnapshot === 'function') {
        window.WhiteboardApp.recordSnapshot('highlight-add');
      } else if (typeof window.requestSnapshotLocal === 'function') {
        window.requestSnapshotLocal('highlight-add');
      }
    } catch(e) { console.warn('highlight snapshot failed', e); }
  }
  overlay.addEventListener("pointerup", endHighlight);
  overlay.addEventListener("pointerleave", endHighlight);

  // Local clear
  function clearAnnotationsLocal() {
    highlights.length = 0;
    pins.length = 0;
    drawAll();
  }
  window.clearAnnotations = clearAnnotationsLocal;

  // Hook Clear All button (already broadcasts stroke clear elsewhere)
  clearBtn?.addEventListener("click", () => {
    clearAnnotationsLocal();
    // Also broadcast anno clear so remote overlays wipe even if stroke clear lost.
    channel?.send({ type: "broadcast", event: "anno", payload: { t: "clear" } });
    try { window.WhiteboardApp?.recordSnapshot('anno-clear'); } catch(e) {}
  });

  clearAnnoBtn?.addEventListener("click", () => {
    clearAnnotationsLocal();
    channel?.send({ type: "broadcast", event: "anno", payload: { t: "clear" } });
  });

  // ---------- Realtime Broadcast Helpers ----------
  function broadcastHighlight(hl) {
    if (!channel) return;
    const r = base.getBoundingClientRect();
    channel.send({
      type: "broadcast",
      event: "anno",
      payload: {
        t: "hl",
        id: hl.id,
        x: hl.x / r.width,
        y: hl.y / r.height,
        w: hl.w / r.width,
        h: hl.h / r.height,
        c: hl.color
      }
    });
  }
  function broadcastPin(pin) {
    if (!channel) return;
    const r = base.getBoundingClientRect();
    channel.send({
      type: "broadcast",
      event: "anno",
      payload: {
        t: "pin",
        id: pin.id,
        x: pin.x / r.width,
        y: pin.y / r.height,
        txt: pin.text || ""
      }
    });
  }

  // ---------- Realtime Receive ----------
  channel?.on("broadcast", { event: "anno" }, ({ payload }) => {
    if (!payload) return;
    const r = base.getBoundingClientRect();
    switch (payload.t) {
      case "hl": {
        // avoid duplicates by id
        if (highlights.some(h => h.id === payload.id)) return;
        highlights.push({
          id: payload.id,
          x: (payload.x || 0) * r.width,
          y: (payload.y || 0) * r.height,
          w: (payload.w || 0) * r.width,
          h: (payload.h || 0) * r.height,
          color: payload.c || "rgba(255,235,59,0.30)"
        });
        drawAll();
        // ensure receivers record this annotation in their local history
        try { if (typeof window.requestSnapshotLocal === 'function') window.requestSnapshotLocal('remote-highlight'); } catch(e) { console.warn('remote highlight snapshot failed', e); }
        break;
      }
      case "pin": {
        if (pins.some(p => p.id === payload.id)) return;
        pins.push({
          id: payload.id,
          x: (payload.x || 0) * r.width,
          y: (payload.y || 0) * r.height,
          text: payload.txt || ""
        });
        drawAll();
        // ensure receivers record this annotation in their local history
        try { if (typeof window.requestSnapshotLocal === 'function') window.requestSnapshotLocal('remote-pin'); } catch(e) { console.warn('remote pin snapshot failed', e); }
        break;
      }
      case "clear":
        clearAnnotationsLocal();
        try { if (typeof window.requestSnapshotLocal === 'function') window.requestSnapshotLocal('remote-anno-clear'); } catch(e) { console.warn('remote anno-clear snapshot failed', e); }
        break;
    }
  });

  // Also clear annotations if stroke layer cleared (teacher pressed Clear)
  channel?.on("broadcast", { event: "stroke" }, ({ payload }) => {
    if (payload?.t === "clear" || payload?.t === "clear_all") clearAnnotationsLocal();
  });

  // Expose a small API so the whiteboard's undo/redo snapshot system
  // can include and restore annotation state.
  window.AnnotationAPI = {
    getState: () => ({ highlights: highlights.slice(), pins: pins.slice() }),
    restoreState: (state) => {
      try {
        highlights.length = 0;
        pins.length = 0;
        if (!state) { drawAll(); return; }
        if (Array.isArray(state.highlights)) highlights.push(...state.highlights);
        if (Array.isArray(state.pins)) pins.push(...state.pins);
        drawAll();
      } catch (e) { console.warn('Annotation restore failed', e); }
    },
    clear: () => { clearAnnotationsLocal(); }
  };
})();