document.addEventListener("DOMContentLoaded", () => {
    const backButton = document.querySelector(".back-button img");

    backButton.addEventListener("click", () => {
        window.history.back();
    });
});
