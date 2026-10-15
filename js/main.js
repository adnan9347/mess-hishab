import { App } from './App.js';

const app = new App(document.getElementById('app'));
app.start().catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML =
    '<div class="splash"><p>Something went wrong while starting. কিছু একটা সমস্যা হয়েছে — পেজটি আবার লোড করুন।</p></div>';
});

// Installable PWA + offline app shell (skipped on file:// and in local previews without https).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Exposed for debugging in the browser console only.
window.__messHishab = app;
