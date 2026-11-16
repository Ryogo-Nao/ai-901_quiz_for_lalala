// まだ正しく計算できない技の一覧。
//
// これらの技は、ふつうの式に当てはまらない特別な決まりを持っている。
// 間違った数字を出すより「未対応」と表示するほうが安全なので、計算せずに知らせる。
// 対応したら、ここから外す(外すと、手本との突き合わせテストの対象に入る)。

export const UNSUPPORTED_MOVE_IDS: ReadonlySet<string> = new Set([
  // 攻撃や防御に、ふつうと違う能力値を使う技
  'psyshock', // サイコショック: 特殊技だが、相手の「ぼうぎょ」で計算する
  'psystrike', // サイコブレイク: 同上
  'secretsword', // しんぴのつるぎ: 同上
  'bodypress', // ボディプレス: 自分の「ぼうぎょ」で攻撃する
  'foulplay', // イカサマ: 相手の「こうげき」で攻撃する
  // 相手のランク補正を無視する技
  'darkestlariat', // DDラリアット
  'sacredsword', // せいなるつるぎ
  'chipaway', // なしくずし
  // 状況によって威力が変わる、または失敗する技
  'facade', // からげんき: 状態異常のとき威力2倍(やけどの半減も受けない)
  'meteorbeam', // メテオビーム: 攻撃の前に「とくこう」が1段階上がる
  'steelroller', // アイアンローラー: フィールドが無いと失敗する
  'poltergeist', // ポルターガイスト: 相手が持ち物を持っていないと失敗する
  'knockoff', // はたきおとす: 相手が持ち物を持っていると威力1.5倍
]);

/**
 * その技を、いまの計算で正しく扱えないか。
 * 「威力が状況で決まる技」(データに variablePower の目印があるもの)も未対応。
 */
export function isUnsupportedMove(move: { id: string; variablePower?: boolean }): boolean {
  return move.variablePower === true || UNSUPPORTED_MOVE_IDS.has(move.id);
}
