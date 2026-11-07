'use strict';
const button = document.getElementById('copy');
const installer = document.getElementById('installer');
const feedback = document.getElementById('copy-feedback');
button.addEventListener('click', async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(installer.value);
    button.firstChild.textContent = 'Copied to clipboard ';
    feedback.textContent = 'Copied! Open Scriptable, paste it into a new script, and tap ▶.';
  } catch (_) {
    installer.closest('details').open = true;
    installer.focus();
    installer.select();
    feedback.textContent = 'Copy the selected code manually, then open Scriptable.';
  }
});
