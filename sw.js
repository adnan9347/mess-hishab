// Offline app shell: local files are pre-cached; CDN assets are cached on first use (stale-while-revalidate).
const VERSION = 'mh-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tailwind.css',
  './css/app.css',
  './icons/icon.svg',
  './js/main.js',
  './js/App.js',
  './js/config.js',
  './js/core/DhakaDate.js',
  './js/core/I18n.js',
  './js/core/Router.js',
  './js/core/Storage.js',
  './js/core/util.js',
  './js/domain/HishabCalculator.js',
  './js/domain/MealEntry.js',
  './js/domain/Money.js',
  './js/domain/RetentionPolicy.js',
  './js/domain/SettlementStrategy.js',
  './js/data/Repository.js',
  './js/data/LocalRepository.js',
  './js/data/FirestoreRepository.js',
  './js/data/DemoSeeder.js',
  './js/auth/AuthService.js',
  './js/auth/DemoAuthService.js',
  './js/auth/FirebaseAuthService.js',
  './js/i18n/bn.js',
  './js/i18n/en.js',
  './js/ui/View.js',
  './js/ui/components.js',
  './js/ui/StatementExporter.js',
  './js/ui/views/AuthViews.js',
  './js/ui/views/OnboardingView.js',
  './js/ui/views/TodayView.js',
  './js/ui/views/HishabView.js',
  './js/ui/views/PayView.js',
  './js/ui/views/MessView.js',
  './js/ui/views/BazarView.js',
  './js/ui/views/ManagerView.js',
  './js/ui/views/SettlementView.js',
  './js/ui/views/SettingsView.js'
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin;
  const isCdn = CDN_HOSTS.includes(url.hostname);
  if (!isLocal && !isCdn) return; // Firestore/Auth traffic goes straight to the network.

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: isLocal });
      const network = fetch(request).then((res) => {
        if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
        return res;
      });
      // App files: network first so updates show immediately, cache when offline (load-shedding).
      // Versioned CDN files never change: serve from cache first.
      if (isLocal) return network.catch(() => cached || cache.match('./index.html'));
      return cached || network;
    })
  );
});
