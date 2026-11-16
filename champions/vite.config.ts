import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * ビルドのときに、サービスワーカー(dist/sw.js)を作る小さな追加機能。
 *
 * サービスワーカーは「どのファイルを端末に保存しておくか」の一覧を必要とする。
 * ビルドするたびにファイル名が変わる(中身が変わると名前も変わる)ので、
 * ビルドの最後に、出来上がったファイルの一覧をひな形(src/sw-template.js)に書き込む。
 */
function serviceWorker(): Plugin {
  return {
    name: 'champions-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).map((fileName) => `./${fileName}`)
      // public/ に置いたファイルは bundle に入らないので、ここに書く
      const files = [
        './',
        './index.html',
        './manifest.webmanifest',
        './favicon.svg',
        './icons/icon-192.png',
        './icons/icon-512.png',
        ...built,
      ]
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8')
      // 版の名前: ファイルの一覧とひな形から作る。どちらかが変われば名前が変わり、古い保存分が消される
      const version = (built.join('|') + template)
        .split('')
        .reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 7)
        .toString(36)
      const source = template
        .replace('__CACHE_NAME__', `champions-tool-${version}`)
        .replace('__FILES_TO_CACHE__', JSON.stringify([...new Set(files)], null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// Vite(開発サーバーとビルド)と Vitest(テスト)の設定。
// https://vite.dev/config/
export default defineConfig({
  // 公開するとき、どのフォルダに置いても動くように、ファイルの場所を相対パスで書き出す
  base: './',
  plugins: [react(), serviceWorker()],
  test: {
    // テストとして実行するファイル。「〜.test.ts」という名前のもの
    include: ['src/**/*.test.ts'],
  },
})
