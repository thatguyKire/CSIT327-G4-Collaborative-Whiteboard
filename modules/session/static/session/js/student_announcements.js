document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("studentAnnouncementBox");
  if (!box) return;
  const listEl = document.getElementById("studentAnnouncementsList");
  const listUrl = box.dataset.listUrl;
  const sessionId = window.CURRENT_SESSION_ID || box.dataset.sessionId;

  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content || "";
  const SUPABASE_URL = window.SUPABASE_URL || meta("supabase-url") || "";
  const SUPABASE_KEY = window.SUPABASE_ANON_KEY || meta("supabase-key") || "";
  const userId = parseInt(meta("user-id") || window.CURRENT_USER_ID || "0", 10);

  const seenIds = new Set(); // NEW

  function escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function splitContent(raw) {
    const text = String(raw || "").trim();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let title = lines.length ? lines[0] : text.slice(0, 80);
    if (title.length > 80) title = title.slice(0, 80) + "…";
    const body = lines.length > 1 ? lines.slice(1).join(" ") : "";
    return { title, body };
  }

  function render(items) {
    // clear list safely
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    seenIds.clear();
    (items || []).forEach(i => {
      if (!i || seenIds.has(String(i.id))) return;
      seenIds.add(String(i.id));
      const { title, body } = splitContent(i.content);
      const div = document.createElement("div");
      div.className = "sent-item";
      div.setAttribute("data-id", i.id);

      const titleEl = document.createElement("div");
      titleEl.className = "sent-title";
      const strong = document.createElement("strong");
      strong.textContent = title ? escapeHtml(title) : "";
      titleEl.appendChild(strong);
      if (i.is_urgent) {
        const tag = document.createElement("span");
        tag.className = "notif-tag";
        tag.textContent = " ⚠️";
        titleEl.appendChild(tag);
      }

      div.appendChild(titleEl);
      if (body) {
        const bodyEl = document.createElement("div");
        bodyEl.className = "sent-body";
        bodyEl.textContent = escapeHtml(body);
        div.appendChild(bodyEl);
      }
      const timeEl = document.createElement("time");
      timeEl.textContent = new Date(i.created_at).toLocaleTimeString();
      div.appendChild(timeEl);

      listEl.appendChild(div);
    });
    if (!listEl.children.length) {
      const p = document.createElement("p");
      p.style.fontSize = ".75rem";
      p.style.color = "#666";
      p.textContent = "No announcements yet.";
      listEl.appendChild(p);
    }
  }

  async function loadInitial() {
    try {
      const r = await fetch(listUrl, { credentials: "same-origin" });
      if (!r.ok) return;
      const d = await r.json();
      render(d.items || []);
    } catch (e) {
      console.warn("Failed loading session announcements", e);
    }
  }

  function prependOne(n) {
    if (!n || seenIds.has(String(n.id))) return;
    seenIds.add(String(n.id));
    const { title, body } = splitContent(n.content);
    const div = document.createElement("div");
    div.className = "sent-item";
    div.setAttribute("data-id", n.id);

    const titleEl = document.createElement("div");
    titleEl.className = "sent-title";
    const strong = document.createElement("strong");
    strong.textContent = title ? escapeHtml(title) : "";
    titleEl.appendChild(strong);
    if (n.is_urgent) {
      const tag = document.createElement("span");
      tag.className = "notif-tag";
      tag.textContent = " ⚠️";
      titleEl.appendChild(tag);
    }
    div.appendChild(titleEl);
    if (body) {
      const bodyEl = document.createElement("div");
      bodyEl.className = "sent-body";
      bodyEl.textContent = escapeHtml(body);
      div.appendChild(bodyEl);
    }
    const timeEl = document.createElement("time");
    timeEl.textContent = new Date(n.created_at || Date.now()).toLocaleTimeString();
    div.appendChild(timeEl);

    listEl.prepend(div);
    while (listEl.children.length > 50) listEl.removeChild(listEl.lastChild);
  }

  function startRealtime() {
    console.debug("student_announcements: startRealtime vars", { SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY, userId, sessionId });
    if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY || !userId) {
      loadInitial();
      return;
    }
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const ch = client
      .channel(`notif-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications_notification', filter: `recipient_id=eq.${userId}` },
        payload => {
          const n = payload.new || {};
          if (String(n.session_id) === String(sessionId)) {
            prependOne(n);
          }
        })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') loadInitial();
      });
  }

  startRealtime();
});