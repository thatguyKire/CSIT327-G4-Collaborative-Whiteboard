document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll(".toggle-draw-form");
  function getCookie(name){
    const m=document.cookie.match('(^|;)\\s*'+name+'\\s*=\\s*([^;]+)');return m?m.pop():"";
  }

  // Extracted handler for reuse
  async function handlePermissionChange(e, form) {
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
  }

  // Attach to initial forms
  forms.forEach(form => {
    form.addEventListener("change", (e) => handlePermissionChange(e, form));
  });

  // --- Presence-driven auto revoke + UI filtering (teacher only) ---
  try {
    if (window.IS_TEACHER && window.WhiteboardChannel) {
      const ch = window.WhiteboardChannel;
      let syncTimer = null;
      const listEl = document.getElementById("participantsList");
      const listUrl = listEl?.dataset.listUrl;

      function computePresentIds() {
        const state = ch.presenceState ? ch.presenceState() : {};
        // keys are presence keys (we configured key=uid)
        return Object.keys(state).map(k => parseInt(k, 10)).filter(n => Number.isFinite(n));
      }

      function applyUiFilter(presentIds) {
        const presentSet = new Set(presentIds.map(String));
        document.querySelectorAll(".participants-panel .participant-item").forEach(li => {
          const uid = li.dataset.userId || li.querySelector(".toggle-draw-form")?.dataset.userId || "";
          const isPresent = presentSet.has(uid);
          li.classList.toggle("online", isPresent);
          li.classList.toggle("offline", !isPresent);
        });
      }

      async function updateParticipantList(presentIds) {
          if (!listUrl || !listEl) return;
          
          // Check which IDs are already in the DOM
          const currentIds = new Set();
          document.querySelectorAll(".participants-panel .participant-item").forEach(li => {
              const uid = li.dataset.userId || li.querySelector(".toggle-draw-form")?.dataset.userId;
              if (uid) currentIds.add(String(uid));
          });

          // Identify if any present user is missing from the DOM
          const missingIds = presentIds.filter(id => !currentIds.has(String(id)));
          
          if (missingIds.length === 0) return; // Nothing to add

          try {
              const res = await fetch(listUrl);
              const data = await res.json();
              if (!data.ok) return;

              // Filter for participants that are in the fetched list AND missing from DOM
              const newParticipants = data.participants.filter(p => missingIds.includes(p.user_id));

              newParticipants.forEach(p => {
                  // Double check existence
                  if (document.querySelector(`.participant-item[data-user-id="${p.user_id}"]`)) return;

                  const li = document.createElement("li");
                  li.className = "participant-item offline"; // Will be set to online by applyUiFilter
                  li.dataset.userId = p.user_id;
                  
                  li.innerHTML = `
                      <div class="participant-info">
                        <span class="presence-dot" aria-hidden="true"></span>
                        <span class="participant-name">${p.username}</span>
                      </div>
                      <form method="post"
                            class="toggle-draw-form"
                            data-user-id="${p.user_id}"
                            data-url="/session/${window.CURRENT_SESSION_ID}/participants/${p.user_id}/can-draw/">
                        <label class="switch">
                          <input type="checkbox" name="can_draw" ${p.can_draw ? "checked" : ""}>
                          <span class="slider"></span>
                        </label>
                      </form>
                  `;
                  listEl.appendChild(li);

                  // Bind event listener
                  const form = li.querySelector(".toggle-draw-form");
                  form.addEventListener("change", (e) => handlePermissionChange(e, form));
              });
          } catch (e) { console.error("Failed to update participant list", e); }
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

      async function handlePresenceSync() {
        const present = computePresentIds();
        await updateParticipantList(present); // Add new users if any
        applyUiFilter(present); // Update status
        
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
