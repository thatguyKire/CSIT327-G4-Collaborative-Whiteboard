document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");
  const uploadedFiles = document.getElementById("uploadedFiles");
  const canvas = document.getElementById("whiteboardCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;

  if (!fileInput || !canvas || !ctx) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    uploadStatus.textContent = "📤 Uploading...";
    const sessionId = window.location.pathname.split("/").filter(Boolean).pop();
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/session/${sessionId}/upload/`, {
        method: "POST",
        body: formData,
        headers: {
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      const data = await response.json();

      if (data.ok || data.file_url) {
        uploadStatus.textContent = `✅ Upload successful! ${file.name}`;
        const li = document.createElement("li");

        // 🖼️ Show preview for image files
        if (data.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          li.innerHTML = `<img src="${data.file_url}" alt="Uploaded image" class="upload-preview">`;

          // Draw the uploaded image directly on canvas
          drawImageOnCanvas(data.file_url);
        } else {
          li.innerHTML = `<a href="${data.file_url}" target="_blank">${file.name}</a>`;
        }

        uploadedFiles.appendChild(li);
      } else {
        uploadStatus.textContent = "❌ Upload failed!";
      }
    } catch (err) {
      uploadStatus.textContent = "⚠️ Upload error.";
      console.error("Upload failed:", err);
    } finally {
      fileInput.value = "";
    }
  });

  // 🎨 Draw uploaded image on canvas, scaled to fit perfectly and remain crisp
  function drawImageOnCanvas(url) {
    if (!ctx || !canvas) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Adjust for device pixel ratio for sharper rendering
      const scaleFactor = window.devicePixelRatio || 1;
      ctx.imageSmoothingEnabled = false;

      const canvasWidth = canvas.width / scaleFactor;
      const canvasHeight = canvas.height / scaleFactor;

      const imgRatio = img.width / img.height;
      const canvasRatio = canvasWidth / canvasHeight;

      let imgWidth, imgHeight;

      // Fit image proportionally within the canvas (no cropping)
      if (imgRatio > canvasRatio) {
        imgWidth = canvasWidth * 0.8;
        imgHeight = imgWidth / imgRatio;
      } else {
        imgHeight = canvasHeight * 0.8;
        imgWidth = imgHeight * imgRatio;
      }

      const x = (canvasWidth - imgWidth) / 2;
      const y = (canvasHeight - imgHeight) / 2;

      // Clear previous drawing before rendering image
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.drawImage(img, x, y, imgWidth, imgHeight);
      console.log("✅ Image drawn to canvas:", url);
    };

    img.onerror = () => {
      console.warn("⚠️ Failed to load image:", url);
      uploadStatus.textContent = "⚠️ Could not display uploaded image.";
    };

    img.src = url;
  }

  // 🔐 Helper: CSRF token getter
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(name + "=")) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
});
