document.addEventListener('DOMContentLoaded', () => {
  /* ===== Notifications & Account Dropdown ===== */
  const notifBell = document.getElementById('notifBell');
  const notifPanel = document.getElementById('notificationsPanel');
  const accountIcon = document.getElementById('accountIcon');
  const accountDropdown = document.getElementById('accountDropdown');

  // --- Toggle Notifications Panel ---
  if (notifBell && notifPanel) {
    notifBell.addEventListener('click', (e) => {
      e.stopPropagation();
      notifPanel.classList.toggle('active');
      if (accountDropdown) accountDropdown.style.display = 'none';
    });
  }

  // --- Toggle Account Dropdown ---
  if (accountIcon && accountDropdown) {
    accountIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = accountDropdown.style.display === 'block';
      accountDropdown.style.display = isVisible ? 'none' : 'block';
      if (notifPanel) notifPanel.classList.remove('active');
    });
  }

  // --- Close both when clicking outside ---
  document.addEventListener('click', (e) => {
    if (notifPanel && !notifPanel.contains(e.target) && e.target !== notifBell) {
      notifPanel.classList.remove('active');
    }
    if (accountDropdown && !accountDropdown.contains(e.target) && e.target !== accountIcon) {
      accountDropdown.style.display = 'none';
    }
  });

  /* ===== Optional: Real-Time Timestamps for Notifications ===== */
  const updateNotifTimes = () => {
    const timeElements = document.querySelectorAll('.notif-item small');
    const now = new Date();

    timeElements.forEach((el) => {
      if (el.dataset.timestamp) {
        const notifTime = new Date(el.dataset.timestamp);
        const diffMinutes = Math.floor((now - notifTime) / 60000);

        if (diffMinutes < 1) {
          el.textContent = 'Just now';
        } else if (diffMinutes < 60) {
          el.textContent = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else {
          const hours = Math.floor(diffMinutes / 60);
          el.textContent = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
      }
    });
  };

  if (document.querySelector('.notif-item')) {
    updateNotifTimes();
    setInterval(updateNotifTimes, 30000);
  }


});
