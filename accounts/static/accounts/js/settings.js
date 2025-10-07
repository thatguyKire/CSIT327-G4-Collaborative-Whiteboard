document.addEventListener("DOMContentLoaded", () => {
  const backButton = document.querySelector(".back-button img");
  if (backButton) {
    backButton.addEventListener("click", () => {
      window.history.back();
    });
  }
});
