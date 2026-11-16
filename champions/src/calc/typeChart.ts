// タイプ相性。

/** タイプ相性の表。chart[技のタイプ][受ける側のタイプ] = 倍率(0 / 0.5 / 1 / 2) */
export type TypeChart = Record<string, Record<string, number>>;

/**
 * 技のタイプと、受ける側のタイプ(1つか2つ)から、相性の倍率を求める。
 * 受ける側が2タイプのときは、それぞれの倍率を掛け合わせる(例: 2 × 2 = 4、2 × 0.5 = 1)。
 */
export function typeEffectiveness(chart: TypeChart, moveType: string, defenderTypes: readonly string[]): number {
  let result = 1;
  for (const defenderType of defenderTypes) result *= chart[moveType]?.[defenderType] ?? 1;
  return result;
}
