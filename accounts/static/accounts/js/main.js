  // Show/hide student ID field based on role selection
  document.addEventListener('DOMContentLoaded', function() {
    const roleSelect = document.getElementById('role');
    const studentIdGroup = document.getElementById('student-id-group');

    function toggleStudentId() {
      if (roleSelect.value === 'student') {
        studentIdGroup.style.display = 'block';
      } else {
        studentIdGroup.style.display = 'none';
      }
    }

    roleSelect.addEventListener('change', toggleStudentId);
    toggleStudentId(); // Initial check
  });

  // Dropdown menu for account options
  document.addEventListener("DOMContentLoaded", () => {
  const accountBtn = document.querySelector(".account-dropdown .icon");
  const dropdown = document.querySelector(".account-dropdown .dropdown-content");

  accountBtn.addEventListener("click", () => {
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  });

  // close if clicked outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".account-dropdown")) {
      dropdown.style.display = "none";
    }
  });
});


// Toggle notifications panel
document.addEventListener("DOMContentLoaded", () => {
  const notifBell = document.getElementById("notifBell");
  const notifPanel = document.getElementById("notificationsPanel");

  if (notifBell && notifPanel) {
    notifBell.addEventListener("click", () => {
      notifPanel.classList.toggle("active");
    });
  }

  // Optional: close notifications if clicked outside
  document.addEventListener("click", (e) => {
    if (notifPanel && notifBell) {
      if (!notifPanel.contains(e.target) && e.target !== notifBell) {
        notifPanel.classList.remove("active");
      }
    }
  });
});

