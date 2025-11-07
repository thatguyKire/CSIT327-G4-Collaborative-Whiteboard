document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll(".toggle-draw-form");
  function getCookie(name){
    const m=document.cookie.match('(^|;)\\s*'+name+'\\s*=\\s*([^;]+)');return m?m.pop():"";
  }
  forms.forEach(form => {
    form.addEventListener("change", async (e) => {
      e.preventDefault();
      const userId = form.dataset.userId;
      const url = form.dataset.url;
      const checked = form.querySelector("input[name='can_draw']").checked;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type":"application/json",
            "X-CSRFToken": getCookie("csrftoken")
          },
          body: JSON.stringify({ can_draw: checked })
        });
        const data = await res.json().catch(()=>({ok:false}));
        if (res.ok && data.ok) {
          window.WhiteboardChannel?.send({
            type:"broadcast",
            event:"perm",
            payload:{ uid:Number(userId), can:!!checked }
          });
        } else {
          alert("Failed to update permission");
        }
      } catch(err) {
        console.error(err);
      }
    });
  });
});
