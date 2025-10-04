const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("toggleBtn");

toggleBtn.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  sidebar.classList.toggle("expanded");

  // Change arrow direction depending on state
  toggleBtn.innerHTML = sidebar.classList.contains("collapsed") ? "&lt;" : "&gt;";
});
