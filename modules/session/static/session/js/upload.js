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
    // Prefer server-provided ID from template to avoid path parsing issues
    if (window.CURRENT_SESSION_ID) return String(window.CURRENT_SESSION_ID);
    // Fallback: parse from URL, expecting /session/<uuid>/ or /session/<uuid>/student/
    const parts = window.location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("session");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    // As a last resort, try the previous logic
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

      let data;
      if (!res.ok) {
        // Try to read JSON error message for clearer feedback
        try { data = await res.json(); } catch(_) { data = null; }
        const msg = data?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      data = await res.json();

      if (data.ok || data.file_url) {
        setStatus(`✅ ${file.name}`, "success");
        setTimeout(() => uploadStatus && (uploadStatus.textContent = ""), 2000);
        // Preview list
        if (uploadedFiles && data.file_url) {
          const li = document.createElement("li");
          li.innerHTML = `<img src="${data.file_url}" class="upload-preview" alt="${file.name}">`;
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
      const msg = String(err?.message || "Upload error");
      // Special-case permission message
      if (msg.includes("permission_denied")) {
        setStatus("You don't have permission to upload (ask the teacher to enable drawing).", "error");
      } else {
        setStatus(`⚠️ ${msg}`, "error");
      }
    } finally {
      fileInput.value = "";
    }
  });
})();