self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('sail-store').then((cache) => cache.addAll([
            './',
            './index.html',
            './js/app.js',
            './js/api.js',
            './js/data.js',
            './js/utils.js',
            './css/style.css',
            './allvoc.json'
        ]))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
