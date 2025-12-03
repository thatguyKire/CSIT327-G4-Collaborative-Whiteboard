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

  // --- Presence-driven auto revoke + UI filtering (teacher only) ---
  try {
    if (window.IS_TEACHER && window.WhiteboardChannel) {
      const ch = window.WhiteboardChannel;
      let syncTimer = null;

      function computePresentIds() {
        const state = ch.presenceState ? ch.presenceState() : {};
        // keys are presence keys (we configured key=uid)
        return Object.keys(state).map(k => parseInt(k, 10)).filter(n => Number.isFinite(n));
      }

      function applyUiFilter(presentIds) {
        const presentSet = new Set(presentIds.map(String));
        document.querySelectorAll(".participants-panel .participant-item").forEach(li => {
          const uid = li.querySelector(".toggle-draw-form")?.dataset.userId || "";
          const isPresent = presentSet.has(uid);
          li.classList.toggle("online", isPresent);
          li.classList.toggle("offline", !isPresent);
        });
      }

      async function syncServer(presentIds) {
        try {
          const url = `/session/${window.CURRENT_SESSION_ID}/presence/sync/`;
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
            body: JSON.stringify({ present_user_ids: presentIds })
          });
        } catch (e) { /* non-fatal */ }
      }

      function handlePresenceSync() {
        const present = computePresentIds();
        applyUiFilter(present);
        // debounce server sync
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => syncServer(present), 1200);
      }

      ch.on && ch.on("presence", { event: "sync" }, handlePresenceSync);
      // Apply initial presence state shortly after subscribe
      setTimeout(handlePresenceSync, 800);

      // End-of-session cleanup: when teacher leaves, auto-revoke all
      window.addEventListener("beforeunload", () => {
        try {
          const url = `/session/${window.CURRENT_SESSION_ID}/presence/sync/`;
          const payload = JSON.stringify({ present_user_ids: [] });
          if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: "application/json" });
            navigator.sendBeacon(url, blob);
          } else {
            fetch(url, {
              method: "POST",
              keepalive: true,
              headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
              body: payload
            }).catch(()=>{});
          }
          // Also broadcast a global permission revoke so clients update instantly
          try {
            ch.send({ type: "broadcast", event: "perm", payload: { uid: "all", can: false } });
          } catch {}
        } catch {}
      });
    }
  } catch (e) {
    console.warn("Participants presence wiring failed", e);
  }
});
