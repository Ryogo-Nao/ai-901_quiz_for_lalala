import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Vite(開発サーバーとビルド)と Vitest(テスト)の設定。
// https://vite.dev/config/
export default defineConfig({
  // 公開するとき、どのフォルダに置いても動くように、ファイルの場所を相対パスで書き出す
  base: './',
  plugins: [react()],
  test: {
    // テストとして実行するファイル。「〜.test.ts」という名前のもの
    include: ['src/**/*.test.ts'],
  },
})
