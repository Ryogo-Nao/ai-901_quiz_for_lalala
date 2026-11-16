// ダメージ計算で使う「丸め」と「補正のかけ方」。
//
// ゲームは、1.5倍や0.75倍のような補正を、小数ではなく「4096 を 1.0 倍とした整数」で持っている。
//   1.0倍 = 4096、1.5倍 = 6144、0.5倍 = 2048、0.75倍 = 3072、1.3倍 ≒ 5325
// 小数の誤差を避けるためで、このアプリも同じ整数で計算し、丸めの位置まで合わせる。
//
// 採用している式: 第9世代(スカーレット・バイオレット)本編の計算。
// 手本にした実装: @smogon/calc(Pokémon Showdown のダメージ計算機、MIT ライセンス)の
//   src/mechanics/util.ts にある pokeRound / chainMods / getModifiedStat。
//
// 注意: 本編には、計算の途中の値が大きくなりすぎたときに桁があふれる挙動(オーバーフロー)がある。
// レベル50で通常の能力値・威力の範囲では起きないので、このアプリでは再現していない。

/** 補正の基準。4096 が 1.0 倍 */
export const MOD_BASE = 4096;

/**
 * 値に補正を掛けて、五捨五超入する。
 * 五捨五超入 = 小数部分が 0.5 より大きいときだけ切り上げ(0.5 ちょうどは切り捨て)。
 *
 * 小数を使わずに整数だけで計算している。
 *   value × mod を 4096 で割った「あまり」が 2048 より大きいときだけ、切り上げになればよい。
 *   2047 を足してから切り捨てると、ちょうどそうなる。
 */
export function applyMod(value: number, mod: number): number {
  return Math.floor((value * mod + 2047) / MOD_BASE);
}

/**
 * 複数の補正を、1つの補正にまとめる(補正の「連鎖」)。
 * 2つの補正 a, b をまとめるときは (a × b + 2048) ÷ 4096 の切り捨て。これを順番にくり返す。
 * 単純に掛け算するのと結果が少し違うことがあるので、ゲームと同じ手順で行う。
 */
export function chainMods(mods: readonly number[]): number {
  let result = MOD_BASE;
  for (const mod of mods) {
    if (mod !== MOD_BASE) result = Math.floor((result * mod + 2048) / MOD_BASE);
  }
  return result;
}

/** ランク補正の倍率。[分子, 分母] の形。-6 が 2/8、0 が 2/2、+6 が 8/2 */
const RANK_TABLE: readonly (readonly [number, number])[] = [
  [2, 8], [2, 7], [2, 6], [2, 5], [2, 4], [2, 3], // -6 〜 -1
  [2, 2], // 0
  [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], // +1 〜 +6
];

/** ランク補正(-6〜+6)を能力値に掛ける。小数点以下は切り捨て */
export function applyRank(stat: number, rank: number): number {
  const clamped = Math.max(-6, Math.min(6, Math.trunc(rank)));
  const [numerator, denominator] = RANK_TABLE[clamped + 6];
  return Math.floor((stat * numerator) / denominator);
}
