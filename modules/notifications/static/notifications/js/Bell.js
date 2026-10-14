document.addEventListener("DOMContentLoaded", () => {
  try {
    const bellBtn = document.getElementById("notifBell");
    const panel = document.getElementById("notificationsPanel");
    const badge = document.getElementById("notifBadge");
    const dot = document.getElementById("notifDot");
    const list = panel?.querySelector(".notif-list");

    if (!bellBtn || !panel) {
      console.warn("Notifications: '#notifBell' or '#notificationsPanel' not found.");
      return;
    }


    function getCookie(name) {
      const m = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
      return m ? m.pop() : "";
    }

    function showUnread(count) {
      if (!badge) return;
      if (count > 0) {
        badge.textContent = String(count);
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
        badge.textContent = "";
      }
    }

    function renderTitleBody(rawContent) {
      const text = String(rawContent || "").trim();
      if (!text) return { title: "", body: "" };
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let title = lines.length ? lines[0] : text.slice(0, 80);
      if (title.length > 80) title = title.slice(0, 80) + "…";
      const body = lines.length > 1 ? lines.slice(1).join(" ") : (text.length > title.length ? text.slice(title.length).trim() : "");
      return { title, body };
    }

    const seenIds = new Set();

    function prependItem(item) {
      if (!list || !item) return;
      if (seenIds.has(String(item.id))) return; // dedupe
      seenIds.add(String(item.id));
      const { title, body } = renderTitleBody(item.content);
      const tag = item.session_id ? 'Announcement' : '';
      const div = document.createElement("div");
      div.className = "notification-item";
      div.setAttribute("data-id", item.id);

      const entry = document.createElement('div');
      entry.className = 'notif-entry';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'notif-title';
      const strong = document.createElement('strong');
      strong.textContent = title;
      titleDiv.appendChild(strong);
      if (tag) {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'notif-tag';
        tagSpan.textContent = ' ' + tag;
        titleDiv.appendChild(tagSpan);
      }
      entry.appendChild(titleDiv);

      if (body) {
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'notif-body';
        bodyDiv.textContent = body;
        entry.appendChild(bodyDiv);
      }

      const timeEl = document.createElement('time');
      timeEl.className = 'notif-time';
      timeEl.textContent = new Date(item.created_at || Date.now()).toLocaleString();
      entry.appendChild(timeEl);

      div.appendChild(entry);
      list.prepend(div);
      while (list.children.length > 50) list.removeChild(list.lastChild);
    }

    async function refreshCount() {
      try {
        const r = await fetch("/notifications/unread-count/", { credentials: "same-origin" });
        if (!r.ok) return;
        const d = await r.json();
        showUnread(d.count || 0);
      } catch (e) {
        console.warn("Notifications: refreshCount failed", e);
      }
    }

    async function bootstrapList() {
      if (!list) return;
      try {
        const r = await fetch("/notifications/latest/", { credentials: "same-origin" });
        if (!r.ok) return;
        const d = await r.json();
        if (Array.isArray(d.items)) {
          // Clear & rebuild without losing dedupe memory? Keep seenIds; avoid re-adding existing
          while (list.firstChild) list.removeChild(list.firstChild);
          const current = [...seenIds];
          seenIds.clear();
          // Reverse items so that when we prepend them one by one, the newest ends up at the top
          // (Assuming d.items comes as [Newest, ..., Oldest])
          // 1. Prepend Oldest -> [Oldest]
          // 2. Prepend Newer -> [Newer, Oldest]
          // 3. Prepend Newest -> [Newest, Newer, Oldest]
          d.items.slice().reverse().forEach(it => prependItem(it));
          // (old seen IDs removed so list reflects latest set)
        }
      } catch (e) {
        console.warn("Notifications: bootstrapList failed", e);
      }
    }

    async function markAllRead() {
      try {
        await fetch("/notifications/mark-all-read/", {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-CSRFToken": getCookie("csrftoken") }
        });
      } catch (e) {}
      showUnread(0);
    }

    // Toggle dropdown (stopPropagation to prevent immediate close)
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const opened = panel.classList.toggle("show");
      bellBtn.setAttribute("aria-expanded", opened ? "true" : "false");
      
      if (opened) {
        // Dynamic positioning
        const rect = bellBtn.getBoundingClientRect();
        panel.style.top = `${rect.top}px`;
        panel.style.left = `${rect.right + 10}px`; // 10px gap to the right
        
        // Prevent going off-screen vertically
        const panelRect = panel.getBoundingClientRect();
        // We need to check height after it becomes visible. 
        // Since we just toggled 'show', it should be visible now.
        // However, we might need a slight delay or force layout if height is 0 immediately.
        // But usually synchronous toggle is fine.
        
        // If bottom goes past viewport
        if (rect.top + panel.offsetHeight > window.innerHeight) {
             // Align bottom with viewport bottom - 10px
             panel.style.top = `${Math.max(10, window.innerHeight - panel.offsetHeight - 10)}px`;
        }

        markAllRead();
      }
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("show")) return;
      if (!e.target.closest("#notificationsPanel") && !e.target.closest("#notifBell")) {
        panel.classList.remove("show");
        bellBtn.setAttribute("aria-expanded", "false");
      }
    });

    function startPollingLoop() {
      refreshCount();
      bootstrapList();
      setInterval(() => {
        refreshCount();
        bootstrapList();
      }, 5000); // always keep a 5s poll
    }

    // init
    startPollingLoop();
    if (window.DEBUG) console.debug("Notifications: Bell initialized");
  } catch (err) {
    console.error("Notifications: initialization error", err);
  }
});