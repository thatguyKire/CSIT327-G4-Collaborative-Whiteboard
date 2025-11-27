document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("announcementBox");
  if (!box) return;
  const form = document.getElementById("announcementForm");
  const list = document.getElementById("sentAnnouncements");
  const announceUrl = box.dataset.announceUrl;
  const listUrl = box.dataset.listUrl;
  const csrf = form.querySelector('input[name="csrfmiddlewaretoken"]')?.value || "";

  function render(items){
    // render safely without injecting raw HTML
    while (list.firstChild) list.removeChild(list.firstChild);
    const arr = items || [];
    if (!arr.length) {
      const p = document.createElement('p');
      p.style.fontSize = '.75rem';
      p.style.color = '#666';
      p.textContent = 'No announcements yet.';
      list.appendChild(p);
      return;
    }
    arr.forEach(i => {
      const wrapper = document.createElement('div');
      wrapper.className = 'sent-item';

      const span = document.createElement('span');
      span.textContent = (i.is_urgent ? '⚠️ ' : '🔔 ') + String(i.content || '');
      wrapper.appendChild(span);

      const time = document.createElement('time');
      time.textContent = new Date(i.created_at).toLocaleTimeString();
      wrapper.appendChild(time);

      const small = document.createElement('small');
      small.style.display = 'block';
      small.style.fontSize = '.65rem';
      small.style.color = '#666';
      small.textContent = `Sent to ${i.recipient_count} participant${i.recipient_count===1? '':'s'}`;
      wrapper.appendChild(small);

      list.appendChild(wrapper);
    });
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