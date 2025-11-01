(() => {
  "use strict";

  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) return console.error("whiteboardCanvas not found");
  const ctx = canvas.getContext("2d");
  if (!ctx) return console.error("2D context not available");

  const canDraw = window.CAN_DRAW === true;
  console.log("🎨 Drawing permission:", canDraw);

  let drawing = false;
  let lastX = 0, lastY = 0;
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

  // ------------------------
  // Canvas sizing (improved)
  // ------------------------
  function getCssSize() {
    const rect = canvas.parentElement.getBoundingClientRect(); // ✅ Use container instead
    return { cssW: Math.max(1, rect.width), cssH: Math.max(1, rect.height - 10) };
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { cssW, cssH } = getCssSize();
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);

    // preserve old drawing
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    if (temp.width > 0 && temp.height > 0) {
      const tctx = temp.getContext("2d");
      tctx.drawImage(canvas, 0, 0);
    }

    // resize + scale
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false; // ✅ Prevent blur

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cssW, cssH);

    // restore previous content
    if (temp.width && temp.height) {
      ctx.drawImage(temp, 0, 0, cssW, cssH);
    }

    devicePixelRatio = dpr;
  }

  // ------------------------
  // Drawing
  // ------------------------
  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e) {
    if (!canDraw) return;
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

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    lastX = p.x;
    lastY = p.y;
    isDirty = true;
  }

  // ------------------------
  // Tools + UI
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
    if (!canDraw) return;
    const { cssW, cssH } = getCssSize();
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cssW, cssH);
    isDirty = true;
  });

  exportBtn?.addEventListener("click", () => {
    const { cssW, cssH } = getCssSize();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cssW;
    exportCanvas.height = cssH;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.fillStyle = "#fff";
    exportCtx.fillRect(0, 0, cssW, cssH);
    exportCtx.drawImage(canvas, 0, 0, cssW, cssH);
    exportCanvas.toBlob(blob => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "whiteboard.png";
      link.click();
      URL.revokeObjectURL(link.href);
    });
  });

  saveBtn?.addEventListener("click", () => {
    if (!canDraw) return alert("You don’t have permission to save.");
    const saveUrl = saveBtn.dataset.saveUrl;
    if (!saveUrl) return alert("Save URL missing");
    const { cssW, cssH } = getCssSize();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cssW;
    exportCanvas.height = cssH;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.fillStyle = "#fff";
    exportCtx.fillRect(0, 0, cssW, cssH);
    exportCtx.drawImage(canvas, 0, 0, cssW, cssH);
    exportCanvas.toBlob(blob => {
      const fd = new FormData();
      fd.append("image", blob, "snapshot.png");
      fetch(saveUrl, {
        method: "POST",
        body: fd,
        headers: { "X-CSRFToken": getCookie("csrftoken") }
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            isDirty = false;
            const orig = saveBtn.textContent;
            saveBtn.textContent = "✅ Saved!";
            saveBtn.disabled = true;
            setTimeout(() => {
              saveBtn.textContent = orig;
              saveBtn.disabled = false;
            }, 1200);
          } else alert("Save failed: " + (d.error || "Unknown"));
        })
        .catch(() => alert("Save failed: Network error"));
    }, "image/png");
  });

  backBtn?.addEventListener("click", () => {
    const backUrl = backBtn.dataset.backUrl || "/";
    if (isDirty) {
      const confirmExit = confirm("You have unsaved changes. Leave anyway?");
      if (!confirmExit) return;
    }
    window.location.href = backUrl;
  });

  if (canDraw) {
    canvas.addEventListener("pointerdown", startDraw);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stopDraw);
    canvas.addEventListener("pointerout", stopDraw);
  } else {
    canvas.style.pointerEvents = "none";
  }

  // ------------------------
  // Snapshot restore
  // ------------------------
  function drawSnapshotIfPresent() {
    if (!snapshotImg || !snapshotImg.src) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = snapshotImg.src.split("?")[0] + "?r=" + Date.now();
    img.onload = () => {
      resizeCanvas();
      const { cssW, cssH } = getCssSize();
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.drawImage(img, 0, 0, cssW, cssH);
    };
  }

  // ------------------------
  // Init
  // ------------------------
  resizeCanvas();
  drawSnapshotIfPresent();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", e => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }
})();

// 🖼️ Upload Integration (Improved)
window.drawUploadedImage = function (url) {
  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    // ✅ Center image nicely with auto-scaling
    const maxWidth = canvas.width * 0.8;
    const maxHeight = canvas.height * 0.8;
    let width = img.width;
    let height = img.height;

    if (width > maxWidth) {
      height *= maxWidth / width;
      width = maxWidth;
    }
    if (height > maxHeight) {
      width *= maxHeight / height;
      height = maxHeight;
    }

    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;

    ctx.imageSmoothingEnabled = false; // ✅ crisp render
    ctx.drawImage(img, x, y, width, height);
  };
  img.src = url + "?r=" + Date.now(); // avoid cache
};
