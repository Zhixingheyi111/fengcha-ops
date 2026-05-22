/* Feng Cha Ops — service worker (network-first for app, so updates reach phones) */
/* Bump CACHE version whenever you want to force-clear old caches. */

var CACHE = 'fengcha-ops-v2';
var SHELL = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();})
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){if(k!==CACHE)return caches.delete(k);}));
    }).then(function(){return self.clients.claim();})
  );
});

self.addEventListener('fetch', function(e){
  var url = e.request.url;
  /* Never touch Supabase / EmailJS / CDN / fonts — always live network */
  if(url.indexOf('supabase.co')>-1 || url.indexOf('emailjs')>-1 || url.indexOf('cdn.')>-1 || url.indexOf('fonts.')>-1){
    return;
  }
  /* App shell (HTML/manifest/icons): NETWORK-FIRST so new deploys show up.
     Fall back to cache only when offline. */
  e.respondWith(
    fetch(e.request).then(function(resp){
      /* update cache with the fresh copy */
      var copy = resp.clone();
      caches.open(CACHE).then(function(c){ try{c.put(e.request, copy);}catch(err){} });
      return resp;
    }).catch(function(){
      return caches.match(e.request);
    })
  );
});
