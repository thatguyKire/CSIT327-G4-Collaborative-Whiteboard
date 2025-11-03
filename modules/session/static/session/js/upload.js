(() => {
  "use strict";

  const canvas = document.getElementById("whiteboardCanvas");
  if (!canvas) return console.error("Canvas not found");

  // UI elements (may be missing in some views)
  const colorPicker = document.getElementById("colorPicker");
  const sizePicker = document.getElementById("sizePicker");
  const penBtn = document.getElementById("penBtn");
  const eraserBtn = document.getElementById("eraserBtn");
  const clearBtn = document.getElementById("clearBtn");
  const exportBtn = document.getElementById("exportBtn");
  const saveBtn = document.getElementById("saveBtn");
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");
  const uploadedFiles = document.getElementById("uploadedFiles");
  const snapshotImg = document.getElementById("snapshotImg");

  const canDraw = window.CAN_DRAW === true;

  // ---------- State ----------
  let dpr = window.devicePixelRatio || 1;
  const images = []; // uploaded images: {img,x,y,width,height,rotation}
  let activeImage = null;
  const resizeHandleSize = 15;

  // Offscreen drawing canvas (stores strokes so they survive redraws)
  let drawCanvas = document.createElement("canvas");
  let drawCtx = drawCanvas.getContext("2d");

  // Visible canvas ctx
  const ctx = canvas.getContext("2d");

  // drawing tool state
  let drawing = false;
  let lastX = 0, lastY = 0;
  let currentColor = "#000";
  let lineWidth = 3;
  let erasing = false;

  // image drag/resize state
  let dragging = false;
  let resizing = false;
  let offsetX = 0, offsetY = 0;

  // ---------- Helpers ----------
  function setCanvasSize() {
    // CSS size from parent container
    const rect = canvas.parentElement.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height - 0)); // keep full container height

    dpr = window.devicePixelRatio || 1;

    // Preserve existing draw layer by copying it to temp
    const prevDraw = document.createElement("canvas");
    prevDraw.width = drawCanvas.width || cssW * dpr;
    prevDraw.height = drawCanvas.height || cssH * dpr;
    const prevCtx = prevDraw.getContext("2d");
    // copy previous drawCanvas pixels (if any)
    if (drawCanvas.width && drawCanvas.height) prevCtx.drawImage(drawCanvas, 0, 0);

    // set visible canvas pixel size and CSS size
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    // set drawCanvas (offscreen) same pixel size
    drawCanvas.width = canvas.width;
    drawCanvas.height = canvas.height;
    drawCtx = drawCanvas.getContext("2d");

    // Set transforms for high DPI: scale drawing contexts by dpr to work in CSS pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    drawCtx.scale(dpr, dpr);

    // If prev content existed, draw it back into drawCtx scaled to new size
    if (prevDraw.width && prevDraw.height) {
      // prevDraw holds device-pixel sized image: draw it into drawCanvas at CSS scale
      drawCtx.drawImage(prevDraw, 0, 0, canvas.width / dpr, canvas.height / dpr);
    } else {
      // initialize white background
      drawCtx.fillStyle = "#fff";
      drawCtx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }

    // initialize visible canvas background (white)
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // After resizing, redraw all layers
    redrawAll();
  }

  function getMouseCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  }

  function hitTest(x, y) {
    // iterate topmost first
    for (let i = images.length - 1; i >= 0; i--) {
      const it = images[i];
      // simple axis-aligned hit test (rotation not accounted for to keep it simple)
      if (x >= it.x && x <= it.x + it.width && y >= it.y && y <= it.y + it.height) {
        return it;
      }
    }
    return null;
  }

  // ---------- Drawing (on offscreen drawCanvas) ----------
  function startDraw(e) {
    if (!canDraw) return;
    // don't start drawing when an image is active under cursor (we let image interactions take precedence)
    const m = getMouseCoords(e);
    if (hitTest(m.x, m.y)) return;

    drawing = true;
    lastX = m.x;
    lastY = m.y;
    drawCtx.beginPath();
    drawCtx.moveTo(lastX, lastY);
  }

  function draw(e) {
    if (!drawing || !canDraw) return;
    const p = getMouseCoords(e);

    drawCtx.lineWidth = lineWidth;
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    drawCtx.strokeStyle = erasing ? "#fff" : currentColor;

    drawCtx.lineTo(p.x, p.y);
    drawCtx.stroke();

    lastX = p.x;
    lastY = p.y;

    // reflect immediately on visible canvas
    redrawAll();
  }

  function stopDraw() {
    if (!drawing) return;
    drawing = false;
    drawCtx.closePath();
  }

  // ---------- Images & composition ----------
  function addImage(url, name = "") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      // scale to fit nicely (CSS pixels)
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;
      const scale = Math.min(0.8, Math.max(0.2, Math.min(cssW / img.width, cssH / img.height)));
      const width = img.width * scale;
      const height = img.height * scale;
      const x = (cssW - width) / 2;
      const y = (cssH - height) / 2;
      images.push({ img, x, y, width, height, rotation: 0 });
      if (uploadStatus) uploadStatus.textContent = `✅ Added ${name || "image"}`;
      redrawAll();
    };
    img.onerror = () => {
      if (uploadStatus) uploadStatus.textContent = "⚠️ Could not load image";
    };
  }

  function redrawAll() {
    // Clear visible canvas (CSS pixel coords)
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cssW, cssH);

    // Draw images (base layer)
    for (const it of images) {
      ctx.save();
      // rotation handled by translating to center, rotate, draw
      ctx.translate(it.x + it.width / 2, it.y + it.height / 2);
      ctx.rotate((it.rotation || 0) * Math.PI / 180);
      ctx.drawImage(it.img, -it.width / 2, -it.height / 2, it.width, it.height);
      ctx.restore();
    }

    // Draw the drawing layer (from offscreen) on top
    // drawCanvas is device-pixel sized but contexts are scaled, so drawing with css dims is fine:
    ctx.drawImage(drawCanvas, 0, 0, cssW, cssH);

    // If active image selected, draw border + handles (on visible canvas)
    if (activeImage && canDraw) {
      ctx.strokeStyle = "#3498db";
      ctx.lineWidth = 2;
      ctx.strokeRect(activeImage.x, activeImage.y, activeImage.width, activeImage.height);

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
      ctx.font = "14px Arial";
      ctx.fillText("✕", activeImage.x + activeImage.width - 16, activeImage.y - 6);
    }
  }

  // ---------- Mouse interactions (images + drawing) ----------
  canvas.addEventListener("pointerdown", (ev) => {
    if (!canDraw) return;
    const m = getMouseCoords(ev);

    // topmost image hit?
    const img = hitTest(m.x, m.y);
    if (img) {
      // choose topmost
      const idx = images.indexOf(img);
      if (idx >= 0) {
        images.splice(idx, 1);
        images.push(img); // bring to top
      }
      activeImage = img;

      // delete button area
      if (
        m.x >= img.x + img.width - 22 &&
        m.x <= img.x + img.width &&
        m.y >= img.y - 22 &&
        m.y <= img.y
      ) {
        // delete
        const i = images.indexOf(img);
        if (i >= 0) images.splice(i, 1);
        activeImage = null;
        redrawAll();
        return;
      }

      // resize handle?
      if (
        m.x >= img.x + img.width - resizeHandleSize &&
        m.y >= img.y + img.height - resizeHandleSize
      ) {
        resizing = true;
      } else {
        // start dragging
        dragging = true;
        offsetX = m.x - img.x;
        offsetY = m.y - img.y;
      }
      // ensure we don't begin drawing while moving images
      return;
    }

    // no image under cursor: select none and start drawing
    activeImage = null;
    startDraw(ev);
  });

  canvas.addEventListener("pointermove", (ev) => {
    const m = getMouseCoords(ev);
    if (dragging && activeImage) {
      activeImage.x = m.x - offsetX;
      activeImage.y = m.y - offsetY;
      redrawAll();
    } else if (resizing && activeImage) {
      activeImage.width = Math.max(30, m.x - activeImage.x);
      activeImage.height = Math.max(30, m.y - activeImage.y);
      redrawAll();
    } else {
      // pointer move might be a stroke
      draw(ev);
    }
  });

  ["pointerup", "pointercancel", "pointerout"].forEach(evt =>
    canvas.addEventListener(evt, () => {
      dragging = false;
      resizing = false;
      stopDraw();
    })
  );

  // wheel rotate if shift pressed (image rotation)
  canvas.addEventListener("wheel", (e) => {
    if (activeImage && e.shiftKey && canDraw) {
      e.preventDefault();
      activeImage.rotation = (activeImage.rotation || 0) + e.deltaY * -0.1;
      redrawAll();
    }
  }, { passive: false });

  // keyboard delete
  document.addEventListener("keydown", (e) => {
    if (!activeImage || !canDraw) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      const idx = images.indexOf(activeImage);
      if (idx >= 0) images.splice(idx, 1);
      activeImage = null;
      redrawAll();
    }
  });

  // ---------- Toolbar bindings ----------
  colorPicker?.addEventListener("input", (ev) => currentColor = ev.target.value);
  sizePicker?.addEventListener("input", (ev) => lineWidth = parseInt(ev.target.value, 10) || 3);

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
    // clear both offscreen drawing and images
    drawCtx.clearRect(0, 0, drawCanvas.width / dpr, drawCanvas.height / dpr);
    drawCtx.fillStyle = "#fff";
    drawCtx.fillRect(0, 0, drawCanvas.width / dpr, drawCanvas.height / dpr);
    images.length = 0;
    activeImage = null;
    redrawAll();
  });

  exportBtn?.addEventListener("click", () => {
    // export visible canvas contents (images + drawings)
    // make a temporary canvas at CSS pixel dims
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const tmp = document.createElement("canvas");
    tmp.width = cssW;
    tmp.height = cssH;
    const tctx = tmp.getContext("2d");
    // draw images
    tctx.fillStyle = "#fff";
    tctx.fillRect(0, 0, cssW, cssH);
    for (const it of images) {
      tctx.save();
      tctx.translate(it.x + it.width / 2, it.y + it.height / 2);
      tctx.rotate((it.rotation || 0) * Math.PI / 180);
      tctx.drawImage(it.img, -it.width / 2, -it.height / 2, it.width, it.height);
      tctx.restore();
    }
    // draw strokes from drawCanvas
    tctx.drawImage(drawCanvas, 0, 0, cssW, cssH);

    tmp.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "whiteboard.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  saveBtn?.addEventListener("click", () => {
    if (!canDraw) return alert("You don’t have permission to save.");
    const saveUrl = saveBtn.dataset.saveUrl;
    if (!saveUrl) return alert("Save URL missing");

    // export same as exportBtn but POST
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const tmp = document.createElement("canvas");
    tmp.width = cssW;
    tmp.height = cssH;
    const tctx = tmp.getContext("2d");
    tctx.fillStyle = "#fff";
    tctx.fillRect(0, 0, cssW, cssH);
    for (const it of images) {
      tctx.save();
      tctx.translate(it.x + it.width / 2, it.y + it.height / 2);
      tctx.rotate((it.rotation || 0) * Math.PI / 180);
      tctx.drawImage(it.img, -it.width / 2, -it.height / 2, it.width, it.height);
      tctx.restore();
    }
    tctx.drawImage(drawCanvas, 0, 0, cssW, cssH);

    tmp.toBlob(blob => {
      const fd = new FormData();
      fd.append("image", blob, "snapshot.png");
      fetch(saveUrl, {
        method: "POST",
        body: fd,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      }).then(r => r.json()).then(d => {
        if (d.ok) {
          saveBtn.textContent = "✅ Saved!";
          setTimeout(() => saveBtn.textContent = "Save", 1200);
        } else {
          alert("Save failed: " + (d.error || "Unknown"));
        }
      }).catch(() => alert("Save failed: Network error"));
    }, "image/png");
  });

  // ---------- File upload handler (calls addImage) ----------
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (uploadStatus) uploadStatus.textContent = "📤 Uploading...";
    const sessionId = window.location.pathname.split("/").filter(Boolean).pop();
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`/session/${sessionId}/upload/`, {
        method: "POST",
        body: fd,
        headers: { "X-CSRFToken": getCookie("csrftoken") }
      });
      const data = await res.json();
      if (data.ok || data.file_url) {
        const li = document.createElement("li");
        li.innerHTML = `<img src="${data.file_url}" class="upload-preview" alt="${file.name}">`;
        if (uploadedFiles) uploadedFiles.appendChild(li);
        addImage(data.file_url, file.name);
        if (uploadStatus) uploadStatus.textContent = `✅ Uploaded ${file.name}`;
      } else {
        if (uploadStatus) uploadStatus.textContent = "❌ Upload failed";
      }
    } catch (err) {
      console.error("upload error", err);
      if (uploadStatus) uploadStatus.textContent = "⚠️ Upload error";
    } finally {
      fileInput.value = "";
    }
  });

  // ---------- Initialization ----------
  window.addEventListener("resize", () => {
    // throttle not implemented for brevity; resize will preserve drawings
    setCanvasSize();
  });

  // If there is a saved snapshot image (server-provided), draw it on the draw layer
  if (snapshotImg && snapshotImg.src) {
    const snap = new Image();
    snap.crossOrigin = "anonymous";
    snap.src = snapshotImg.src;
    snap.onload = () => {
      // ensure sizes first
      setCanvasSize();
      // draw snapshot onto the drawCanvas (CSS coords)
      drawCtx.drawImage(snap, 0, 0, canvas.width / dpr, canvas.height / dpr);
      redrawAll();
    };
  } else {
    // set initial sizes
    setCanvasSize();
  }

  // ---------- Utilities ----------
  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }
})();
