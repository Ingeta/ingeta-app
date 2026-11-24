/* Ingeta — Service Worker
 * Objectif : permettre l'installation sur l'écran d'accueil et la lecture hors ligne
 * des articles déjà consultés. Ne touche jamais aux appels Supabase.
 */
const VERSION = 'ingeta-v1';
const SHELL = `${VERSION}-shell`;
const CONTENT = `${VERSION}-content`;
const IMAGES = `${VERSION}-images`;

/* Le socle minimal, mis en cache dès l'installation. */
const SHELL_FILES = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './public.js',
  './store.js',
  './config.js',
  './manifest.webmanifest',
  './assets/favicon-192.png',
  './assets/favicon-32.png',
  './assets/favicon-180.png',
  './assets/logo-ingeta-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll échoue en bloc si un seul fichier manque : on tolère les absents.
      .then((cache) => Promise.all(
        SHELL_FILES.map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Les appels à Supabase (auth, base de données, realtime) ne doivent
 * jamais être servis depuis le cache : ce sont des données vivantes. */
function isApi(url) {
  return url.hostname.endsWith('supabase.co') ||
         url.hostname.endsWith('supabase.in') ||
         url.pathname.startsWith('/rest/v1/') ||
         url.pathname.startsWith('/auth/v1/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (isApi(url)) return;                       // laissé au réseau, sans interception
  if (url.origin !== self.location.origin) return; // polices, images externes : direct

  /* Navigation : on sert le shell, avec repli hors ligne. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  /* Contenus éditoriaux (index + tranches d'articles + podcasts) :
   * stale-while-revalidate — réponse immédiate, mise à jour en arrière-plan. */
  if (/\.(json)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(CONTENT).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => null);
          return cached || network.then((r) => r || new Response('[]', {
            headers: { 'Content-Type': 'application/json' }
          }));
        })
      )
    );
    return;
  }

  /* Images et polices : cache d'abord, réseau ensuite. */
  if (/\.(png|jpe?g|webp|svg|woff2?|ttf|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(IMAGES).then((cache) =>
        cache.match(req).then((cached) => cached || fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached))
      )
    );
    return;
  }

  /* Code de l'application : réseau d'abord pour recevoir les mises à jour,
   * cache en secours hors ligne. */
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
