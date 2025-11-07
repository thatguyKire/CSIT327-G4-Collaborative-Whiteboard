document.addEventListener("DOMContentLoaded", () => {
  const chatBubble = document.getElementById("chatBubble");
  const chatWindow = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("closeBtn");
  const minimizeBtn = document.getElementById("minimizeBtn");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const unreadBadge = document.getElementById("unreadBadge");
  const chatStatus = document.getElementById("chatStatus");

  // State
  let isOpen = false;
  let isMinimized = false;
  let isDragging = false;
  let offsetX = 0, offsetY = 0;
  let roomId = null;
  let pollingTimer = null;
  let inFlight = false;
  let lastMessageId = 0;

  // =========================
  // UI helpers
  // =========================
  function setStatus(ok) {
    if (!chatStatus) return;
    chatStatus.style.color = ok ? "#2ecc71" : "#bdc3c7";
    chatStatus.title = ok ? "Connected" : "Offline";
  }
  function incrementUnread(by = 1) {
    if (!unreadBadge) return;
    const current = parseInt(unreadBadge.textContent || "0", 10) || 0;
    const next = current + by;
    unreadBadge.textContent = String(next);
    unreadBadge.style.display = next > 0 ? "inline-block" : "none";
  }
  function resetUnread() {
    if (!unreadBadge) return;
    unreadBadge.textContent = "0";
    unreadBadge.style.display = "none";
  }

  function openChat() {
    chatWindow.classList.remove("hidden");
    chatWindow.classList.remove("minimized");
    chatBubble.style.display = "none";
    isOpen = true;
    isMinimized = false;
    resetUnread();
    chatInput?.focus();
  }
  function closeChat() {
    chatWindow.classList.add("hidden");
    chatBubble.style.display = "flex";
    isOpen = false;
  }
  function toggleMinimize() {
    chatWindow.classList.toggle("minimized");
    isMinimized = chatWindow.classList.contains("minimized");
  }

  // Open via keyboard
  chatBubble.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openChat();
    }
  });

  // Open/Close/Minimize
  chatBubble.addEventListener("click", openChat);
  closeBtn?.addEventListener("click", closeChat);
  minimizeBtn?.addEventListener("click", toggleMinimize);

  // Escape closes/minimizes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      if (!isMinimized) toggleMinimize();
      else closeChat();
    }
  });

  // =========================
  // Draggable bubble
  // =========================
  chatBubble.addEventListener("mousedown", (e) => {
    isDragging = true;
    const rect = chatBubble.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
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
    if (!isDragging) return;
    isDragging = false;
    chatBubble.style.transition = "transform 0.2s ease";
    chatBubble.style.cursor = "grab";
  });

  // =========================
  // Chat API
  // =========================
  // Only init chat when a session id is explicitly provided (e.g., on whiteboard pages)
  const sessionId = window.CURRENT_SESSION_ID || null;
  if (!sessionId) {
    // No session context on this page; hide/disable bubble to avoid errors
    document.getElementById("chatBubble")?.classList.add("hidden");
    document.getElementById("chatWindow")?.classList.add("hidden");
    return;
  }

  async function initChat() {
    try {
      const res = await fetch(`/chat/session/${sessionId}/`);
      const data = await res.json();
      if (!res.ok || !data.room_id) throw new Error("Chat init failed");
      roomId = data.room_id;
      setStatus(true);
      await loadMessages(true);
      startPolling();
    } catch (err) {
      setStatus(false);
      window.WhiteboardApp?.showToast?.("Chat unavailable.", "error");
    }
  }

  function startPolling() {
    clearInterval(pollingTimer);
    const intervalVisible = 3000;
    const intervalHidden = 10000;
    const computeInterval = () => (document.hidden ? intervalHidden : intervalVisible);
    let currentInterval = computeInterval();
    pollingTimer = setInterval(loadMessages, currentInterval);
    document.addEventListener("visibilitychange", () => {
      const next = computeInterval();
      if (next !== currentInterval) {
        clearInterval(pollingTimer);
        currentInterval = next;
        pollingTimer = setInterval(loadMessages, currentInterval);
      }
    });
  }

  function createMessageElement(msg) {
    const wrap = document.createElement("div");
    wrap.classList.add("chat-message");

    const meta = document.createElement("div");
    meta.classList.add("chat-meta");

    const sender = document.createElement("span");
    sender.classList.add("sender");
    sender.textContent = msg.sender;

    const time = document.createElement("span");
    time.classList.add("time");
    time.textContent = ` (${msg.timestamp})`;

    meta.appendChild(sender);
    meta.appendChild(time);

    const body = document.createElement("div");
    body.classList.add("chat-body");
    body.textContent = msg.content; // prevents XSS

    wrap.appendChild(meta);
    wrap.appendChild(body);
    return wrap;
  }

  async function loadMessages(initial = false) {
    if (!roomId || inFlight) return;
    inFlight = true;
    try {
      const res = await fetch(`/chat/${roomId}/messages/`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.messages)) throw new Error("Fetch error");
      setStatus(true);

      const msgs = data.messages;
      const newMsgs = lastMessageId ? msgs.filter(m => m.id > lastMessageId) : msgs;

      if (initial) {
        chatMessages.innerHTML = "";
      }
      if (newMsgs.length) {
        chatMessages.querySelector(".chat-empty")?.remove();
        newMsgs.forEach(m => {
          const el = createMessageElement(m);
          chatMessages.appendChild(el);
          lastMessageId = Math.max(lastMessageId, m.id);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (!isOpen || isMinimized) incrementUnread(newMsgs.length);
      } else if (initial && !msgs.length) {
        // keep "No messages yet" placeholder if present
      }
    } catch (e) {
      setStatus(false);
    } finally {
      inFlight = false;
    }
  }

  async function sendMessage() {
    if (!roomId) return;
    const message = chatInput.value.trim();
    if (!message) return;

    sendBtn.disabled = true;
    try {
      const r = await fetch(`/chat/${roomId}/send/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ content: message }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) throw new Error(d.error || "Send failed");
      chatInput.value = "";
      await loadMessages();
    } catch (e) {
      window.WhiteboardApp?.showToast?.(e.message || "Failed to send message", "error");
    } finally {
      sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  sendBtn?.addEventListener("click", sendMessage);
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // =========================
  // Helper
  // =========================
  function getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match.pop() : "";
  }

  // Init
  initChat();

  // Sidebar "Chats" button opens chat
  const sidebarChatsBtn = Array.from(document.querySelectorAll(".menu-btn"))
    .find(btn => btn.textContent.trim() === "Chats");
  if (sidebarChatsBtn) {
    sidebarChatsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openChat();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});
