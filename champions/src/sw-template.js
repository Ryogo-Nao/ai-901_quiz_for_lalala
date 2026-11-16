// サービスワーカー: ブラウザの裏で動き、アプリのファイルを端末に保存しておく仕組み。
// これがあると、通信ができないときでもアプリを開ける。
//
// このファイルは「ひな形」。ビルドのとき(npm run build)に、vite.config.ts が
// 下の2つの目印を、実際の値(版の名前と、保存するファイルの一覧)に置き換えて dist/sw.js を作る。

const CACHE_NAME = '__CACHE_NAME__';
const FILES_TO_CACHE = __FILES_TO_CACHE__;

// インストールされたとき: アプリのファイルをまとめて保存する
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting()), // 古い版が動いていても、すぐに新しい版へ切り替える
  );
});

// 動き始めたとき: 前の版が保存したファイルを消す
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// ページがファイルを取りに行くたびに呼ばれる
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // ページそのもの: まず通信で最新を取りに行き、だめなら保存してあるものを使う
    event.respondWith(fetch(request).catch(() => caches.match('./index.html', { ignoreVary: true }).then((cached) => cached ?? caches.match('./', { ignoreVary: true }))));
    return;
  }
  // それ以外(プログラム、見た目、アイコン): 保存してあればそれを使い、無ければ通信する
  // ignoreVary: 保存したときと細かい条件(ヘッダー)が違っても、同じ場所のファイルなら使う
  event.respondWith(caches.match(request, { ignoreVary: true }).then((cached) => cached ?? fetch(request)));
});
