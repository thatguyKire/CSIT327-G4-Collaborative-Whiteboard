document.addEventListener('DOMContentLoaded', () => {
  // ===== Toggle Student ID Field =====
  const roleSelect = document.getElementById('role');
  const studentIdGroup = document.getElementById('student-id-group');

  if (roleSelect && studentIdGroup) {
    const toggleStudentId = () => {
      studentIdGroup.style.display = roleSelect.value === 'student' ? 'block' : 'none';
    };
    roleSelect.addEventListener('change', toggleStudentId);
    toggleStudentId(); // Initial call
  }

  // ===== Notifications & Account Dropdown =====
  const notifBell = document.getElementById('notifBell');
  const notifPanel = document.getElementById('notificationsPanel');
  const accountIcon = document.getElementById('accountIcon');
  const accountDropdown = document.getElementById('accountDropdown');

  // Toggle Notifications Panel
  if (notifBell && notifPanel) {
    notifBell.addEventListener('click', (e) => {
      e.stopPropagation();
      notifPanel.classList.toggle('active');
      if (accountDropdown) accountDropdown.style.display = 'none';
    });
  }

  // Toggle Account Dropdown
  if (accountIcon && accountDropdown) {
    accountIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      accountDropdown.style.display =
        accountDropdown.style.display === 'block' ? 'none' : 'block';
      if (notifPanel) notifPanel.classList.remove('active');
    });
  }

  // Close both when clicking outside
  document.addEventListener('click', (e) => {
    if (notifPanel && !notifPanel.contains(e.target) && e.target !== notifBell) {
      notifPanel.classList.remove('active');
    }
    if (accountDropdown && !accountDropdown.contains(e.target) && e.target !== accountIcon) {
      accountDropdown.style.display = 'none';
    }
  });
});
