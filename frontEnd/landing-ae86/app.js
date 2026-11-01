(() => {
  const form = document.querySelector('#invite-form');
  const input = document.querySelector('#invite-code');
  const button = document.querySelector('#unlock');
  const status = document.querySelector('#invite-status');
  const sampleLink = document.querySelector('#sample-link');
  let failures = 0;
  let lockedUntil = 0;
  let pending = false;
  let interval;
  const buttonLabel = 'Unlock BYE <span aria-hidden="true">↗</span>';
  function message(text, success = false) {
    status.textContent = text;
    status.classList.toggle('success', success);
    input.setAttribute('aria-invalid', String(!success && Boolean(text)));
  }
  function tick() {
    const seconds = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    if (!seconds) {
      clearInterval(interval);
      failures = 0;
      lockedUntil = 0;
      input.disabled = false;
      button.disabled = false;
      button.innerHTML = buttonLabel;
      message('You can try your code again.', true);
      return;
    }
    // Update the visible timer each second, but announce only the initial lock.
    button.textContent = `Try again in ${seconds}s`;
  }
  input.addEventListener('input', () => {
    const raw = input.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
    input.value = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
    sampleLink.hidden = true;
    message('');
  });
  document.querySelectorAll('a[href="#invite-code"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
      if (!input.disabled) input.focus({ preventScroll: true });
    });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (pending || Date.now() < lockedUntil) return;
    const value = input.value.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (value.length !== 8) {
      message(value.length ? 'Enter all 8 characters of your invite code.' : 'Enter your invite code to continue.');
      input.focus();
      return;
    }
    pending = true;
    input.readOnly = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Checking code…';
    message('Checking your invite code.', true);
    sampleLink.hidden = true;
    window.setTimeout(() => {
      pending = false;
      input.readOnly = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = buttonLabel;
      if (value === 'WIZD2026') {
        failures = 0;
        message('Code accepted. Welcome to BYE.', true);
        sampleLink.hidden = false;
      } else {
        failures += 1;
        if (failures >= 3) {
          lockedUntil = Date.now() + 60000;
          input.disabled = true;
          button.disabled = true;
          message('Too many attempts. Please wait 60 seconds before trying again.');
          tick();
          interval = window.setInterval(tick, 250);
        } else {
          message(`That code didn’t work. Check it and try again. ${3 - failures} ${3 - failures === 1 ? 'try' : 'tries'} left.`);
          input.focus();
        }
      }
    }, 700);
  });
})();
