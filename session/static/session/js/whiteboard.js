(() => {
  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) return console.error("whiteboardCanvas not found");
  const ctx = canvas.getContext("2d");
  if (!ctx) return console.error("2D context not available");

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

  // ---------- Canvas sizing ----------
  function getCssSize() {
    const rect = canvas.getBoundingClientRect();
    return { cssW: Math.max(1, rect.width), cssH: Math.max(1, rect.height) };
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { cssW, cssH } = getCssSize();
    const targetW = cssW * dpr, targetH = cssH * dpr;
    if (canvas.width === targetW && canvas.height === targetH && devicePixelRatio === dpr) return;

    const temp = document.createElement("canvas");
    temp.width = canvas.width || targetW;
    temp.height = canvas.height || targetH;
    if (temp.width > 0 && temp.height > 0) temp.getContext("2d").drawImage(canvas, 0, 0);

    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cssW, cssH);
    if (temp.width && temp.height)
      ctx.drawImage(temp, 0, 0, temp.width / (devicePixelRatio || 1), temp.height / (devicePixelRatio || 1));

    devicePixelRatio = dpr;
  }

  // ---------- Drawing ----------
  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e) {
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
    if (!drawing) return;
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

  // ---------- Utility ----------
  function createExportCanvas() {
    const { cssW, cssH } = getCssSize();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cssW;
    exportCanvas.height = cssH;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.fillStyle = "#fff";
    exportCtx.fillRect(0, 0, cssW, cssH);
    exportCtx.drawImage(canvas, 0, 0, cssW, cssH);
    return exportCanvas;
  }

  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }

  // ---------- Tools ----------
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

  // ---------- Save Snapshot ----------
  saveBtn?.addEventListener("click", () => {
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

  // ---------- Back button ----------
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

  // ---------- Pointer events ----------
  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stopDraw);
  canvas.addEventListener("pointerout", stopDraw);

// ---------- Snapshot restore ----------
function drawSnapshotIfPresent() {
  if (!snapshotImg || !snapshotImg.src) return;

  const img = new Image();
  img.crossOrigin = "anonymous";

  // 🧩 Add cache-buster + ensure full absolute URL reloads
  const baseUrl = snapshotImg.src.split("?")[0]; // remove any old query params
  img.src = `${baseUrl}?r=${Date.now()}`; // force always-fresh image load

  img.onload = () => {
    resizeCanvas();
    const { cssW, cssH } = getCssSize();

    // ✅ Fill white background to prevent transparency flicker
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cssW, cssH);

    // ✅ Draw the latest saved snapshot
    ctx.drawImage(img, 0, 0, cssW, cssH);

    isDirty = false;
    console.log("✅ Snapshot restored successfully:", img.src);
  };

  img.onerror = (err) => {
    console.warn("⚠️ Failed to load snapshot image", err);
  };
}


  // ---------- Init ----------
  resizeCanvas();
  drawSnapshotIfPresent();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", e => {
    if (!isDirty) return;
    e.preventDefault();
    e.returnValue = "";
  });
})();
