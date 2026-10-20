// Service worker de Mis Cuentas: solo guarda la pantalla principal para que la app abra sin conexión.
// Todo lo demás (Supabase, fuentes, librerías) va siempre a la red, como antes.
const CACHE = 'mis-cuentas-v1'
const PANTALLA = '/'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(PANTALLA)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Navegación: primero la red (y se guarda la copia nueva); sin red, la copia guardada.
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && new URL(e.request.url).pathname === PANTALLA) {
          const copia = r.clone()
          caches.open(CACHE).then((c) => c.put(PANTALLA, copia))
        }
        return r
      })
      .catch(() => caches.match(PANTALLA))
  )
})
