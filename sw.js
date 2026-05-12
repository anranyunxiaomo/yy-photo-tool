const CACHE_NAME = 'sky-photo-v23';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.css',
    './app.js',
    './worker.js?v=23',
    './icon.png',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js',
    './engine_v16/transformers.min.js',
    './engine_v16/ort-wasm-simd-threaded.jsep.wasm',
    './engine_v16/ort-wasm-simd-threaded.jsep.mjs'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached version if found
            if (response) {
                return response;
            }
            
            // Otherwise fetch from network and dynamically cache if it's a CDN asset
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
                    return networkResponse;
                }

                // Dynamically cache unpredicted CDN assets and HuggingFace models
                const url = event.request.url;
                if (url.includes('cdn.jsdelivr.net') || url.includes('cdnjs.cloudflare.com') || url.includes('huggingface.co') || url.includes('hf-mirror.com')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                
                return networkResponse;
            });
        }).catch(() => {
            // Fallback for offline if something isn't cached
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});
