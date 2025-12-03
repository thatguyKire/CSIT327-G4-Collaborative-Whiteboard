(() => {
  "use strict";
  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) return;

  // Dynamic fit-to-viewport (keeps toolbar + participants visible)
  function resizeMainCanvas() {
    // Unified simple sizing: use parent width & fixed min height without DPR scaling.
    const parent = canvas.parentElement;
    const w = parent ? parent.getBoundingClientRect().width : 1200;
    const h = Math.max(500, window.innerHeight - 220); // leave room for toolbar/title
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = w;    // 1:1 pixel mapping for accurate pointer alignment
    canvas.height = h;
  }
  window.addEventListener("resize", resizeMainCanvas);
  resizeMainCanvas();

  // If you already had drawing logic below, keep it here.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let canDraw = typeof window.CAN_DRAW === "boolean"
    ? window.CAN_DRAW
    : JSON.parse(document.getElementById("can_draw_data")?.textContent || "false");

  // UI Elements
  const colorPicker = document.getElementById("colorPicker");
  const sizePicker = document.getElementById("sizePicker");
  const penBtn = document.getElementById("penBtn");
  const eraserBtn = document.getElementById("eraserBtn");
  const clearBtn = document.getElementById("clearBtn");
  const exportBtn = document.getElementById("exportBtn");
  const saveBtn = document.getElementById("saveBtn");
  const backBtn = document.getElementById("backBtn");
  const snapshotImg = document.getElementById("snapshotImg");
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  const fileInput = document.getElementById("fileInput");
  const drawToolbar = document.getElementById("drawToolbar");
  const viewOnlyBanner = document.getElementById("viewOnlyBanner");
  const highlightBtn = document.getElementById("highlightBtn");
  const pinBtn = document.getElementById("pinBtn");
  const pinLayer = document.getElementById("pinLayer");
  const chatToggleBtn = document.getElementById("chatToggleBtn");

  let highlightMode = false;
  let pinMode = false;

  // Accessibility: add ARIA to toolbar controls
  const addA11yButton = (el, label, pressed = null) => {
    if (!el) return;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", label);
    if (pressed !== null) el.setAttribute("aria-pressed", pressed ? "true" : "false");
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.click();
      }
    });
  };
  addA11yButton(penBtn, "Pen tool", true);
  addA11yButton(eraserBtn, "Eraser tool", false);
  addA11yButton(clearBtn, "Clear whiteboard");
  addA11yButton(exportBtn, "Export board as image");
  addA11yButton(saveBtn, "Save snapshot");
  addA11yButton(backBtn, "Go back");
  addA11yButton(undoBtn, "Undo");
  addA11yButton(redoBtn, "Redo");

  // Toast for user-friendly messages (aria-live)
  let toastEl = document.getElementById("wb-toast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "wb-toast";
    toastEl.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 14px;border-radius:6px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:9999;font:14px/1.3 system-ui, -apple-system, Segoe UI, Roboto;";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
  }
  let toastTimer;
  function showToast(msg, type = "info") {
    if (!toastEl) return alert(msg);
    toastEl.textContent = msg;
    toastEl.style.background = type === "error" ? "#c0392b" : type === "success" ? "#2ecc71" : "#333";
    toastEl.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.style.opacity = "0"), 2500);
  }

  // State
  let drawing = false;
  let lastX = 0, lastY = 0;
  let currentColor = "#000";
  let lineWidth = 3;
  let erasing = false;

  // Images
  let images = [];
  let activeImage = null;
  let dragging = false;
  let resizing = false;
  let offsetX = 0, offsetY = 0;
  const resizeHandleSize = 15;
  let nextImageId = 1;

  // Offscreen canvas for strokes only
  let strokeCanvas = document.createElement("canvas");
  let strokeCtx = strokeCanvas.getContext("2d", { willReadFrequently: true });

  // Remote strokes handling (moved from bottom)
  const remoteStrokeLayers = {}; // sid -> offscreen canvas context

  // Performance: throttle redraws with rAF
  let redrawPending = false;
  function scheduleRedraw() {
    if (redrawPending) return;
    redrawPending = true;
    requestAnimationFrame(() => {
      // Always include remote layers so other users' strokes don't disappear
      if (typeof redrawWithRemotes === "function") {
        redrawWithRemotes();
      } else {
        redrawAll();
      }
      redrawPending = false;
    });
  }

  // Undo/Redo
  const history = [];
  const redoStack = [];
  const MAX_HISTORY = 50;
  let wheelRotateDebounce;
  function getSelfLayer() {
    return getRemoteCtx(String(window.CURRENT_USER_ID));
  }
  function snapshotState(reason = "") {
    try {
      // capture current user's stroke layer pixels
      const self = getSelfLayer();
      const sw = self.canvas.width, sh = self.canvas.height;
      const strokeData = self.getImageData ? self.getImageData(0, 0, sw, sh) : self.canvas.getContext("2d").getImageData(0, 0, sw, sh);
      // shallow copy images metadata, keep same img references
      const imagesCopy = images.map(i => ({
        id: i.id,
        img: i.img,
        x: i.x,
        y: i.y,
        width: i.width,
        height: i.height,
        rotation: i.rotation || 0
      }));
      // include annotations state when available
      const annotationsState = (window.AnnotationAPI && typeof window.AnnotationAPI.getState === 'function')
        ? window.AnnotationAPI.getState()
        : { highlights: [], pins: [] };

      const snap = {
        strokeWidth: sw,
        strokeHeight: sh,
        strokeData,
        images: imagesCopy,
        activeId: activeImage ? activeImage.id : null,
        annotations: annotationsState
      };
      history.push(snap);
      while (history.length > MAX_HISTORY) history.shift();
      // new action invalidates redo
      redoStack.length = 0;
    } catch (e) {
      console.error("Snapshot failed", e);
    }
  }
  function restoreSnapshot(snap) {
    if (!snap) return;
    // size mismatch due to resize: cannot restore pixels safely
    const self = getSelfLayer();
    if (snap.strokeWidth !== self.canvas.width || snap.strokeHeight !== self.canvas.height) {
      showToast("Canvas size changed; undo history cleared.", "info");
      history.length = 0;
      redoStack.length = 0;
      return;
    }
    try {
      getSelfLayer().putImageData(snap.strokeData, 0, 0);
      // restore images (reuse existing Image objects where possible)
      const map = new Map(snap.images.map(i => [i.id, i]));
      images = snap.images.map(meta => ({
        ...meta,
        img: meta.img // same object
      }));
      activeImage = images.find(i => i.id === snap.activeId) || null;
      // restore annotations if present
      try {
        if (snap.annotations && window.AnnotationAPI && typeof window.AnnotationAPI.restoreState === 'function') {
          window.AnnotationAPI.restoreState(snap.annotations);
        }
      } catch (e) { console.warn('Failed to restore annotations', e); }
      scheduleRedraw();
    } catch (e) {
      console.error("Restore failed", e);
      showToast("Undo failed.", "error");
    }
  }
  function undo(broadcast = true) {
    if (history.length <= 1) {
      showToast("Nothing to undo.", "info");
      return;
    }
    const current = history.pop(); // current state
    redoStack.push(current);
    const previous = history[history.length - 1];
    restoreSnapshot(previous);
    // broadcast to other clients unless explicitly disabled
    if (broadcast && typeof channel !== 'undefined' && channel) {
      try { channel.send({ type: 'broadcast', event: 'history', payload: { t: 'undo', sid: String(window.CURRENT_USER_ID) } }); } catch (e) { console.warn('undo broadcast failed', e); }
    }
  }
  function redo(broadcast = true) {
    if (redoStack.length === 0) {
      showToast("Nothing to redo.", "info");
      return;
    }
    const next = redoStack.pop();
    // push current into history
    try {
      const self = getSelfLayer();
      const strokeData = self.getImageData(0, 0, self.canvas.width, self.canvas.height);
      const imagesCopy = images.map(i => ({
        id: i.id, img: i.img, x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation || 0
      }));
      history.push({
        strokeWidth: self.canvas.width,
        strokeHeight: self.canvas.height,
        strokeData,
        images: imagesCopy,
        activeId: activeImage ? activeImage.id : null,
        annotations: (window.AnnotationAPI && typeof window.AnnotationAPI.getState === 'function') ? window.AnnotationAPI.getState() : { highlights: [], pins: [] }
      });
    } catch {}
    restoreSnapshot(next);
    // broadcast redo
    if (broadcast && typeof channel !== 'undefined' && channel) {
      try { channel.send({ type: 'broadcast', event: 'history', payload: { t: 'redo', sid: String(window.CURRENT_USER_ID) } }); } catch (e) { console.warn('redo broadcast failed', e); }
    }
  }
  document.addEventListener("keydown", (e) => {
    const cmdCtrl = e.ctrlKey || e.metaKey;
    if (cmdCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((cmdCtrl && e.key.toLowerCase() === "y") || (cmdCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
      e.preventDefault();
      redo();
    }
  });

  // ========================================
  // CANVAS RESIZE
  // ========================================
  function resizeCanvas() {
    // 1. Save base layer (strokeCanvas)
    const tempBase = document.createElement("canvas");
    tempBase.width = strokeCanvas.width;
    tempBase.height = strokeCanvas.height;
    if (tempBase.width > 0 && tempBase.height > 0) {
      tempBase.getContext("2d").drawImage(strokeCanvas, 0, 0);
    }

    // 2. Resize base layer
    strokeCanvas.width = canvas.width;
    strokeCanvas.height = canvas.height;
    strokeCtx = strokeCanvas.getContext("2d", { willReadFrequently: true });

    // 3. Restore base layer
    if (tempBase.width > 0 && tempBase.height > 0) {
      strokeCtx.drawImage(tempBase, 0, 0);
    }

    // 4. Handle remote layers (user strokes)
    Object.values(remoteStrokeLayers).forEach(layer => {
      const tempLayer = document.createElement("canvas");
      tempLayer.width = layer.canvas.width;
      tempLayer.height = layer.canvas.height;
      if (tempLayer.width > 0 && tempLayer.height > 0) {
        tempLayer.getContext("2d").drawImage(layer.canvas, 0, 0);
      }

      layer.canvas.width = canvas.width;
      layer.canvas.height = canvas.height;
      
      if (tempLayer.width > 0 && tempLayer.height > 0) {
        layer.ctx.drawImage(tempLayer, 0, 0);
      }
    });

    scheduleRedraw();
  }
  resizeCanvas();
  window.addEventListener("resize", () => { resizeMainCanvas(); resizeCanvas(); });

  // ========================================
  // REDRAW EVERYTHING
  // ========================================
  function redrawAll() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear main canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    // Draw base layer (snapshot/background) first
    try {
      ctx.drawImage(strokeCanvas, 0, 0, width, height);
    } catch (e) { /* noop */ }

    // Draw images (middle layer)
    images.forEach(item => {
      ctx.save();
      ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
      ctx.rotate((item.rotation || 0) * Math.PI / 180);
      ctx.drawImage(item.img, -item.width / 2, -item.height / 2, item.width, item.height);
      ctx.restore();
    });

    // Strokes are composited from per-user layers in redrawWithRemotes()

    // Draw selection handles
    if (activeImage && canDraw) {
      ctx.strokeStyle = "#3498db";
      ctx.lineWidth = 3;
      ctx.strokeRect(activeImage.x, activeImage.y, activeImage.width, activeImage.height);

      // Resize handle
      ctx.fillStyle = "#3498db";
      ctx.fillRect(
        activeImage.x + activeImage.width - resizeHandleSize,
        activeImage.y + activeImage.height - resizeHandleSize,
        resizeHandleSize,
        resizeHandleSize
      );

      // Delete button
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(activeImage.x + activeImage.width - 22, activeImage.y - 22, 22, 22);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Arial";
      ctx.fillText("✕", activeImage.x + activeImage.width - 16, activeImage.y - 5);
    }
  }

  // ========================================
  // DRAWING
  // ========================================
  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // send helper (normalized coordinates)
  function nx(e){ return e.offsetX / canvas.getBoundingClientRect().width; }
  function ny(e){ return e.offsetY / canvas.getBoundingClientRect().height; }
  function send(t, e, extra = {}) {
    if (!channel) return;
    channel.send({
      type: "broadcast",
      event: "stroke",
      payload: { t, x: e ? nx(e) : 0, y: e ? ny(e) : 0, sid: window.CURRENT_USER_ID, ...extra }
    });
  }

  // draw handlers (single binding point)
  function startDraw(e) {
    if (!canDraw) return;
    // ignore starting a stroke on top of an image control
    const p = getCoords(e);
    if (hitTest(p.x, p.y)) return;
    // Ensure there's an initial snapshot so the very first stroke can be undone
    if (history.length === 0) {
      try { snapshotState("init"); } catch {}
    }
    drawing = true;
    lastX = p.x; lastY = p.y;
    const selfCtx = getRemoteCtx(String(window.CURRENT_USER_ID));
    selfCtx.lineWidth = lineWidth;
    selfCtx.lineCap = "round";
    selfCtx.strokeStyle = erasing ? "#fff" : currentColor;
    selfCtx.globalAlpha = 1;
    selfCtx.beginPath();
    selfCtx.moveTo(lastX, lastY);
    scheduleRedraw();
    send("begin", e, { c: selfCtx.strokeStyle, w: selfCtx.lineWidth });
  }

  function draw(e) {
    if (!drawing) return;
    const p = getCoords(e);
    const selfCtx = getRemoteCtx(String(window.CURRENT_USER_ID));
    selfCtx.lineWidth = lineWidth;
    selfCtx.strokeStyle = erasing ? "#fff" : currentColor;
    selfCtx.globalAlpha = 1;
    selfCtx.beginPath();
    selfCtx.moveTo(lastX, lastY);
    selfCtx.lineTo(p.x, p.y);
    selfCtx.stroke();
    lastX = p.x; lastY = p.y;
    // broadcast intermediate point
    send("draw", e);
    // update visible canvas for the drawer
    scheduleRedraw();
  }

  function stopDraw(e) {
    if (!drawing) return;
    drawing = false;
    const selfCtx = getRemoteCtx(String(window.CURRENT_USER_ID));
    selfCtx.globalAlpha = 1;
    snapshotState("stroke");
    scheduleRedraw();
    send("end", e);
    // Ensure eraser effects are reflected remotely
    if (erasing) broadcastLayerSync();
    // Removed unused POST ping that caused 403 (Forbidden)
    // if (window.CURRENT_SESSION_ID) {
    //   fetch(`/session/${window.CURRENT_SESSION_ID}/stroke/`, {
    //     method: "POST",
    //     headers: { "X-CSRFToken": getCookie("csrftoken") }
    //   }).catch(()=>{});
    // }
  }

  // bind/unbind so permission can toggle live
  function bindDrawingHandlers() {
    if (bindDrawingHandlers.bound) return;
    canvas.addEventListener("pointerdown", startDraw);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stopDraw);
    canvas.addEventListener("pointerout", stopDraw);
    bindDrawingHandlers.bound = true;
  }
  function unbindDrawingHandlers() {
    if (!bindDrawingHandlers.bound) return;
    canvas.removeEventListener("pointerdown", startDraw);
    canvas.removeEventListener("pointermove", draw);
    canvas.removeEventListener("pointerup", stopDraw);
    canvas.removeEventListener("pointerout", stopDraw);
    bindDrawingHandlers.bound = false;
  }
  if (canDraw) bindDrawingHandlers(); else unbindDrawingHandlers();

  // Enable/disable tools instantly when permission changes
  function setDisabled(el, v){ if (el) el.disabled = !!v; }
  function updatePermissionUI() {
    if (canDraw) {
      viewOnlyBanner.style.display = "none";
      drawToolbar.style.display = "flex";
      bindDrawingHandlers();
      canvas.style.pointerEvents = "auto";
    } else {
      viewOnlyBanner.style.display = "block";
      drawToolbar.style.display = "none";
      drawing = false; dragging = false; resizing = false; activeImage = null;
      unbindDrawingHandlers();
      canvas.style.pointerEvents = "none";
    }
  }
  updatePermissionUI();

  // Expose permission apply function
  window.WhiteboardApp = {
    get canDraw(){ return canDraw; },
    set canDraw(v){ canDraw = !!v; updatePermissionUI(); },
    addImageFromUrl,
    showToast,
    getCookie,
    // allow external modules (annotations) to record a snapshot including annotations
    recordSnapshot: (reason = "external") => { try { snapshotState(reason); } catch(e){ console.warn('recordSnapshot failed', e); } }
  };

  // Lightweight global helper so other modules can request a local snapshot
  // even if `WhiteboardApp.recordSnapshot` isn't present at load time.
  window.requestSnapshotLocal = (reason = "external") => {
    try { snapshotState(reason); } catch (e) { console.warn('requestSnapshotLocal failed', e); }
  };

  // ========================================
  // IMAGE INTERACTIONS
  // ========================================
  function hitTest(x, y) {
    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      // Note: hit test ignores rotation for simplicity
      if (x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height) {
        return img;
      }
    }
    return null;
  }

  // Image realtime broadcast helper
  function broadcastImage(action, img) {
    if (!channel || !img) return;
    const rect = canvas.getBoundingClientRect();
    const payload = {
      t: action,
      id: img.id,
      x: img.x / rect.width,
      y: img.y / rect.height,
      w: img.width / rect.width,
      h: img.height / rect.height,
      r: img.rotation || 0
    };
    channel.send({ type: "broadcast", event: "image", payload });
  }

  function broadcastDelete(imgId) {
    if (!channel) return;
    channel.send({ type: "broadcast", event: "image", payload: { t: "delete", id: imgId } });
  }

  let lastMoveSent = 0;
  const MOVE_INTERVAL = 80; // ms throttle

  canvas.addEventListener("pointerdown", (e) => {
    if (!canDraw) return;

    const p = getCoords(e);
    const img = hitTest(p.x, p.y);

    if (img) {
      // Bring to front
      images = images.filter(i => i !== img);
      images.push(img);
      activeImage = img;

      // Delete button
      if (p.x >= img.x + img.width - 22 && p.x <= img.x + img.width &&
          p.y >= img.y - 22 && p.y <= img.y) {
        const before = images.slice();
        images = images.filter(i => i !== img);
        activeImage = null;
        scheduleRedraw();
        snapshotState("delete-image");
        return;
      }

      // Resize handle
      if (p.x >= img.x + img.width - resizeHandleSize &&
          p.y >= img.y + img.height - resizeHandleSize) {
        resizing = true;
      } else {
        dragging = true;
        offsetX = p.x - img.x;
        offsetY = p.y - img.y;
      }
      scheduleRedraw();
    } else {
      activeImage = null;
      scheduleRedraw();
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!canDraw) return;

    const p = getCoords(e);

    if (dragging && activeImage) {
      activeImage.x = p.x - offsetX;
      activeImage.y = p.y - offsetY;
      scheduleRedraw();
      const now = performance.now();
      if (now - lastMoveSent > MOVE_INTERVAL) {
        lastMoveSent = now;
        broadcastImage("move", activeImage);
      }
    } else if (resizing && activeImage) {
      activeImage.width = Math.max(30, p.x - activeImage.x);
      activeImage.height = Math.max(30, p.y - activeImage.y);
      scheduleRedraw();
      const now = performance.now();
      if (now - lastMoveSent > MOVE_INTERVAL) {
        lastMoveSent = now;
        broadcastImage("resize", activeImage);
      }
    }
  });

  canvas.addEventListener("pointerup", () => {
    if (dragging || resizing) {
      dragging = false;
      resizing = false;
      snapshotState("image-transform");
      if (activeImage) {
        broadcastImage("transform", activeImage);
      }
    }
  });

  // Rotate with Shift + Wheel (debounced snapshot)
  canvas.addEventListener("wheel", (e) => {
    if (activeImage && e.shiftKey && canDraw) {
      e.preventDefault();
      activeImage.rotation = (activeImage.rotation || 0) + e.deltaY * -0.1;
      scheduleRedraw();
      clearTimeout(wheelRotateDebounce);
      wheelRotateDebounce = setTimeout(() => {
        snapshotState("image-rotate");
        if (activeImage) broadcastImage("rotate", activeImage);
      }, 250);
    }
  }, { passive: false });

  // Delete with keyboard
  document.addEventListener("keydown", (e) => {
    if (!activeImage || !canDraw) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const deletedId = activeImage.id;                 // fix: keep id before nulling
      images = images.filter(i => i !== activeImage);
      activeImage = null;
      scheduleRedraw();
      snapshotState("delete-image");
      broadcastDelete(deletedId);                       // fix: broadcast correct id
    }
  });

  // ========================================
  // TOOLBAR
  // ========================================
  colorPicker?.addEventListener("input", e => currentColor = e.target.value);
  sizePicker?.addEventListener("input", e => {
    const v = parseInt(e.target.value, 10);
    if (isNaN(v) || v <= 0) {
      showToast("Invalid brush size.", "error");
      return;
    }
    lineWidth = v;
  });

  function setToolButtons() {
    if (penBtn) {
      if (!erasing) {
        penBtn.classList.add("active");
        penBtn.setAttribute("aria-pressed", "true");
      } else {
        penBtn.classList.remove("active");
        penBtn.setAttribute("aria-pressed", "false");
      }
    }
    if (eraserBtn) {
      if (erasing) {
        eraserBtn.classList.add("active");
        eraserBtn.setAttribute("aria-pressed", "true");
      } else {
        eraserBtn.classList.remove("active");
        eraserBtn.setAttribute("aria-pressed", "false");
      }
    }
  }

  penBtn?.addEventListener("click", () => {
    erasing = false;
    setToolButtons();
  });

  eraserBtn?.addEventListener("click", () => {
    erasing = true;
    setToolButtons();
  });

  clearBtn?.addEventListener("click", () => {
    if (!canDraw) return showToast("You don't have permission to clear.", "error");
    if (!window.IS_TEACHER) return showToast("Only the teacher can clear.", "error");
    if (!confirm("Clear everything? This will delete all drawings and images.")) return;

    const rect = canvas.getBoundingClientRect();
    // Clear all local stroke layers (including per-user layers)
    try {
      Object.values(remoteStrokeLayers).forEach(obj => obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height));
    } catch {}
    // Also clear legacy base layer for safety
    strokeCtx.clearRect(0, 0, rect.width, rect.height);

    images = [];
    activeImage = null;
    // Reset history so cleared state becomes the new baseline
    history.length = 0;
    redoStack.length = 0;
    snapshotState("clear");
    scheduleRedraw();
    showToast("Board cleared.", "success");

    // Broadcast a clear_all so every client resets local + remote layers
    channel?.send({ type: "broadcast", event: "stroke", payload: { t: "clear_all", sid: String(window.CURRENT_USER_ID) } });
    channel?.send({ type: "broadcast", event: "image", payload: { t: "clear_all" } });
  });

  // ========================================
  // EXPORT
  // ========================================
  exportBtn?.addEventListener("click", () => {
    try {
      const link = document.createElement("a");
      link.download = "whiteboard.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Exported as whiteboard.png", "success");
    } catch (e) {
      console.error(e);
      showToast("Export failed.", "error");
    }
  });

  // ========================================
  // SAVE
  // ========================================
  saveBtn?.addEventListener("click", () => {
    if (!canDraw) return showToast("You don't have permission to save.", "error");
    const saveUrl = saveBtn.dataset.saveUrl;
    if (!saveUrl) return showToast("Save URL missing.", "error");

    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    saveBtn.textContent = "Saving...";

    canvas.toBlob(blob => {
      if (!blob) {
        showToast("Failed to generate image.", "error");
        saveBtn.textContent = prev;
        saveBtn.disabled = false;
        return;
      }
      const fd = new FormData();
      fd.append("image", blob, "snapshot.png");

      fetch(saveUrl, {
        method: "POST",
        body: fd,
        headers: { "X-CSRFToken": getCookie("csrftoken") }
      })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => {
        if (d.ok) {
          saveBtn.textContent = "✅ Saved!";
          showToast("Snapshot saved.", "success");
          setTimeout(() => {
            saveBtn.textContent = prev;
            saveBtn.disabled = false;
          }, 1500);
        } else {
          throw new Error(d.error || "Unknown error");
        }
      })
      .catch(err => {
        console.error("Save error:", err);
        showToast("Save failed.", "error");
        saveBtn.textContent = prev;
        saveBtn.disabled = false;
      });
    }, "image/png");
  });

  // ========================================
  // BACK BUTTON
  // ========================================
  backBtn?.addEventListener("click", () => {
    const url = backBtn.dataset.backUrl;
    if (url) {
      window.location.href = url;
    } else {
      window.history.back();
    }
  });

  // ========================================
  // RESTORE SNAPSHOT (as background layer if available)
  // ========================================
  (function restoreBackgroundSnapshot(){
    const url = (typeof window.SNAPSHOT_URL === 'string' && window.SNAPSHOT_URL.length) ? window.SNAPSHOT_URL : null;
    if (!url) {
      snapshotState("init");
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      // Draw as background (base stroke layer). Users can draw over and clear it.
      try {
        strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
        strokeCtx.drawImage(img, 0, 0, strokeCanvas.width, strokeCanvas.height);
      } catch {}
      scheduleRedraw();
      // Start history from a clean state after background is applied
      history.length = 0; redoStack.length = 0; snapshotState("init");
    };
    img.onerror = () => {
      showToast("Failed to restore previous snapshot.", "error");
      snapshotState("init");
    };
  })();

  // ========================================
  // PUBLIC API FOR UPLOAD MODULE
  // ========================================
  function addImageFromUrl(url, opts = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;

      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        const maxWidth = rect.width * 0.4;
        const maxHeight = rect.height * 0.4;

        let width = img.width * 0.3;
        let height = img.height * 0.3;

        // Maintain aspect ratio
        const aspectRatio = img.width / img.height;
        if (width / height > aspectRatio) {
          width = height * aspectRatio;
        } else {
          height = width / aspectRatio;
        }

        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width *= scale;
          height *= scale;
        }

        // If coords provided (from realtime), use them; else center
        const x = Number.isFinite(opts.x) ? opts.x : (rect.width / 2 - width / 2);
        const y = Number.isFinite(opts.y) ? opts.y : (rect.height / 2 - height / 2);
        if (Number.isFinite(opts.width))  width  = opts.width;
        if (Number.isFinite(opts.height)) height = opts.height;

        const item = {
          id: opts.id != null ? String(opts.id) : String(nextImageId++),
          img, x, y, width, height, rotation: 0
        };
        images.push(item);
        activeImage = item;

        scheduleRedraw();
        snapshotState("add-image");
        resolve(item);
      };

      img.onerror = () => {
        showToast("Failed to load image.", "error");
        reject(new Error("Failed to load image"));
      };
    });
  }

  // ========================================
  // HELPERS
  // ========================================
  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }

  // Expose limited API for other modules
  window.WhiteboardApp = {
    get canDraw(){ return canDraw; },
    set canDraw(v){ canDraw = !!v; updatePermissionUI(); },
    addImageFromUrl,
    showToast,
    getCookie
    ,
    // allow external modules (annotations) to record a snapshot including annotations
    recordSnapshot: (reason = "external") => { try { snapshotState(reason); } catch(e){ console.warn('recordSnapshot failed', e); } }
  };

  // Undo/Redo structures exist here (history, redoStack, snapshotState, undo, redo)
  // Add a small helper to reflect availability in the buttons
  function updateUndoRedoButtons() {
    if (undoBtn) undoBtn.disabled = history.length <= 1;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }
  // Call after any history mutation
  const _snapshotState = snapshotState;
  snapshotState = function(reason = "") {
    _snapshotState(reason);
    updateUndoRedoButtons();
  };
  const _restoreSnapshot = restoreSnapshot;
  restoreSnapshot = function(snap) {
    _restoreSnapshot(snap);
    updateUndoRedoButtons();
  };
  const _undo = undo;
  undo = function(broadcast = true) {
    _undo(broadcast);
    updateUndoRedoButtons();
    // Sync this user's layer to others after undo
    broadcastLayerSync();
  };
  const _redo = redo;
  redo = function(broadcast = true) {
    _redo(broadcast);
    updateUndoRedoButtons();
    // Sync this user's layer to others after redo
    broadcastLayerSync();
  };

  // Wire buttons (allow undo/redo even when view-only so annotations can be reverted)
  undoBtn?.addEventListener("click", (e) => { e.preventDefault(); undo(); });
  redoBtn?.addEventListener("click", (e) => { e.preventDefault(); redo(); });

  // After initial setup
  updateUndoRedoButtons();

  // Supabase Realtime
  const supa = (window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null;

  const channelName = `wb:${window.CURRENT_SESSION_ID}`;
  const channel = supa?.channel(channelName, {
    config: { broadcast: { ack: false }, presence: { key: String(window.CURRENT_USER_ID || "anon") } }
  });
  window.WhiteboardChannel = channel;

  // subscribe so events flow
  channel?.subscribe((status) => {
    console.log("Realtime status:", status, channelName);
    if (status === "SUBSCRIBED") {
      try {
        channel.track({ uid: String(window.CURRENT_USER_ID), role: window.IS_TEACHER ? "teacher" : "student" });
      } catch (e) {
        console.warn("Presence track failed", e);
      }
    }
  });

  // Realtime meta events (chat toggle)
  channel?.on("broadcast", { event: "meta" }, ({ payload }) => {
    if (!payload || payload.t !== "chat") return;
    const enabled = !!payload.enabled;
    window.CHAT_ENABLED = enabled;
    // Delegate UI/state to chat.js
    if (typeof window.applyChatEnabled === "function") {
      window.applyChatEnabled(enabled);
    }
    const btn = document.getElementById("chatToggleBtn");
    if (btn) btn.textContent = enabled ? "Disable Chat" : "Enable Chat";
    if (window.DEBUG) console.log("Realtime chat state applied:", enabled);
  });

  // Teacher chat toggle button (broadcast + update)
  let toggleInFlight = false;
  chatToggleBtn?.addEventListener("click", () => {
    if (toggleInFlight) return; // debounce overlapping toggles
    const url = chatToggleBtn.dataset.toggleUrl;
    if (!url) {
      console.error("No toggle URL on chat button");
      return;
    }

    toggleInFlight = true;
    chatToggleBtn.disabled = true;
    const prevText = chatToggleBtn.textContent;
    chatToggleBtn.textContent = "Toggling...";

    fetch(url, {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") }
    })
      .then(r => {
        if (window.DEBUG) console.log("Toggle response status:", r.status);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (window.DEBUG) console.log("Toggle response data:", d);
        if (!d.ok) throw new Error(d.error || "Unknown error");

        const enabled = !!d.chat_enabled;
        window.CHAT_ENABLED = enabled;

        // Immediate local apply (avoid waiting for broadcast echo)
        if (typeof window.applyChatEnabled === "function") {
            window.applyChatEnabled(enabled);
        }

        chatToggleBtn.textContent = enabled ? "Disable Chat" : "Enable Chat";

        // Broadcast to all participants (others will update via listener)
        if (window.DEBUG) console.log("Broadcasting chat toggle:", enabled);
        channel?.send({
          type: "broadcast",
          event: "meta",
          payload: { t: "chat", enabled }
        });

        showToast?.(`Chat ${enabled ? "enabled" : "disabled"}`, "success");
      })
      .catch(err => {
        console.error("Chat toggle error:", err);
        showToast?.("Failed to toggle chat", "error");
        chatToggleBtn.textContent = prevText;
      })
      .finally(() => {
        chatToggleBtn.disabled = false;
        toggleInFlight = false;
      });
  });

  // Remote strokes handling
  // const remoteStrokeLayers = {}; // moved to top

  function getRemoteCtx(sid) {
    if (!remoteStrokeLayers[sid]) {
      const c = document.createElement("canvas");
      c.width = strokeCanvas.width;
      c.height = strokeCanvas.height;
      const rc = c.getContext("2d", { willReadFrequently: true });
      remoteStrokeLayers[sid] = { canvas: c, ctx: rc };
    }
    return remoteStrokeLayers[sid].ctx;
  }

  function redrawWithRemotes() {
    redrawAll();
    // Base layer is now drawn inside redrawAll() to ensure correct z-order (Background -> Images -> Strokes)

    // Then draw per-user stroke layers on top
    Object.values(remoteStrokeLayers).forEach(obj => {
      ctx.drawImage(
        obj.canvas,
        0,
        0,
        canvas.width / (window.devicePixelRatio || 1),
        canvas.height / (window.devicePixelRatio || 1)
      );
    });
  }

  // Broadcast a full sync of the local stroke layer (for undo/redo/eraser)
  function broadcastLayerSync() {
    try {
      if (!channel) return;
      const self = getSelfLayer();
      const dataUrl = self.canvas.toDataURL("image/png");
      channel.send({
        type: "broadcast",
        event: "stroke",
        payload: { t: "layer", sid: String(window.CURRENT_USER_ID), img: dataUrl }
      });
    } catch (e) {
      console.warn("Layer sync failed", e);
    }
  }

  channel?.on("broadcast", { event: "stroke" }, ({ payload }) => {
    if (!payload || !payload.t) return;
    // Ignore own strokes (already applied locally)
    if (String(payload.sid) === String(window.CURRENT_USER_ID)) return;
    const rect = canvas.getBoundingClientRect();
    const x = (payload.x || 0) * rect.width;
    const y = (payload.y || 0) * rect.height;
    const rc = getRemoteCtx(payload.sid);
    switch (payload.t) {
      case "begin":
        rc.lineWidth = payload.w || 3;
        rc.strokeStyle = payload.c || "#000";
        rc.lineCap = "round";
        rc.beginPath();
        rc.moveTo(x, y);
        break;
      case "draw":
        rc.lineTo(x, y);
        rc.stroke();
        break;
      case "end":
        rc.lineTo(x, y);
        rc.stroke();
        break;
      case "layer": {
        // Replace the sender's layer with provided image
        const img = new Image();
        img.onload = () => {
          rc.clearRect(0, 0, rc.canvas.width, rc.canvas.height);
          rc.drawImage(img, 0, 0, rc.canvas.width, rc.canvas.height);
          redrawWithRemotes();
        };
        img.src = payload.img;
        return;
      }
      case "clear_all": {
        // Wipe base stroke layer and all remote layers
        strokeCtx.clearRect(0, 0, rect.width, rect.height);
        Object.values(remoteStrokeLayers).forEach(obj => obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height));
        // Reset history as content changed globally
        history.length = 0; redoStack.length = 0; snapshotState("remote-clear-all");
        scheduleRedraw();
        break;
      }
      case "clear":
        // Legacy: clear only the sender's layer
        rc.clearRect(0, 0, rc.canvas.width, rc.canvas.height);
        break;
    }
    redrawWithRemotes();
  });

  // History sync: respond to undo/redo broadcasts from other clients.
  channel?.on("broadcast", { event: "history" }, ({ payload }) => {
    if (!payload || !payload.t) return;
    // ignore our own broadcasts
    if (String(payload.sid) === String(window.CURRENT_USER_ID)) return;
    if (window.DEBUG) console.log('Received history broadcast', payload);
    switch (payload.t) {
      case "undo":
        try { undo(false); } catch (e) { console.warn('Remote undo failed', e); }
        break;
      case "redo":
        try { redo(false); } catch (e) { console.warn('Remote redo failed', e); }
        break;
    }
  });

  channel?.on("broadcast", { event: "image" }, ({ payload }) => {
    if (!payload || !payload.t || !payload.id && payload.t !== "clear") return;
    // Ignore events originating from this user if we ever include sender id (not included yet)
    const rect = canvas.getBoundingClientRect();
    switch (payload.t) {
      case "add": {
        // prevent duplicate add
        if (images.some(i => i.id === payload.id)) return;
        addImageFromUrl(payload.url, {
          id: payload.id,
          x: (payload.x || 0) * rect.width,
          y: (payload.y || 0) * rect.height,
          width: (payload.w || 0.3) * rect.width,
          height: (payload.h || 0.3) * rect.height
        }).then(img => {
          img.rotation = payload.r || 0;
          scheduleRedraw();
        }).catch(()=>{});
        break;
      }
      case "move":
      case "resize":
      case "transform":
      case "rotate": {
        const img = images.find(i => i.id === payload.id);
        if (!img) return;
        if (payload.x != null) img.x = payload.x * rect.width;
        if (payload.y != null) img.y = payload.y * rect.height;
        if (payload.w != null) img.width = payload.w * rect.width;
        if (payload.h != null) img.height = payload.h * rect.height;
        if (payload.r != null) img.rotation = payload.r;
        scheduleRedraw();
        break;
      }
      case "delete": {
        const existing = images.find(i => i.id === payload.id);
        if (!existing) return;
        images = images.filter(i => i.id !== payload.id);
        if (activeImage && activeImage.id === payload.id) activeImage = null;
        scheduleRedraw();
        break;
      }
      case "clear": {
        images = [];
        activeImage = null;
        scheduleRedraw();
        break;
      }
      case "clear_all": {
        images = [];
        activeImage = null;
        scheduleRedraw();
        break;
      }
    }
  });

  channel?.on("broadcast", { event: "perm" }, ({ payload }) => {
    if (!payload) return;
    const appliesToAll = payload.uid == null || String(payload.uid) === "all";
    const appliesToMe = String(payload?.uid) === String(window.CURRENT_USER_ID);
    if (!(appliesToAll || appliesToMe)) return;
    const newVal = !!payload.can;
    if (window.WhiteboardApp?.canDraw !== newVal) {
      window.WhiteboardApp.canDraw = newVal;
      showToast?.(newVal ? "You can now draw." : "You are in view-only mode.", "info");
    }
  });
})();