document.addEventListener('DOMContentLoaded', () => {
  // Performance: detect low-power / low-core devices and reduce decorative
  // animations to avoid janky/low-FPS pages (especially on login/signup).
  try {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hw = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    // If user prefers reduced motion or device is low-end, add a class
    if (prefersReduced || hw < 4 || mem < 2) {
      document.body.classList.add('reduce-motion');
    }
  } catch (e) {
    // silent fallback
  }

  const roleSelect = document.getElementById('id_role') || document.getElementById('role');
  const studentIdGroup = document.getElementById('student-id-group');
  const studentIdInput = document.getElementById('id_student_id');

  const toggleStudentId = () => {
    if (!roleSelect || !studentIdGroup) return;
    const selected = (roleSelect.value || '').toLowerCase();
    const isStudent = selected === 'student';

    studentIdGroup.style.display = isStudent ? 'block' : 'none';
    studentIdGroup.setAttribute('aria-hidden', isStudent ? 'false' : 'true');

    if (studentIdInput) {
      if (isStudent) {
        studentIdInput.required = true;
      } else {
        studentIdInput.required = false;
        studentIdInput.value = '';
      }
    }
  };

  // Run once on load
  toggleStudentId();

  // Re-run every time the role changes
  roleSelect?.addEventListener('change', toggleStudentId);

  // If the server returned validation errors, move focus to the first invalid field
  const firstInvalid =
    document.querySelector('[aria-invalid="true"]') ||
    document.querySelector('.form-group.has-error input, .form-group.has-error select');

  if (firstInvalid && typeof firstInvalid.focus === 'function') {
    firstInvalid.focus({ preventScroll: false });
  }
});
