// 確定数(何発で倒せるか)の計算。
//
// 1発のダメージは乱数で16通りあり、どれも同じ確率(1/16)で出る。
// n 発当てたときの合計がHP以上になる確率を、すべての組み合わせから求める。

/** 確定数の結果 */
export interface KoResult {
  /** 倒せる可能性がある、最も少ない回数 */
  hits: number;
  /** その回数で倒せる確率(0〜1)。1 なら「確定」 */
  chance: number;
  /** 確定か(最小ダメージだけが続いても倒せる) */
  isGuaranteed: boolean;
}

/** これより多くの回数が必要なときは、計算を打ち切る */
export const MAX_KO_HITS = 10;

/**
 * 確定数を求める。
 * @param rolls 1発のダメージ16通り
 * @param hp 相手の残りHP
 * @returns 結果。ダメージが 0、または MAX_KO_HITS 発でも倒せないときは null
 */
export function calcKo(rolls: readonly number[], hp: number): KoResult | null {
  const max = Math.max(...rolls);
  const min = Math.min(...rolls);
  if (max <= 0 || hp <= 0) return null;

  // 「合計ダメージ → その合計になる確率」の表。最初は「0ダメージが確率1」
  // 合計が hp 以上になったものは、まとめて hp として扱う(倒せたことに変わりはないため)
  let distribution = new Map<number, number>([[0, 1]]);

  for (let hits = 1; hits <= MAX_KO_HITS; hits++) {
    // 1発ぶん進める: いまの合計それぞれに、16通りのダメージを足す
    const next = new Map<number, number>();
    for (const [total, probability] of distribution) {
      for (const roll of rolls) {
        const newTotal = Math.min(hp, total + roll);
        next.set(newTotal, (next.get(newTotal) ?? 0) + probability / rolls.length);
      }
    }
    distribution = next;

    if (max * hits >= hp) {
      // 最大ダメージが続けば倒せる回数に届いた = 倒せる可能性がある最小の回数
      const isGuaranteed = min * hits >= hp;
      return { hits, chance: isGuaranteed ? 1 : (distribution.get(hp) ?? 0), isGuaranteed };
    }
  }
  return null;
}

/** 確定数を「確定2発」「乱数2発(37.5%)」の形の文字にする */
export function formatKo(ko: KoResult | null): string {
  if (!ko) return `${MAX_KO_HITS}発では倒せない`;
  if (ko.isGuaranteed) return `確定${ko.hits}発`;
  // 小数第1位まで。四捨五入で 100.0% や 0.0% にならないよう、切り捨てて 0.1 を下限にする
  const percent = Math.max(0.1, Math.floor(ko.chance * 1000) / 10);
  return `乱数${ko.hits}発(${percent.toFixed(1)}%)`;
}
