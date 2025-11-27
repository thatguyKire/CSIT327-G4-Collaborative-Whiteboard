document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("fullNotificationsList");
  if (!list) return;
  const meta = n => document.querySelector(`meta[name="${n}"]`)?.content || "";
  const SUPABASE_URL = meta("supabase-url") || window.SUPABASE_URL || "";
  const SUPABASE_KEY = meta("supabase-key") || window.SUPABASE_ANON_KEY || "";
  const userId = parseInt(meta("user-id") || window.CURRENT_USER_ID || "0", 10);
  const knownIds = new Set(
    Array.from(list.querySelectorAll(".notif-card")).map(el => el.getAttribute("data-id"))
  );

  function renderOne(n) {
    if (!n || knownIds.has(String(n.id))) return;
    knownIds.add(String(n.id));
    const card = document.createElement("div");
    card.className = "notif-card";
    card.setAttribute("data-id", n.id);
    const urgentIcon = n.is_urgent ? "⚠️" : "🔔";
    // Basic split
    const text = String(n.content || "").trim();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const title = lines[0] || text.slice(0, 80);
    const body = lines.length > 1 ? lines.slice(1).join(" ") : "";
    // build elements safely
    const iconDiv = document.createElement('div');
    iconDiv.className = 'notif-icon';
    iconDiv.textContent = urgentIcon;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'notif-content';

    const h3 = document.createElement('h3');
    h3.textContent = title.length > 80 ? title.slice(0,80) + '…' : title;
    contentDiv.appendChild(h3);

    if (body) {
      const p = document.createElement('p');
      p.textContent = body;
      contentDiv.appendChild(p);
    } else {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = '—';
      contentDiv.appendChild(p);
    }

    const time = document.createElement('time');
    time.setAttribute('datetime', n.created_at);
    time.textContent = 'just now';
    contentDiv.appendChild(time);

    card.appendChild(iconDiv);
    card.appendChild(contentDiv);
    list.prepend(card);
  }

  // Fallback polling (in case realtime fails)
  async function poll() {
    try {
      const r = await fetch("/notifications/latest/", { credentials: "same-origin" });
      if (!r.ok) return;
      const d = await r.json();
      (d.items || []).forEach(renderOne);
    } catch {}
  }

  function startRealtime() {
    if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY || !userId) {
      poll();
      return setInterval(poll, 8000);
    }
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    client.channel(`notif-page-${userId}`)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications_notification", filter: `recipient_id=eq.${userId}` },
          payload => renderOne(payload.new))
      .subscribe(status => {
        if (status === "SUBSCRIBED") poll();
      });
    // Hybrid poll
    setInterval(poll, 15000);
  }

  startRealtime();
});