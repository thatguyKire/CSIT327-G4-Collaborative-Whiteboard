(() => {
  "use strict";

  // ------------------------
  // Canvas + context (the canvas)
  // ------------------------
  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) {
    console.error("whiteboardCanvas not found");
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("2D context not available");
    return;
  }

  // ------------------------
  // Permissions from Django
  // window.CAN_DRAW should be set by the template (true/false)
  // ------------------------
  const canDraw = window.CAN_DRAW === true;
  console.log("🎨 Drawing permission:", canDraw);

  // ------------------------
  // State variables
  // ------------------------
  let drawing = false;          // are we currently drawing?
  let lastX = 0, lastY = 0;     // last pointer coordinates
  let devicePixelRatio = window.devicePixelRatio || 1;

  let currentColor = "#000";    // selected color
  let lineWidth = 3;            // selected width
  let erasing = false;          // are we erasing?
  let isDirty = false;          // has the canvas changed since last save?

  // DOM elements for tools
  const colorPicker = document.getElementById("colorPicker");
  const sizePicker = document.getElementById("sizePicker");
  const penBtn = document.getElementById("penBtn");
  const eraserBtn = document.getElementById("eraserBtn");
  const clearBtn = document.getElementById("clearBtn");
  const exportBtn = document.getElementById("exportBtn");
  const saveBtn = document.getElementById("saveBtn");
  const backBtn = document.getElementById("backBtn");
  const snapshotImg = document.getElementById("snapshotImg");

  // ------------------------
  // Canvas sizing helpers (devicePixelRatio aware)
  // - getCssSize: returns CSS pixel size of canvas container
  // - resizeCanvas: resizes actual bitmap to css*DPR; preserves existing drawing
  // ------------------------
  function getCssSize() {
    const rect = canvas.getBoundingClientRect();
    return { cssW: Math.max(1, rect.width), cssH: Math.max(1, rect.height) };
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { cssW, cssH } = getCssSize();
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);

    // if already sized correctly, skip
    if (canvas.width === targetW && canvas.height === targetH && devicePixelRatio === dpr) {
      return;
    }

    // preserve current content by drawing to a temporary canvas
    const temp = document.createElement("canvas");
    temp.width = canvas.width || targetW;
    temp.height = canvas.height || targetH;
    if (temp.width > 0 && temp.height > 0) {
      const tctx = temp.getContext("2d");
      tctx.drawImage(canvas, 0, 0);
    }

    // set new size and scale to device pixels
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // default background white
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cssW, cssH);

    // restore previous content (convert from old canvas pixel density)
    if (temp.width && temp.height) {
      ctx.drawImage(
        temp,
        0,
        0,
        temp.width / (devicePixelRatio || 1),
        temp.height / (devicePixelRatio || 1)
      );
    }

    devicePixelRatio = dpr;
  }

  // ------------------------
  // Drawing helpers
  // - getCoords: pointer coordinates relative to canvas CSS box
  // - startDraw / draw / stopDraw: pointer handlers
  // ------------------------
  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    // support pointer events and mouse events: assume e.clientX/clientY available
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e) {
    // block drawing for view-only users
    if (!canDraw) return;

    // prevent default behavior on touch/pointer
    e.preventDefault?.();

    drawing = true;
    const p = getCoords(e);
    lastX = p.x;
    lastY = p.y;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
  }

  function stopDraw() {
    drawing = false;
    ctx.beginPath();
  }

  function draw(e) {
    if (!drawing || !canDraw) return;
    e.preventDefault?.();

    const p = getCoords(e);

    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = erasing ? "#fff" : currentColor;

    // stroke from previous point to new point
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    lastX = p.x;
    lastY = p.y;
    isDirty = true;
  }

  // ------------------------
  // Utility: export/create snapshot canvas
  // createExportCanvas returns a CSS-sized canvas (not DPR-scaled) with white background + current drawing
  // ------------------------
  function createExportCanvas() {
    const { cssW, cssH } = getCssSize();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cssW;
    exportCanvas.height = cssH;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.fillStyle = "#fff";
    exportCtx.fillRect(0, 0, cssW, cssH);
    // draw our scaled canvas content into CSS-space
    exportCtx.drawImage(canvas, 0, 0, cssW, cssH);
    return exportCanvas;
  }

  // ------------------------
  // Cookie helper (CSRF)
  // ------------------------
  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }

  // ------------------------
  // Tools UI binding (color, size, pen/eraser, clear, export)
  // ------------------------
  colorPicker?.addEventListener("input", e => currentColor = e.target.value);
  sizePicker?.addEventListener("input", e => lineWidth = parseInt(e.target.value, 10) || 3);

  penBtn?.addEventListener("click", () => {
    erasing = false;
    penBtn.classList.add("active");
    eraserBtn?.classList.remove("active");
  });

  eraserBtn?.addEventListener("click", () => {
    erasing = true;
    eraserBtn.classList.add("active");
    penBtn?.classList.remove("active");
  });

  clearBtn?.addEventListener("click", () => {
    // block clear for students without permission
    if (!canDraw) return;
    const { cssW, cssH } = getCssSize();
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cssW, cssH);
    isDirty = true;
  });

  exportBtn?.addEventListener("click", () => {
    const exportCanvas = createExportCanvas();
    exportCanvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "whiteboard.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  // ------------------------
  // Save snapshot (POST to server)
  // - only allowed for users with canDraw
  // - posts FormData {image: blob}
  // ------------------------
  saveBtn?.addEventListener("click", () => {
    if (!canDraw) return alert("You don’t have permission to save.");

    const saveUrl = saveBtn.dataset.saveUrl;
    if (!saveUrl) return alert("Save URL missing");

    const exportCanvas = createExportCanvas();
    exportCanvas.toBlob(blob => {
      if (!blob) return;
      postSnapshotBlob(saveUrl, blob);
    }, "image/png");
  });

  function postSnapshotBlob(url, blob) {
    const fd = new FormData();
    fd.append("image", blob, "snapshot.png");

    fetch(url, {
      method: "POST",
      body: fd,
      headers: { "X-CSRFToken": getCookie("csrftoken") }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          isDirty = false;
          const orig = saveBtn.textContent;
          saveBtn.textContent = "✅ Saved!";
          saveBtn.disabled = true;
          setTimeout(() => {
            saveBtn.textContent = orig;
            saveBtn.disabled = false;
          }, 1200);
        } else {
          console.error("Save failed:", data.error || data);
          alert("Save failed: " + (data.error || "Unexpected error"));
        }
      })
      .catch(err => {
        console.error("Save failed:", err);
        alert("Save failed: Network or server error");
      });
  }

  // ------------------------
  // Back button handler (asks to save if dirty)
  // ------------------------
  backBtn?.addEventListener("click", () => {
    const backUrl = backBtn.dataset.backUrl || document.referrer || "";

    if (isDirty) {
      const saveAndExit = confirm("You have unsaved changes. Save before leaving?");
      if (saveAndExit && saveBtn) {
        saveBtn.click();
        setTimeout(() => {
          window.location.href = backUrl || document.referrer || "/";
        }, 1000);
        return;
      }
      const leaveAnyway = confirm("Leave without saving?");
      if (!leaveAnyway) return;
    }
    window.location.href = backUrl || document.referrer || "/";
  });

  // ------------------------
  // Pointer events wiring
  // - only wire events if user can draw
  // ------------------------
  if (canDraw) {
    canvas.addEventListener("pointerdown", startDraw);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stopDraw);
    canvas.addEventListener("pointerout", stopDraw);
  } else {
    // disable interactions visually and semantically
    canvas.style.pointerEvents = "none";
  }

  // ------------------------
  // Snapshot restore
  // - draws snapshotImg (if present) into canvas on load. Adds cache-buster to avoid stale images.
  // ------------------------
  function drawSnapshotIfPresent() {
    if (!snapshotImg || !snapshotImg.src) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    // Remove old query and add fresh timestamp
    const baseUrl = snapshotImg.src.split("?")[0];
    img.src = `${baseUrl}?r=${Date.now()}`;

    img.onload = () => {
      resizeCanvas();
      const { cssW, cssH } = getCssSize();

      // clear and fill white before drawing to prevent transparency
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.drawImage(img, 0, 0, cssW, cssH);
      isDirty = false;
      console.log("✅ Snapshot restored successfully:", img.src);
    };

    img.onerror = (err) => {
      console.warn("⚠️ Failed to load snapshot image", err);
    };
  }

  // ------------------------
  // Init
  // ------------------------
  resizeCanvas();
  drawSnapshotIfPresent();

  // keep canvas size responsive
  window.addEventListener("resize", resizeCanvas);

  // warn on unload if unsaved
  window.addEventListener("beforeunload", e => {
    if (!isDirty) return;
    e.preventDefault();
    e.returnValue = "";
  });
})();
