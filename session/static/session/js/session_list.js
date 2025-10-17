document.addEventListener("DOMContentLoaded", function () {
  const forms = document.querySelectorAll(".delete-session-form");
  forms.forEach((form) => {
    form.addEventListener("submit", function (e) {
      // Confirm
      const ok = confirm("Are you sure you want to delete this session? This action cannot be undone.");
      if (!ok) {
        e.preventDefault();
        return;
      }

      // Prevent double submit / provide feedback
      const btn = form.querySelector("button[type='submit']");
      if (btn) {
        btn.disabled = true;
        btn.dataset.origText = btn.textContent;
        btn.textContent = "Deleting...";
      }

      // Graceful fallback: if submit doesn't complete in 8s, re-enable button
      const reenableTimeout = setTimeout(() => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = btn.dataset.origText || "Delete";
        }
      }, 8000);

      // When page unloads (success or navigation), clear timeout
      window.addEventListener("pagehide", () => clearTimeout(reenableTimeout), { once: true });
    });
  });
});