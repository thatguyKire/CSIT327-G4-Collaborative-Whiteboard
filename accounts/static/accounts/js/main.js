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