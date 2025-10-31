document.addEventListener('DOMContentLoaded', () => {
  const roleSelect = document.getElementById('id_role') || document.getElementById('role');
  const studentIdGroup = document.getElementById('student-id-group');

  if (roleSelect && studentIdGroup) {
    const toggleStudentId = () => {
      const selected = roleSelect.value.toLowerCase();
      if (selected === 'student') {
        studentIdGroup.style.display = 'block';
      } else {
        studentIdGroup.style.display = 'none';
      }
    };

    // Run once on load
    toggleStudentId();

    // Re-run every time the role changes
    roleSelect.addEventListener('change', toggleStudentId);
  }
});
