document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");
  const uploadedFiles = document.getElementById("uploadedFiles");
  const canvas = document.getElementById("whiteboardCanvas");
  const ctx = canvas.getContext("2d");

  if (!fileInput || !canvas || !ctx) return;

  const canDraw = window.CAN_DRAW === true;
  let images = [];
  let activeImage = null;
  let dragging = false;
  let resizing = false;
  let offsetX = 0;
  let offsetY = 0;
  const resizeHandleSize = 15;

  // 🖼️ Upload + Add image
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    uploadStatus.textContent = "📤 Uploading...";
    const sessionId = window.location.pathname.split("/").filter(Boolean).pop();
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/session/${sessionId}/upload/`, {
        method: "POST",
        body: formData,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      const data = await res.json();

      if (data.ok || data.file_url) {
        uploadStatus.textContent = `✅ Uploaded ${file.name}`;
        const li = document.createElement("li");
        li.innerHTML = `<img src="${data.file_url}" alt="${file.name}" class="upload-preview">`;
        uploadedFiles.appendChild(li);
        addImage(data.file_url);
      } else uploadStatus.textContent = "❌ Upload failed!";
    } catch (err) {
      uploadStatus.textContent = "⚠️ Upload error.";
      console.error(err);
    } finally {
      fileInput.value = "";
    }
  });

  // 🧠 Add draggable image
  function addImage(url) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      const scale = 0.6;
      const width = img.width * scale;
      const height = img.height * scale;
      const x = (canvas.width - width) / 2;
      const y = (canvas.height - height) / 2;
      const newImg = { img, x, y, width, height, rotation: 0 };
      images.push(newImg);
      activeImage = newImg;
      redrawCanvas();
    };
  }

  // ✅ Redraw function (fixed — clears old pixels)
  function redrawCanvas() {
    // Clear the full canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill white background to prevent ghost trails
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw all uploaded images
    for (const item of images) {
      ctx.save();
      ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.drawImage(item.img, -item.width / 2, -item.height / 2, item.width, item.height);
      ctx.restore();
    }

    // Highlight the active image
    if (activeImage && canDraw) {
      ctx.strokeStyle = "#3498db";
      ctx.lineWidth = 2;
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
      ctx.fillRect(activeImage.x + activeImage.width - 20, activeImage.y - 20, 20, 20);
      ctx.fillStyle = "#fff";
      ctx.font = "14px Arial";
      ctx.fillText("✕", activeImage.x + activeImage.width - 15, activeImage.y - 6);
    }
  }

  // 🖱️ Mouse position + hit test
  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTest(x, y) {
    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      if (x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height)
        return img;
    }
    return null;
  }

  // 🖱️ Mouse Events
  canvas.addEventListener("mousedown", (e) => {
    if (!canDraw) return;
    const mouse = getMousePos(e);
    const img = hitTest(mouse.x, mouse.y);

    if (img) {
      images = images.filter((i) => i !== img);
      images.push(img);
      activeImage = img;

      // Delete button
      if (
        mouse.x >= img.x + img.width - 20 &&
        mouse.x <= img.x + img.width &&
        mouse.y >= img.y - 20 &&
        mouse.y <= img.y
      ) {
        images = images.filter((i) => i !== img);
        activeImage = null;
        redrawCanvas();
        return;
      }

      // Resize handle
      if (
        mouse.x >= img.x + img.width - resizeHandleSize &&
        mouse.y >= img.y + img.height - resizeHandleSize
      ) {
        resizing = true;
      } else {
        dragging = true;
        offsetX = mouse.x - img.x;
        offsetY = mouse.y - img.y;
      }
    } else {
      activeImage = null;
    }
    redrawCanvas();
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!canDraw || (!dragging && !resizing)) return;
    const mouse = getMousePos(e);

    if (activeImage) {
      if (dragging) {
        activeImage.x = mouse.x - offsetX;
        activeImage.y = mouse.y - offsetY;
      } else if (resizing) {
        activeImage.width = Math.max(30, mouse.x - activeImage.x);
        activeImage.height = Math.max(30, mouse.y - activeImage.y);
      }
      redrawCanvas(); // 🧠 smooth + clean drag
    }
  });

  ["mouseup", "mouseout"].forEach((ev) => canvas.addEventListener(ev, () => {
    dragging = false;
    resizing = false;
  }));

  // ⌨️ Delete / Rotate
  document.addEventListener("keydown", (e) => {
    if (!activeImage || !canDraw) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      images = images.filter((i) => i !== activeImage);
      activeImage = null;
      redrawCanvas();
    }
  });

  canvas.addEventListener("wheel", (e) => {
    if (activeImage && e.shiftKey && canDraw) {
      e.preventDefault();
      activeImage.rotation += e.deltaY * -0.1;
      redrawCanvas();
    }
  });

  // 🔐 CSRF helper
  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }
});
