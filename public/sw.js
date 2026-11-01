/* Service worker do LabIS.
 *
 * Objetivo: permitir instalar o app na tela do celular e abrir mais rápido.
 * Por segurança NÃO guarda dados de pacientes: só arquivos estáticos do próprio site
 * (/assets/*, ícones) e a página "sem conexão". Páginas e chamadas ao Supabase/API
 * sempre vão para a rede.
 */
const VERSION = "labis-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, fontes etc. vão direto para a rede
  if (url.pathname.startsWith("/api/")) return; // portal e demais APIs: nunca em cache

  // Navegação: sempre da rede; sem internet, mostra a página "sem conexão"
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Arquivos com hash no nome (imutáveis) e ícones: cache primeiro
  if (url.pathname.startsWith("/assets/") || /\.(png|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
