document.addEventListener("DOMContentLoaded", function () {
  const forms = document.querySelectorAll(".toggle-draw-form");

  forms.forEach(form => {
    form.addEventListener("change", async (e) => {
      e.preventDefault();
      const userId = form.dataset.userId;
      const checked = form.querySelector("input[name='can_draw']").checked;

      const csrftoken = document.cookie.split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];

      try {
        const res = await fetch(`/session/${userId}/toggle_draw/`, {
          method: "POST",
          headers: {
            "X-CSRFToken": csrftoken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ can_draw: checked })
        });

        const data = await res.json();
        if (data.ok) {
          console.log(`✅ Updated draw permission for user ${userId}`);
        } else {
          alert("⚠️ Failed to update permission");
        }
      } catch (err) {
        console.error("Error updating permission:", err);
      }
    });
  });
});
