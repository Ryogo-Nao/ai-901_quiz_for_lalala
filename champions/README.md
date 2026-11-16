# 対戦補助ツール(ポケモンチャンピオンズ用・非公式)

能力値の計算、チーム編成、ダメージ計算をするための Web アプリです。学習のために作っています。

- 個人の学習用に作った**非公式のファンツール**です。株式会社ポケモン・任天堂・クリーチャーズ・ゲームフリークとは関係ありません
- いまは**ステップ3(チーム編成)**まで出来ています。ダメージ計算はこれから作ります

| 文書 | 内容 |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | 全体の設計(画面、データの形、拡張の仕組み、開発の手順) |
| [docs/STEP1.md](docs/STEP1.md) | ステップ1(能力値計算)の解説と、動作確認の方法 |
| [docs/STEP2.md](docs/STEP2.md) | ステップ2(個体の保存)の解説と、動作確認の方法 |
| [docs/STEP3.md](docs/STEP3.md) | ステップ3(チーム編成)の解説と、動作確認の方法 |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | 使っているデータのライセンス表記 |

## 動かし方

[Node.js](https://nodejs.org/) のバージョン 22.12 以上が必要です(`node -v` で確認できます)。

```bash
cd champions      # このフォルダに移動する
npm install       # 必要なライブラリをダウンロードする(最初の1回だけ)
npm run dev       # 開発用のサーバーを起動する
```

表示された `http://localhost:5173/` をブラウザで開きます。止めるときは `Ctrl + C` を押します。

## コマンドの一覧

`npm run 名前` と打つと、`package.json` の `scripts` に書いてあるコマンドが実行されます。

| コマンド | 何をするか | いつ使うか |
|---|---|---|
| `npm install` | `package.json` に書いてあるライブラリを `node_modules/` にダウンロードする | 最初の1回と、`package.json` が変わったとき |
| `npm run dev` | 開発用のサーバーを起動する。ファイルを保存すると、ブラウザの表示がすぐ変わる | 作りながら画面を確かめるとき |
| `npm test` | 自動テストを全部実行する | コードやデータを変えたあと |
| `npm run test:watch` | ファイルを保存するたびに、関係するテストを自動で実行し直す | 計算の関数を書いているとき |
| `npm run typecheck` | TypeScript が、データの形の食い違いを調べる | コードを変えたあと |
| `npm run lint` | 間違いやすい書き方を調べる | コードを変えたあと |
| `npm run build` | 公開用のファイルを `dist/` に作る(型のチェックも一緒に行う) | 公開する前 |
| `npm run preview` | `npm run build` で作ったものを、手元で表示して確かめる | 公開する前 |
| `npm run data:build` | 公開データから `src/data/*.json` を作り直す | ポケモンを足すとき |

## ポケモンを足す

1. `scripts/data-config.json` の `pokemon` に、ID を足す
   (英語名から記号と空白を除いて小文字にしたもの。例: Rotom-Wash → `rotomwash`)
2. `npm run data:build` を実行する
3. 最後に出る「確認が必要なこと」を読む
4. `npm test` を実行する
5. ゲーム内の表示と見比べる

くわしくは [docs/DESIGN.md](docs/DESIGN.md) の 9 章を見てください。
