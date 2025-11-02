(() => {
  "use strict";

  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) {
    console.error("Canvas not found");
    return;
  }

  const ctx = canvas.getContext("2d");
  const canDraw = window.CAN_DRAW === true;

  let drawing = false;
  let lastX = 0, lastY = 0;
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

  // ----------------------------
  // Resize canvas
  // ----------------------------
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const dpr = window.devicePixelRatio || 1;

    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    temp.getContext("2d").drawImage(canvas, 0, 0);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(temp, 0, 0, width, height);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // ----------------------------
  // Drawing logic
  // ----------------------------
  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e) {
    if (!canDraw) return;
    drawing = true;
    const p = getCoords(e);
    lastX = p.x;
    lastY = p.y;
  }

  function draw(e) {
    if (!drawing || !canDraw) return;
    const p = getCoords(e);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.strokeStyle = erasing ? "#fff" : currentColor;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
    isDirty = true;
  }

  function stopDraw() {
    drawing = false;
  }

  // ----------------------------
  // Toolbar
  // ----------------------------
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  if (canDraw) {
    canvas.addEventListener("pointerdown", startDraw);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stopDraw);
    canvas.addEventListener("pointerout", stopDraw);
  } else {
    canvas.style.pointerEvents = "none";
  }

  // ----------------------------
  // Export
  // ----------------------------
  exportBtn?.addEventListener("click", () => {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.fillStyle = "#fff";
    exportCtx.fillRect(0, 0, canvas.width, canvas.height);
    exportCtx.drawImage(canvas, 0, 0);
    exportCanvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "whiteboard.png";
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  // ----------------------------
  // Save snapshot (upload merged image)
  // ----------------------------
  saveBtn?.addEventListener("click", () => {
    if (!canDraw) return alert("You don’t have permission to save.");
    const saveUrl = saveBtn.dataset.saveUrl;
    if (!saveUrl) return alert("Save URL missing");

    canvas.toBlob(blob => {
      const fd = new FormData();
      fd.append("image", blob, "snapshot.png");
      fetch(saveUrl, {
        method: "POST",
        body: fd,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            saveBtn.textContent = "✅ Saved!";
            setTimeout(() => (saveBtn.textContent = "Save"), 1000);
          } else alert("Save failed: " + (d.error || "Unknown"));
        });
    }, "image/png");
  });

  // ----------------------------
  // Restore snapshot
  // ----------------------------
  if (snapshotImg && snapshotImg.src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = snapshotImg.src;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  }

  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }
})();
