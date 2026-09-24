/* 出面表アプリを圏外でも開けるようにするための Service Worker。
 *
 * 方針
 *   ページ（HTML）は「まずネットワーク、駄目ならキャッシュ」。
 *     → オンラインなら必ず最新が出るので、更新したのに古い画面が出る事故を防ぐ。
 *   アイコンなどは「まずキャッシュ」。
 *
 * app/sw.js が原本。web/ 側は scripts/deploy_pages.sh がコピーする。
 * 中身を変えたら CACHE の版数を上げること（古いキャッシュはその時点で捨てられる）。
 */
const CACHE = "dezura-v1";

/* 圏外でも最初から開けるよう、インストール時に取っておくもの */
const ASSETS = [
  "./attendance.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .catch(() => { /* 1 つでも取れなければ諦める。次回の起動でやり直す */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    ev.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./attendance.html")))
    );
    return;
  }

  ev.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
