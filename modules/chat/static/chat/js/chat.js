document.addEventListener("DOMContentLoaded", () => {
  const chatBubble = document.getElementById("chatBubble");
  const chatWindow = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("closeBtn");
  const minimizeBtn = document.getElementById("minimizeBtn");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");

  // === OPEN / CLOSE / MINIMIZE ===
  chatBubble.addEventListener("click", () => {
    chatWindow.classList.remove("hidden");
    chatWindow.classList.remove("minimized");
    chatBubble.style.display = "none";
  });

  closeBtn.addEventListener("click", () => {
    chatWindow.classList.add("hidden");
    chatBubble.style.display = "flex";
  });

  minimizeBtn.addEventListener("click", () => {
    chatWindow.classList.toggle("minimized");
  });

  // === DRAGGABLE BUBBLE ===
  let isDragging = false, offsetX, offsetY;
  chatBubble.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - chatBubble.getBoundingClientRect().left;
    offsetY = e.clientY - chatBubble.getBoundingClientRect().top;
    chatBubble.style.transition = "none";
    chatBubble.style.cursor = "grabbing";
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    const maxX = window.innerWidth - chatBubble.offsetWidth;
    const maxY = window.innerHeight - chatBubble.offsetHeight;
    chatBubble.style.left = Math.max(0, Math.min(maxX, x)) + "px";
    chatBubble.style.top = Math.max(0, Math.min(maxY, y)) + "px";
    chatBubble.style.bottom = "auto";
    chatBubble.style.right = "auto";
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
    chatBubble.style.transition = "transform 0.2s ease";
    chatBubble.style.cursor = "grab";
  });

  // === BASIC CHAT FETCH (dummy integration placeholder) ===
  const sessionId = window.location.pathname.split("/").filter(Boolean).pop();
  let roomId = null;

  async function initChat() {
    try {
      const res = await fetch(`/chat/session/${sessionId}/`);
      const data = await res.json();
      roomId = data.room_id;
      loadMessages();
      setInterval(loadMessages, 3000);
    } catch (err) {
      console.warn("Chat not active or unavailable yet");
    }
  }

  async function loadMessages() {
    if (!roomId) return;
    try {
      const res = await fetch(`/chat/${roomId}/messages/`);
      const data = await res.json();
      chatMessages.innerHTML = "";
      data.messages.forEach((msg) => {
        const div = document.createElement("div");
        div.classList.add("chat-message");
        div.innerHTML = `
          <span class="sender">${msg.sender}</span>
          <span class="time">(${msg.timestamp})</span><br>
          ${msg.content}
        `;
        chatMessages.appendChild(div);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch {}
  }

  async function sendMessage() {
    if (!roomId || !chatInput.value.trim()) return;
    const message = chatInput.value.trim();
    chatInput.value = "";
    try {
      await fetch(`/chat/${roomId}/send/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ content: message }),
      });
      loadMessages();
    } catch {}
  }

  sendBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // === Helper ===
  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }

  initChat();

  // === Sidebar "Chats" button opens chat ===
  const sidebarChatsBtn = Array.from(document.querySelectorAll(".menu-btn"))
    .find(btn => btn.textContent.trim() === "Chats");
  if (sidebarChatsBtn) {
    sidebarChatsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      chatWindow.classList.remove("hidden");
      chatBubble.style.display = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});
