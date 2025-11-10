(() => {
  const dialog = document.getElementById("loginDialog");
  const openBtns = [document.getElementById("openLogin"), document.getElementById("openLoginHero")].filter(Boolean);
  const closeBtn = document.getElementById("closeLogin");

  openBtns.forEach(btn => btn.addEventListener("click", () => {
    if (dialog?.showModal) dialog.showModal();
    else window.location.href = "/auth/login/";
  }));

  closeBtn?.addEventListener("click", () => dialog?.close());

  // click outside to close
  dialog?.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right
                && e.clientY >= rect.top  && e.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
})();