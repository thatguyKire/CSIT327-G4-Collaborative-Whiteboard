(() => {
  const canvas = document.getElementById("whiteboardCanvas");
  const ctx = canvas.getContext("2d");
  const snapshotImg = document.getElementById("snapshotImg");
  const canDraw = window.CAN_DRAW || false;

  const backBtn = document.getElementById("backBtn");

  // --- Fix: Back button click ---
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const backUrl = backBtn.dataset.backUrl || document.referrer || "";
      if (backUrl) {
        window.location.href = backUrl;
      } else {
        history.back();
      }
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (!canDraw) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawSnapshot() {
    if (!snapshotImg || !snapshotImg.src) return;
    const img = new Image();
    img.src = snapshotImg.src + "?_=" + Date.now(); // prevent caching
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  }

  // --- Drawing (if allowed) ---
  let drawing = false;
  let lastX = 0, lastY = 0;
  let color = "#000";
  let size = 3;
  let erasing = false;

  if (canDraw) {
    const colorPicker = document.getElementById("colorPicker");
    const sizePicker = document.getElementById("sizePicker");
    const penBtn = document.getElementById("penBtn");
    const eraserBtn = document.getElementById("eraserBtn");

    colorPicker.addEventListener("input", e => color = e.target.value);
    sizePicker.addEventListener("input", e => size = e.target.value);
    penBtn.addEventListener("click", () => { erasing = false; penBtn.classList.add("active"); eraserBtn.classList.remove("active"); });
    eraserBtn.addEventListener("click", () => { erasing = true; eraserBtn.classList.add("active"); penBtn.classList.remove("active"); });

    function getCoords(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener("pointerdown", e => {
      drawing = true;
      const { x, y } = getCoords(e);
      lastX = x; lastY = y;
      ctx.beginPath();
      ctx.moveTo(x, y);
    });

    canvas.addEventListener("pointermove", e => {
      if (!drawing) return;
      const { x, y } = getCoords(e);
      ctx.lineWidth = size;
      ctx.strokeStyle = erasing ? "#fff" : color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x; lastY = y;
    });

    canvas.addEventListener("pointerup", () => drawing = false);
    canvas.addEventListener("pointerout", () => drawing = false);
  } else {
    canvas.style.pointerEvents = "none";
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  drawSnapshot();

  // Auto-refresh snapshot every 10s for read-only users
  if (!canDraw) {
    setInterval(drawSnapshot, 10000);
  }
})();
