// Handles chat enable/disable toggle buttons on session list
document.querySelectorAll(".toggle-chat-form").forEach(form => {
  form.addEventListener("submit", e => {
    e.preventDefault();
    const btn = form.querySelector("button");
    const url = form.getAttribute("action");
    const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "";
    btn.disabled = true;
    fetch(url, {
      method: "POST",
      headers: { "X-CSRFToken": csrf }
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          btn.textContent = d.chat_enabled ? "Disable Chat" : "Enable Chat";
          // Broadcast if channel exists (teacher in whiteboard)
          window.WhiteboardChannel?.send({
            type: "broadcast",
            event: "meta",
            payload: { t: "chat", enabled: d.chat_enabled }
          });
        }
      })
      .finally(() => { btn.disabled = false; });
  });
});