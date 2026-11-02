/* Service worker do LabIS.
 *
 * Objetivo: permitir instalar o app na tela do celular e abrir mais rápido, SEM nunca prender o
 * usuário numa versão antiga do sistema.
 *
 * - Páginas: sempre da rede. Sem internet, mostra a página "sem conexão".
 * - Arquivos do site (/assets/*, ícones): REDE PRIMEIRO; o que foi guardado só serve se a rede falhar.
 *   (Antes era "guardado primeiro", o que podia entregar arquivo velho depois de uma atualização.)
 * - Por segurança NÃO guarda dados de pacientes: nada de páginas, chamadas ao Supabase, /api/ ou
 *   funções do servidor (/_serverFn/...).
 */
const VERSION = "labis-v2"; // mudou o nome: o navegador apaga os guardados da versão anterior
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  // allSettled: se um arquivo falhar, a instalação não é cancelada
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
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
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_")) return; // APIs e funções do servidor

  // Navegação: sempre da rede; sem internet, mostra a página "sem conexão"
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Arquivos do site e ícones: rede primeiro; se a rede falhar, usa o que foi guardado
  if (url.pathname.startsWith("/assets/") || /\.(png|ico)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Promise.reject(new Error("sem rede e sem cópia")))),
    );
  }
});
