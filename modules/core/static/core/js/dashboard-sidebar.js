document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggleBtn");
  const toggleIcon = toggleBtn.querySelector(".toggle-icon");

  if (!sidebar || !toggleBtn || !toggleIcon) return;

  updateIcon();

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    sidebar.classList.toggle("expanded");
    updateIcon();
  });

  function updateIcon() {
    const isCollapsed = sidebar.classList.contains("collapsed");
    toggleIcon.src = isCollapsed
      ? "/static/core/icons/right-arrow.png"
      : "/static/core/icons/left-arrow.png";
    toggleIcon.alt = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
  }
});
