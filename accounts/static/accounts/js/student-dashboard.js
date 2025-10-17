document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggleBtn");
  const toggleIcon = toggleBtn.querySelector(".toggle-icon");

  // Initialize correct icon on load
  updateIcon();

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    sidebar.classList.toggle("expanded");
    updateIcon();
  });

  function updateIcon() {
    if (sidebar.classList.contains("collapsed")) {
      toggleIcon.src = "/static/accounts/icons/right - arrow.png";
      toggleIcon.alt = "Expand sidebar";
    } else {
      toggleIcon.src = "/static/accounts/icons/left - arrow.png";
      toggleIcon.alt = "Collapse sidebar";
    }
  }
});
