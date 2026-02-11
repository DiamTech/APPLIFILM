self.addEventListener('install', (e) => {
  console.log('Service Worker installé');
});

self.addEventListener('fetch', (e) => {
  // Indispensable pour le mode hors-ligne plus tard
});
