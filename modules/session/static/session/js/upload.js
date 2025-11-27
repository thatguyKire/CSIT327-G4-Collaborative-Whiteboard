(() => {
  "use strict";
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");
  const uploadedFiles = document.getElementById("uploadedFiles");

  function setStatus(msg, type = "info") {
    if (uploadStatus) uploadStatus.textContent = msg;
    if (window.WhiteboardApp?.showToast) {
      const toastType = type === "error" ? "error" : type === "success" ? "success" : "info";
      window.WhiteboardApp.showToast(msg, toastType);
    }
  }

  function getSessionId() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.pop();
  }

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      if (!window.WhiteboardApp?.canDraw) {
        setStatus("You don't have permission to upload.", "error");
        fileInput.value = "";
        return;
      }

      setStatus("📤 Uploading...");
      const sessionId = getSessionId();
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/session/${sessionId}/upload/`, {
        method: "POST",
        body: fd,
        headers: { "X-CSRFToken": window.WhiteboardApp?.getCookie?.("csrftoken") || "" }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.ok || data.file_url) {
        setStatus(`✅ ${file.name}`, "success");
        setTimeout(() => uploadStatus && (uploadStatus.textContent = ""), 2000);
        // Preview list
        if (uploadedFiles && data.file_url) {
          const li = document.createElement("li");
          const img = document.createElement("img");
          img.className = "upload-preview";
          img.src = data.file_url || "";
          img.alt = file.name || "";
          li.appendChild(img);
          uploadedFiles.appendChild(li);
        }
        // Add to board + broadcast
        if (data.file_url && window.WhiteboardApp?.addImageFromUrl) {
          const id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
          const placed = await window.WhiteboardApp.addImageFromUrl(data.file_url, { id });
          // Broadcast normalized placement so others add the same image and track it by id
          const canvas = document.getElementById("whiteboardCanvas");
          const rect = canvas.getBoundingClientRect();
          const payload = {
            t: "add",
            id,
            url: data.file_url,
            x: placed.x / rect.width,
            y: placed.y / rect.height,
            w: placed.width / rect.width,
            h: placed.height / rect.height
          };
          window.WhiteboardChannel?.send({ type: "broadcast", event: "image", payload });
        }
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("⚠️ Upload error", "error");
    } finally {
      fileInput.value = "";
    }
  });
})();