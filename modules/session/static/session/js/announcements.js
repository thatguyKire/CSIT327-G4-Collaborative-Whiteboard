document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("announcementBox");
  if (!box) return;
  const form = document.getElementById("announcementForm");
  const list = document.getElementById("sentAnnouncements");
  const announceUrl = box.dataset.announceUrl;
  const listUrl = box.dataset.listUrl;
  const csrf = form.querySelector('input[name="csrfmiddlewaretoken"]')?.value || "";

  function render(items){
    list.innerHTML = (items || []).map(i => `
      <div class="sent-item">
        <span>${i.is_urgent ? "⚠️" : "🔔"} ${i.content}</span>
        <time>${new Date(i.created_at).toLocaleTimeString()}</time>
        <small style="display:block;font-size:.65rem;color:#666;">Sent to ${i.recipient_count} participant${i.recipient_count===1?"":"s"}</small>
      </div>
    `).join("") || "<p style='font-size:.75rem;color:#666;'>No announcements yet.</p>";
  }

  async function load(){
    try {
      const r = await fetch(listUrl);
      const d = await r.json();
      render(d.items);
    } catch(e){}
  }

  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    sending = true;
    const ta = document.getElementById("announceMessage");
    const msg = ta.value.trim();
    if (!msg){ sending = false; return; }
    const urgent = form.querySelector('input[name="urgent"]').checked ? "1" : "";
    const body = new URLSearchParams({ message: msg, urgent });
    try {
      const r = await fetch(announceUrl, {
        method: "POST",
        headers: { "X-CSRFToken": csrf },
        body
      });
      const d = await r.json();
      if (d.ok){
        ta.value = "";
        load();
      }
    } catch(e){}
    sending = false;
  });

  load();
});