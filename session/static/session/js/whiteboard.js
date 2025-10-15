(() => {
  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) { console.error("whiteboardCanvas element not found"); return; }
  const ctx = canvas.getContext("2d");
  if (!ctx) { console.error("2D context not available on canvas"); return; }

  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let devicePixelRatio = window.devicePixelRatio || 1;

  let currentColor = "#000";
  let lineWidth = 3;
  let erasing = false;
  let isDirty = false;

  const colorPicker = document.getElementById("colorPicker");
  const sizePicker = document.getElementById("sizePicker");
  const penBtn = document.getElementById("penBtn");
  const eraserBtn = document.getElementById("eraserBtn");
  const clearBtn = document.getElementById("clearBtn");
  const exportBtn = document.getElementById("exportBtn");
  const saveBtn = document.getElementById("saveBtn");
  const backBtn = document.getElementById("backBtn");
  const snapshotImg = document.getElementById("snapshotImg");

  function getCssSize() {
    const rect = canvas.getBoundingClientRect();
    return { cssW: Math.max(1, Math.floor(rect.width)), cssH: Math.max(1, Math.floor(rect.height)) };
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { cssW, cssH } = getCssSize();
    const targetW = cssW * dpr;
    const targetH = cssH * dpr;
    if (canvas.width === targetW && canvas.height === targetH && devicePixelRatio === dpr) return;

    const temp = document.createElement("canvas");
    temp.width = canvas.width || targetW;
    temp.height = canvas.height || targetH;
    if (temp.width > 0 && temp.height > 0) {
      const tctx = temp.getContext("2d");
      tctx.drawImage(canvas, 0, 0);
    }

    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,cssW,cssH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,cssW,cssH);

    if (temp.width && temp.height) {
      ctx.drawImage(temp, 0, 0, temp.width / (devicePixelRatio || 1), temp.height / (devicePixelRatio || 1));
    }
    devicePixelRatio = dpr;
  }

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e) {
    if (e && e.pointerType === "touch" && typeof e.preventDefault === "function") e.preventDefault();
    drawing = true;
    const p = getCoords(e);
    lastX = p.x; lastY = p.y;
    ctx.beginPath(); ctx.moveTo(lastX, lastY);
    if (e && e.pointerId !== undefined && canvas.setPointerCapture) {
      try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
    }
  }

  function stopDraw(e) {
    if (!drawing) return;
    drawing = false;
    ctx.beginPath();
    if (e && e.pointerId !== undefined && canvas.releasePointerCapture) {
      try{ canvas.releasePointerCapture(e.pointerId); }catch(_){}
    }
  }

  function draw(e) {
    if (!drawing) return;
    if (e && e.pointerType === "touch" && typeof e.preventDefault === "function") e.preventDefault();
    const p = getCoords(e);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = erasing ? "#fff" : currentColor;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
    isDirty = true;
  }

  function createExportCanvas() {
    const { cssW, cssH } = getCssSize();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cssW; exportCanvas.height = cssH;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.fillStyle = "#fff";
    exportCtx.fillRect(0,0,cssW,cssH);
    exportCtx.drawImage(canvas, 0, 0, cssW, cssH);
    return exportCanvas;
  }

  /* CSRF helper (reads from cookie) */
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }

  if (colorPicker) colorPicker.addEventListener("input", e => currentColor = e.target.value);
  if (sizePicker) sizePicker.addEventListener("input", e => lineWidth = parseInt(e.target.value, 10) || 3);

  if (penBtn) penBtn.addEventListener("click", () => { erasing=false; penBtn.classList.add("active"); eraserBtn && eraserBtn.classList.remove("active"); });
  if (eraserBtn) eraserBtn.addEventListener("click", () => { erasing=true; eraserBtn.classList.add("active"); penBtn && penBtn.classList.remove("active"); });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const { cssW, cssH } = getCssSize();
      ctx.clearRect(0,0,cssW,cssH);
      ctx.fillStyle = "#fff"; ctx.fillRect(0,0,cssW,cssH);
      isDirty = true;
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const exportCanvas = createExportCanvas();
      if (exportCanvas.toBlob) {
        exportCanvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url; link.download = "whiteboard.png"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        }, "image/png");
      } else {
        const data = exportCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = data; link.download = "whiteboard.png"; document.body.appendChild(link); link.click(); link.remove();
      }
    });
  }

  // Save: POST the PNG blob to save_snapshot endpoint
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const saveUrl = saveBtn.dataset.saveUrl;
      if (!saveUrl) return alert("Save URL missing");
      const exportCanvas = createExportCanvas();
      if (!exportCanvas.toBlob) {
        // fallback to dataURL -> blob
        const dataURL = exportCanvas.toDataURL("image/png");
        const arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
        while(n--) u8arr[n] = bstr.charCodeAt(n);
        const blob = new Blob([u8arr], { type: mime });
        postSnapshotBlob(saveUrl, blob);
      } else {
        exportCanvas.toBlob((blob) => {
          if (!blob) return;
          postSnapshotBlob(saveUrl, blob);
        }, "image/png");
      }
    });
  }

  function postSnapshotBlob(url, blob) {
    const fd = new FormData();
    fd.append("image", blob, "snapshot.png");
    fetch(url, {
      method: "POST",
      body: fd,
      headers: { "X-CSRFToken": getCookie("csrftoken") }
    }).then(r => r.json())
      .then(j => {
        if (j && j.ok) {
          isDirty = false;
          if (saveBtn) {
            const orig = saveBtn.textContent;
            saveBtn.textContent = "Saved";
            setTimeout(()=> saveBtn.textContent = orig, 1200);
          }
        } else {
          alert("Save failed");
        }
      })
      .catch(e => { console.error("Save failed", e); alert("Save failed"); });
  }

  // Back button: offer to save before leaving
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (isDirty) {
        if (confirm("You have unsaved changes. Save now?")) {
          if (saveBtn) { saveBtn.click(); setTimeout(() => { const backUrl = backBtn.dataset.backUrl || document.referrer || ""; if (backUrl) window.location.href = backUrl; else history.back(); }, 900); return; }
        } else {
          if (!confirm("Leave without saving?")) return;
        }
      }
      const backUrl = backBtn.dataset.backUrl || document.referrer || "";
      if (backUrl) window.location.href = backUrl; else history.back();
    });
  }

  // Pointer events
  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stopDraw);
  canvas.addEventListener("pointercancel", stopDraw);
  canvas.addEventListener("pointerout", stopDraw);

  if (!window.PointerEvent) {
    canvas.addEventListener("mousedown", startDraw);
    window.addEventListener("mousemove", draw);
    window.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("touchstart", (ev) => {
      const t = ev.changedTouches[0];
      if (t) startDraw({ clientX: t.clientX, clientY: t.clientY, pointerType: "touch", preventDefault: () => ev.preventDefault() });
    }, { passive: false });
    canvas.addEventListener("touchmove", (ev) => {
      const t = ev.changedTouches[0];
      if (t) draw({ clientX: t.clientX, clientY: t.clientY, pointerType: "touch", preventDefault: () => ev.preventDefault() });
    }, { passive: false });
    canvas.addEventListener("touchend", stopDraw);
  }

  // draw snapshot image onto canvas if present
  function drawSnapshotIfPresent() {
    if (!snapshotImg) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = snapshotImg.src;
    img.onload = function() {
      // ensure canvas sized before drawing
      resizeCanvas();
      const { cssW, cssH } = getCssSize();
      // draw into CSS pixel space (ctx is scaled to map CSS px)
      ctx.drawImage(img, 0, 0, cssW, cssH);
      isDirty = false;
    };
    img.onerror = function() { console.warn("Failed to load snapshot image"); };
  }

  // Init
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  try { let dprMedia = window.matchMedia && window.matchMedia(`(resolution: ${devicePixelRatio}dppx)`); if (dprMedia && dprMedia.addEventListener) dprMedia.addEventListener("change", resizeCanvas); } catch(_) {}
  window.addEventListener("beforeunload", (e) => { if (!isDirty) return; e.preventDefault(); e.returnValue = ""; });

  // call after setup
  drawSnapshotIfPresent();
})();