(function(){
  if (window.__chatInit) return;
  window.__chatInit = true;

  const bubble = document.getElementById("chatBubble");
  const win = document.getElementById("chatWindow");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const closeBtn = document.getElementById("closeBtn");
  const minimizeBtn = document.getElementById("minimizeBtn");
  const messagesEl = document.getElementById("chatMessages");
  const disabledNotice = document.getElementById("chatDisabledNotice");
  const sidebarBtn = document.getElementById("sidebarChatBtn");
  const disabledPopup = document.getElementById("chatDisabledPopup");
  const disabledCloseBtn = document.getElementById("chatDisabledCloseBtn");

  if (!bubble || !win) return;

  const sessionId = window.CURRENT_SESSION_ID;
  if (!sessionId) console.warn("[chat] No CURRENT_SESSION_ID");

  let enabled = typeof window.CHAT_ENABLED === "boolean" ? window.CHAT_ENABLED : true;
  let roomId = null;
  let polling = null;
  let fetching = false;
  let fetchingRoom = false;
  let open = false;
  const seen = new Set();
  let lastEnableAttemptTime = 0;

  function log(...a){ if (window.DEBUG) console.log("[chat]", ...a); }

  function safeJson(r){ return r.text().then(t=>{ try{return [r,JSON.parse(t)];}catch{return [r,{}];} }); }

  function showDisabled(msg="Chat is disabled.") {
    if (disabledNotice) {
      disabledNotice.textContent = msg;
      disabledNotice.classList.remove("hidden");
    }
    if (disabledPopup) {
      disabledPopup.classList.remove("hidden");
      const desc = disabledPopup.querySelector(".chat-disabled-text");
      if (desc) desc.textContent = msg;
      // focus popup for accessibility
      disabledPopup.focus();
    }
    // hide input while disabled
    sendBtn?.setAttribute("disabled","disabled");
    input?.setAttribute("disabled","disabled");
  }

  function hideDisabled(){
    if (disabledNotice){
      disabledNotice.classList.add("hidden");
      disabledNotice.textContent = "";               // clear stale text
    }
    if (disabledPopup){
      disabledPopup.classList.add("hidden");
    }
    sendBtn?.removeAttribute("disabled");
    input?.removeAttribute("disabled");
  }

  function applyEnabled(v){
    const prev = enabled;
    enabled = !!v;
    window.CHAT_ENABLED = enabled;
    if (enabled) lastEnableAttemptTime = Date.now();
    log("applyEnabled:", enabled, "roomId:", roomId, "open:", open, "wasEnabled:", prev);

    if (enabled){
      bubble.classList.remove("hidden");
      bubble.style.display = "flex";
      hideDisabled();
      // If previously disabled, force room re-fetch when window already open
      if (open && !roomId && !fetchingRoom) ensureRoom();
    } else {
      showDisabled();
      stopPolling();
      // Keep window visible (teacher sees notice) but clear room
      roomId = null;
    }
  }
  // Expose for whiteboard.js
  window.applyChatEnabled = applyEnabled;

  function ensureRoom(){
    if (!enabled || !sessionId || fetchingRoom) {
      log("ensureRoom blocked:", {enabled, sessionId, fetchingRoom});
      return;
    }
    fetchingRoom = true;
    log("Fetching room for session:", sessionId);
    fetch(`/chat/session/${sessionId}/`)
      .then(safeJson)
      .then(([r,d])=>{
        log("Room response:", r.status, r.statusText, d);
        if (r.status===403 || d.chat_enabled===false){
          // Same stale check after enable
          const sinceEnable = Date.now() - lastEnableAttemptTime;
          if (enabled && sinceEnable < 3000) {
            log("Room 403 right after enable; scheduling retry");
            setTimeout(()=> { if (enabled) ensureRoom(); }, 700);
            return;
          }
          applyEnabled(false);
          return;
        }
        if (!r.ok || !d.room_id) return;
        roomId = d.room_id;
        hideDisabled();                               // ensure UI clears once room ready
        log("Room ID set:", roomId);
        loadMessages(true);
        if (open) startPolling();
      })
      .catch(err=> log("ensureRoom error:", err))
      .finally(()=> fetchingRoom = false);
  }

  function render(list, initial){
    if (initial){ while (messagesEl.firstChild) messagesEl.removeChild(messagesEl.firstChild); seen.clear(); }
    list.forEach(m=>{
      if (seen.has(m.id)) return;
      seen.add(m.id);
      const el = document.createElement("div");
      el.className = "chat-message";

      const meta = document.createElement('div');
      meta.className = 'chat-meta';
      const sender = document.createElement('span');
      sender.className = 'sender';
      sender.textContent = String(m.sender || '');
      meta.appendChild(sender);
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = ` (${m.timestamp || ''})`;
      meta.appendChild(time);

      const body = document.createElement('div');
      body.className = 'chat-body';
      body.textContent = m.content;

      el.appendChild(meta);
      el.appendChild(body);
      messagesEl.appendChild(el);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function loadMessages(initial=false){
    if (!roomId || fetching || !enabled){
      log("loadMessages blocked:", {roomId, fetching, enabled});
      return;
    }
    fetching = true;
    fetch(`/chat/${roomId}/messages/`)
      .then(safeJson)
      .then(([r,d])=>{
        if (r.status===403 || d.chat_enabled===false){
          const sinceEnable = Date.now() - lastEnableAttemptTime;
          if (enabled && sinceEnable < 3000) {
            log("403 right after enable; will retry room & messages");
            // Do NOT flip to disabled; re-fetch room then messages
            setTimeout(()=> {
              if (enabled) {
                ensureRoom();
                loadMessages(true);
              }
            }, 700);
            return;
          }
          log("Chat disabled while loading messages");
          applyEnabled(false);
          return;
        }
        if (!r.ok || !Array.isArray(d.messages)) return;
        render(d.messages, initial);
      })
      .catch(err=> log("loadMessages error:", err))
      .finally(()=> fetching = false);
  }

  function startPolling(){
    stopPolling();
    if (!enabled || !roomId){
      log("startPolling blocked:", {enabled, roomId});
      return;
    }
    log("Starting polling");
    polling = setInterval(()=> loadMessages(false), 5000);
  }
  function stopPolling(){
    if (polling){
      clearInterval(polling);
      polling = null;
      log("Stopped polling");
    }
  }

  function openWindow(){
    if (!sessionId){
      showDisabled("Session not initialized.");
      win.classList.remove("hidden","minimized");
      return;
    }
    if (!enabled){
      showDisabled();
      win.classList.remove("hidden","minimized");
      return;
    }
    win.classList.remove("hidden","minimized");
    hideDisabled();
    open = true;
    if (!roomId && !fetchingRoom) ensureRoom(); else if (roomId) { loadMessages(true); startPolling(); }
    input && input.focus();
  }

  function closeWindow(){
    win.classList.add("hidden");
    open = false;
    stopPolling();
  }

  function toggleMin(){
    if (!open) return;
    win.classList.toggle("minimized");
  }

  bubble.addEventListener("click", e=>{
    e.stopPropagation();
    log("Bubble clicked", {open, enabled, roomId});
    open ? closeWindow() : openWindow();
  });
  sidebarBtn?.addEventListener("click", e=>{ e.preventDefault(); openWindow(); });
  bubble.addEventListener("keydown", e=>{
    if (e.key==="Enter"||e.key===" ") { e.preventDefault(); bubble.click(); }
  });
  closeBtn?.addEventListener("click", closeWindow);
  minimizeBtn?.addEventListener("click", toggleMin);

  function sendMessage(){
    if (!enabled){ showDisabled(); return; }
    if (!roomId){
      log("No roomId, ensuring room then retry");
      if (!fetchingRoom) ensureRoom();
      setTimeout(()=> {
        if (roomId) sendMessage();
      }, 800);
      return;
    }
    const text = (input.value||"").trim();
    if (!text) return;
    sendBtn.disabled = true;
    fetch(`/chat/${roomId}/send/`, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-CSRFToken": (document.cookie.match(/csrftoken=([^;]+)/)||[])[1]||""
      },
      body: JSON.stringify({content:text})
    })
      .then(safeJson)
      .then(([r,d])=>{
        if (r.status===403 || d.chat_enabled===false){
          applyEnabled(false);
          return;
        }
        if (!r.ok || !d.message) return;
        render([d.message], false);
        input.value = "";
      })
      .catch(err=> log("sendMessage error:", err))
      .finally(()=> { sendBtn.disabled=false; input.focus(); });
  }
  sendBtn?.addEventListener("click", sendMessage);
  input?.addEventListener("keydown", e=>{
    if (e.key==="Enter"){ e.preventDefault(); sendMessage(); }
  });

  // Late bind realtime listener (channel appears later)
  function bindRealtime(){
    if (!window.WhiteboardChannel || window.__chatRealtimeBound) return;
    window.__chatRealtimeBound = true;
    window.WhiteboardChannel.on("broadcast",{event:"meta"}, ({payload})=>{
      if (payload?.t==="chat"){
        log("Realtime toggle (late bind):", payload.enabled);
        applyEnabled(payload.enabled);
      }
    });
    log("Realtime listener bound");
  }
  const rtInterval = setInterval(()=>{
    bindRealtime();
    if (window.__chatRealtimeBound) clearInterval(rtInterval);
  }, 500);

  disabledCloseBtn?.addEventListener("click", () => {
    disabledPopup?.classList.add("hidden");
  });

  applyEnabled(enabled);
  if (sessionId){
    bubble.classList.remove("hidden");
    bubble.style.display = "flex";
  }
  log("Chat initialized", {sessionId, enabled});
})();
