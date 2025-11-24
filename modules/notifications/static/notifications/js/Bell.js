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

    const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content || "";
    const SUPABASE_URL = meta("supabase-url") || window.SUPABASE_URL || "";
    const SUPABASE_KEY = meta("supabase-key") || meta("supabase-anon-key") || window.SUPABASE_ANON_KEY || "";
    const userId = parseInt(meta("user-id") || window.CURRENT_USER_ID || "0", 10);

    function escapeHtml(s = "") {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
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
      const tag = item.session_id ? '<span class="notif-tag">Announcement</span>' : '';
      const div = document.createElement("div");
      div.className = "notification-item";
      div.setAttribute("data-id", item.id);
      div.innerHTML = `
        <div class="notif-entry">
          <div class="notif-title"><strong>${escapeHtml(title)}</strong> ${tag}</div>
          ${body ? `<div class="notif-body">${escapeHtml(body)}</div>` : ""}
          <time class="notif-time">${new Date(item.created_at || Date.now()).toLocaleString()}</time>
        </div>
      `;
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
          list.innerHTML = "";
          const current = [...seenIds];
          seenIds.clear();
          d.items.forEach(it => prependItem(it));
          // (old seen IDs removed so list reflects latest set)
        }
      } catch (e) {
        console.warn("Notifications: bootstrapList failed", e);
      }
    }

    async function markAllRead() {
      try { await fetch("/notifications/mark-all-read/", { credentials: "same-origin" }); } catch (e) {}
      showUnread(0);
    }

    // Toggle dropdown (stopPropagation to prevent immediate close)
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const opened = panel.classList.toggle("show");
      bellBtn.setAttribute("aria-expanded", opened ? "true" : "false");
      if (opened) markAllRead();
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

    function startRealtime() {
      try {
        if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY || !userId) {
          console.debug("Bell: realtime prerequisites missing -> polling only");
          startPollingLoop();
          return;
        }
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.debug("Bell: created supabase client", {SUPABASE_URL});
        const channel = client
          .channel(`notif-${userId}`)
          .on("postgres_changes",
              { event: "INSERT", schema: "public", table: "notifications_notification", filter: `recipient_id=eq.${userId}` },
              (payload) => {
                console.debug("Bell: received payload", payload);
                const n = payload.new || {};
                prependItem(n);
                if (!panel.classList.contains("show")) {
                  const cur = Number(badge?.textContent || "0");
                  showUnread(cur + 1);
                }
              })
          .subscribe((status) => {
            console.debug("Bell: channel subscribe status", status);
            if (status === "SUBSCRIBED") {
              refreshCount();
              bootstrapList();
            }
          });

        // Start polling regardless (hybrid safety net)
        startPollingLoop();

        setTimeout(() => {
          if (channel.state !== "joined") {
            console.debug("Bell: channel not joined (state=%s) continuing polling fallback", channel.state);
          }
        }, 4000);
      } catch (e) {
        console.warn("Notifications: realtime init failed -> polling fallback", e);
        startPollingLoop();
      }
    }
    // init
    refreshCount();
    startRealtime();
    console.debug("Notifications: Bell initialized");
  } catch (err) {
    console.error("Notifications: initialization error", err);
  }
});