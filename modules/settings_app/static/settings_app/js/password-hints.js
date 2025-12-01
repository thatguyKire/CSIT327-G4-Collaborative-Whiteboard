document.addEventListener('DOMContentLoaded', function () {
  const pwInput = document.getElementById('id_new_password1');
  if (!pwInput) return;

  const hintUpper = document.getElementById('hint-uppercase');
  const hintDigit = document.getElementById('hint-digit');
  const hintSpecial = document.getElementById('hint-special');
  const form = pwInput.closest('form');
  const submitBtn = document.getElementById('pwSubmit');
  // container for client-side error messages
  let clientErrorList = null;
  const formGroup = pwInput.closest('.form-group');

  function ensureClientErrorList() {
    if (!clientErrorList) {
      clientErrorList = document.createElement('ul');
      clientErrorList.className = 'form-errors client-side';
      form.insertBefore(clientErrorList, form.firstChild);
    }
  }

  function checkPassword() {
    const v = pwInput.value || '';
    // Uppercase
    if (/[A-Z]/.test(v)) {
      hintUpper.classList.add('ok');
    } else {
      hintUpper.classList.remove('ok');
    }
    // Digit
    if (/\d/.test(v)) {
      hintDigit.classList.add('ok');
    } else {
      hintDigit.classList.remove('ok');
    }
    // Special char
    if (/[^A-Za-z0-9]/.test(v)) {
      hintSpecial.classList.add('ok');
    } else {
      hintSpecial.classList.remove('ok');
    }

    // Toggle red input state on the password field
    if (formGroup) {
      const ok = /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
      if (ok) {
        formGroup.classList.remove('has-error');
      } else {
        formGroup.classList.add('has-error');
      }
    }
  }

  pwInput.addEventListener('input', checkPassword);
  // run once to initialize state
  checkPassword();

  // Prevent form submit if client-side requirements are not met
  if (form) {
    form.addEventListener('submit', function (e) {
      const v = pwInput.value || '';
      const missing = [];
      if (!/[A-Z]/.test(v)) missing.push('At least one uppercase letter');
      if (!/\d/.test(v)) missing.push('At least one digit');
      if (!/[^A-Za-z0-9]/.test(v)) missing.push('At least one special character');

      if (missing.length > 0) {
        e.preventDefault();
        ensureClientErrorList();
        clientErrorList.innerHTML = '';
        missing.forEach(function (m) {
          const li = document.createElement('li');
          li.className = 'field-error';
          li.textContent = m;
          clientErrorList.appendChild(li);
        });
        if (submitBtn) {
          submitBtn.disabled = false; // keep enabled so user can fix and resubmit
        }
        // focus the password input for convenience
        pwInput.focus();
      }
    });
  }
});
