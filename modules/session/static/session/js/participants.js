document.addEventListener("DOMContentLoaded", function () {
  const forms = document.querySelectorAll(".toggle-draw-form");

  function getCookie(name) {
    const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : "";
  }

  forms.forEach((form) => {
    form.addEventListener("change", async (e) => {
      e.preventDefault();
      const userId = form.dataset.userId;
      const url = form.dataset.url; // {% url 'toggle_draw_permission' session.id p.user.id %}
      const checked = form.querySelector("input[name='can_draw']").checked;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
          },
          body: JSON.stringify({ can_draw: checked }),
        });

        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json")
          ? await res.json()
          : { ok: false, error: await res.text() };

        if (res.ok && data.ok) {
          // broadcast live permission change
          window.WhiteboardChannel?.send({
            type: "broadcast",
            event: "perm",
            payload: { uid: Number(userId), can: !!checked },
          });
        } else {
          console.error("Toggle failed:", data.error || res.statusText);
          alert("Failed to update permission.");
        }
      } catch (err) {
        console.error("Request error:", err);
        alert("Network error updating permission.");
      }
    });
  });
});
