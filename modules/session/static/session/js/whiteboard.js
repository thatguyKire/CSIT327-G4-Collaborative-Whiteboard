(() => {
  "use strict";

  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) return;

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

  // Performance: throttle redraws with rAF
  let redrawPending = false;
  function scheduleRedraw() {
    if (redrawPending) return;
    redrawPending = true;
    requestAnimationFrame(() => {
      redrawAll();
      redrawPending = false;
    });
  }

  // Undo/Redo
  const history = [];
  const redoStack = [];
  const MAX_HISTORY = 50;
  let wheelRotateDebounce;
  function snapshotState(reason = "") {
    try {
      // capture stroke layer pixels
      const strokeData = strokeCtx.getImageData(0, 0, strokeCanvas.width, strokeCanvas.height);
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
      const snap = {
        strokeWidth: strokeCanvas.width,
        strokeHeight: strokeCanvas.height,
        strokeData,
        images: imagesCopy,
        activeId: activeImage ? activeImage.id : null
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
    if (snap.strokeWidth !== strokeCanvas.width || snap.strokeHeight !== strokeCanvas.height) {
      showToast("Canvas size changed; undo history cleared.", "info");
      history.length = 0;
      redoStack.length = 0;
      return;
    }
    try {
      strokeCtx.putImageData(snap.strokeData, 0, 0);
      // restore images (reuse existing Image objects where possible)
      const map = new Map(snap.images.map(i => [i.id, i]));
      images = snap.images.map(meta => ({
        ...meta,
        img: meta.img // same object
      }));
      activeImage = images.find(i => i.id === snap.activeId) || null;
      scheduleRedraw();
    } catch (e) {
      console.error("Restore failed", e);
      showToast("Undo failed.", "error");
    }
  }
  function undo() {
    if (history.length <= 1) {
      showToast("Nothing to undo.", "info");
      return;
    }
    const current = history.pop(); // current state
    redoStack.push(current);
    const previous = history[history.length - 1];
    restoreSnapshot(previous);
  }
  function redo() {
    if (redoStack.length === 0) {
      showToast("Nothing to redo.", "info");
      return;
    }
    const next = redoStack.pop();
    // push current into history
    try {
      const strokeData = strokeCtx.getImageData(0, 0, strokeCanvas.width, strokeCanvas.height);
      const imagesCopy = images.map(i => ({
        id: i.id, img: i.img, x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation || 0
      }));
      history.push({
        strokeWidth: strokeCanvas.width,
        strokeHeight: strokeCanvas.height,
        strokeData,
        images: imagesCopy,
        activeId: activeImage ? activeImage.id : null
      });
    } catch {}
    restoreSnapshot(next);
  }
  document.addEventListener("keydown", (e) => {
    if (!canDraw) return;
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
    const rect = canvas.parentElement.getBoundingClientRect();
    const widthCss = rect.width;
    const heightCss = rect.height;
    const dpr = window.devicePixelRatio || 1;

    // Backup stroke canvas
    const tempStroke = document.createElement("canvas");
    tempStroke.width = strokeCanvas.width || widthCss * dpr;
    tempStroke.height = strokeCanvas.height || heightCss * dpr;
    const tempCtx = tempStroke.getContext("2d");
    tempCtx.drawImage(strokeCanvas, 0, 0);

    // Resize main canvas
    canvas.width = widthCss * dpr;
    canvas.height = heightCss * dpr;
    canvas.style.width = widthCss + "px";
    canvas.style.height = heightCss + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // Resize stroke canvas
    strokeCanvas.width = widthCss * dpr;
    strokeCanvas.height = heightCss * dpr;
    strokeCtx = strokeCanvas.getContext("2d", { willReadFrequently: true });
    strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
    strokeCtx.scale(dpr, dpr);

    // Restore strokes
    if (tempStroke.width && tempStroke.height) {
      strokeCtx.drawImage(tempStroke, 0, 0, widthCss, heightCss);
    }

    // Clear history on resize (dimensions change)
    history.length = 0;
    redoStack.length = 0;
    snapshotState("resize");
    scheduleRedraw();
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

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

    // Draw images first (bottom layer)
    images.forEach(item => {
      ctx.save();
      ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
      ctx.rotate((item.rotation || 0) * Math.PI / 180);
      ctx.drawImage(item.img, -item.width / 2, -item.height / 2, item.width, item.height);
      ctx.restore();
    });

    // Draw strokes on top
    ctx.drawImage(strokeCanvas, 0, 0, width, height);

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
    const p = getCoords(e);
    if (hitTest(p.x, p.y)) return; // avoid drawing over image drag
    drawing = true;
    lastX = p.x; lastY = p.y;
    strokeCtx.lineWidth = lineWidth;
    strokeCtx.lineCap = "round";
    strokeCtx.strokeStyle = erasing ? "#fff" : currentColor;
    strokeCtx.beginPath();
    strokeCtx.moveTo(lastX, lastY);
    scheduleRedraw();
    send("begin", e, { c: strokeCtx.strokeStyle, w: strokeCtx.lineWidth });
  }
  function draw(e) {
    if (!drawing || !canDraw) return;
    const p = getCoords(e);
    strokeCtx.lineWidth = lineWidth;
    strokeCtx.lineCap = "round";
    strokeCtx.strokeStyle = erasing ? "#fff" : currentColor;
    strokeCtx.beginPath();
    strokeCtx.moveTo(lastX, lastY);
    strokeCtx.lineTo(p.x, p.y);
    strokeCtx.stroke();
    lastX = p.x; lastY = p.y;
    scheduleRedraw();
    send("draw", e);
  }
  function stopDraw(e) {
    if (!drawing) return;
    drawing = false;
    snapshotState("stroke");
    send("end", e);
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
    } else if (resizing && activeImage) {
      activeImage.width = Math.max(30, p.x - activeImage.x);
      activeImage.height = Math.max(30, p.y - activeImage.y);
      scheduleRedraw();
    }
  });

  canvas.addEventListener("pointerup", () => {
    if (dragging || resizing) {
      dragging = false;
      resizing = false;
      snapshotState("image-transform");
    }
  });

  // Rotate with Shift + Wheel (debounced snapshot)
  canvas.addEventListener("wheel", (e) => {
    if (activeImage && e.shiftKey && canDraw) {
      e.preventDefault();
      activeImage.rotation = (activeImage.rotation || 0) + e.deltaY * -0.1;
      scheduleRedraw();
      clearTimeout(wheelRotateDebounce);
      wheelRotateDebounce = setTimeout(() => snapshotState("image-rotate"), 250);
    }
  }, { passive: false });

  // Delete with keyboard
  document.addEventListener("keydown", (e) => {
    if (!activeImage || !canDraw) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      images = images.filter(i => i !== activeImage);
      activeImage = null;
      scheduleRedraw();
      snapshotState("delete-image");
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
    if (!confirm("Clear everything? This will delete all drawings and images.")) return;

    const rect = canvas.getBoundingClientRect();
    strokeCtx.clearRect(0, 0, rect.width, rect.height);
    strokeCtx.fillStyle = "#fff";
    strokeCtx.fillRect(0, 0, rect.width, rect.height);

    images = [];
    activeImage = null;
    scheduleRedraw();
    snapshotState("clear");
    showToast("Board cleared.", "success");
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
  // RESTORE SNAPSHOT
  // ========================================
  if (snapshotImg && snapshotImg.src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = snapshotImg.src;
    img.onload = () => {
      strokeCtx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      scheduleRedraw();
      snapshotState("restore-snapshot");
    };
    img.onerror = () => {
      showToast("Failed to restore previous snapshot.", "error");
    };
  } else {
    // initial empty state snapshot to start history
    snapshotState("init");
  }

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
        const useAbs = !!opts.absolute;
        const x = Number.isFinite(opts.x) ? opts.x : (rect.width / 2 - width / 2);
        const y = Number.isFinite(opts.y) ? opts.y : (rect.height / 2 - height / 2);
        if (Number.isFinite(opts.width))  width  = opts.width;
        if (Number.isFinite(opts.height)) height = opts.height;

        const item = { id: nextImageId++, img, x, y, width, height, rotation: 0 };
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
    set canDraw(v){ canDraw = !!v; },
    addImageFromUrl,
    showToast,
    getCookie
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
  undo = function() {
    _undo();
    updateUndoRedoButtons();
  };
  const _redo = redo;
  redo = function() {
    _redo();
    updateUndoRedoButtons();
  };

  // Wire buttons
  undoBtn?.addEventListener("click", (e) => { e.preventDefault(); if (canDraw) undo(); });
  redoBtn?.addEventListener("click", (e) => { e.preventDefault(); if (canDraw) redo(); });

  // After initial setup
  updateUndoRedoButtons();

  // Supabase Realtime
  const supa = (window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null;

  const channelName = `wb:${window.CURRENT_SESSION_ID}`;
  const channel = supa?.channel(channelName, {
    config: { broadcast: { ack: true }, presence: { key: String(window.CURRENT_USER_ID || "anon") } }
  });
  window.WhiteboardChannel = channel;

  // subscribe so events flow
  channel?.subscribe((status) => {
    console.log("Realtime status:", status, channelName);
  });

  channel?.on("broadcast", { event: "stroke" }, ({ payload }) => {
    if (payload.sid && String(payload.sid) === String(window.CURRENT_USER_ID)) return;

    const rect = canvas.getBoundingClientRect();
    const x = (payload.x || 0) * rect.width;
    const y = (payload.y || 0) * rect.height;

    switch (payload.t) {
      case "begin":
        strokeCtx.beginPath();
        strokeCtx.moveTo(x, y);
        strokeCtx.strokeStyle = payload.c || "#000";
        strokeCtx.lineWidth = payload.w || 2;
        strokeCtx.lineCap = "round";
        break;
      case "draw":
        strokeCtx.lineTo(x, y);
        strokeCtx.stroke();
        break;
      case "end":
        // no-op; path already stroked
        break;
      case "clear":
        strokeCtx.clearRect(0, 0, rect.width, rect.height);
        images = [];
        activeImage = null;
        break;
    }
    scheduleRedraw();
  });

  // Live permission toggle (remove undefined functions)
  channel?.on("broadcast", { event: "perm" }, ({ payload }) => {
    const { uid, can } = payload || {};
    if (!uid || String(uid) !== String(window.CURRENT_USER_ID)) return;
    canDraw = !!can;
    if (canDraw) { bindDrawingHandlers(); showToast("You can draw now.", "success"); }
    else { unbindDrawingHandlers(); showToast("Drawing permission removed.", "info"); }
  });

  // Clear button: also broadcast
  clearBtn?.addEventListener("click", () => {
    if (!canDraw) return showToast("You don't have permission to clear.", "error");
    if (!confirm("Clear everything?")) return;
    const rect = canvas.getBoundingClientRect();
    strokeCtx.clearRect(0, 0, rect.width, rect.height);
    images = [];
    activeImage = null;
    scheduleRedraw();
    snapshotState("clear");
    send("clear");
  });
})();