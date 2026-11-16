// プログラムの出発点。index.html から最初に読み込まれる。

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/global.css';

// index.html の <div id="root"> の中に、App(画面全体)を表示する。
// StrictMode は、開発中に間違いやすい書き方を警告してくれる仕組み(公開版には影響しない)。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 公開版でだけ、サービスワーカーを登録する(通信なしでも開けるようにする仕組み。public と vite.config.ts を参照)。
// 開発中に登録すると、古いファイルが使われ続けて混乱するので、登録しない。
// 対応していない環境や、登録に失敗したときは、ふつうの Web ページとしてそのまま動く。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
