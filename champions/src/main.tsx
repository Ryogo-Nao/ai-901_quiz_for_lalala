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
