// 能力値(実数値)の計算。
//
// 採用している式(ポケモンチャンピオンズの仕様。レベル50固定・個体値なし):
//
//   HP     = 種族値 + 75 + 能力ポイント
//   HP以外 = floor((種族値 + 20 + 能力ポイント) × 性格補正)
//            性格補正は 上がる能力 1.1 / 下がる能力 0.9 / それ以外 1.0
//
// floor は「小数点以下を切り捨てる」という意味。
//
// このファイルの関数は、画面にも保存にも触れない「純粋関数」。
// 同じ入力なら必ず同じ結果を返すので、stats.test.ts で自動テストできる。

import { STAT_KEYS, type StatKey, type StatTable } from '../domain/stats.ts';

/** 性格がその能力に与える影響: 上がる / 下がる / 変わらない */
export type NatureEffect = 'up' | 'down' | 'neutral';

/** 性格のうち、計算に必要な部分だけを取り出した形 */
export interface NatureModifier {
  /** 上がる能力。補正なしの性格は null */
  up: StatKey | null;
  /** 下がる能力。補正なしの性格は null */
  down: StatKey | null;
}

/** HP の実数値 */
export function calcHp(baseStat: number, statPoints: number): number {
  return baseStat + 75 + statPoints;
}

/** HP 以外の実数値 */
export function calcOtherStat(baseStat: number, statPoints: number, effect: NatureEffect): number {
  const beforeNature = baseStat + 20 + statPoints;

  // 性格補正は 1.1 や 0.9 を直接掛けず、「× 11 ÷ 10」「× 9 ÷ 10」と整数で計算する。
  // コンピュータは 1.1 や 0.9 を正確に表せず、ごく小さな誤差を持つ。
  // その誤差のせいで切り捨ての結果が 1 ずれる事故を、整数の計算にすることで防ぐ。
  if (effect === 'up') return Math.floor((beforeNature * 11) / 10);
  if (effect === 'down') return Math.floor((beforeNature * 9) / 10);
  return beforeNature;
}

/** その性格が、指定した能力を上げるのか下げるのか */
export function natureEffectOn(nature: NatureModifier, key: StatKey): NatureEffect {
  if (key === 'hp') return 'neutral'; // HP は性格の影響を受けない
  if (nature.up === nature.down) return 'neutral'; // 補正なしの性格
  if (nature.up === key) return 'up';
  if (nature.down === key) return 'down';
  return 'neutral';
}

/**
 * 6つの能力の実数値をまとめて計算する。
 * @param baseStats 種族値
 * @param statPoints 能力ポイント
 * @param nature 性格(上がる能力と下がる能力)
 */
export function calcStats(baseStats: StatTable, statPoints: StatTable, nature: NatureModifier): StatTable {
  const result = {} as StatTable;
  for (const key of STAT_KEYS) {
    result[key] =
      key === 'hp'
        ? calcHp(baseStats.hp, statPoints.hp)
        : calcOtherStat(baseStats[key], statPoints[key], natureEffectOn(nature, key));
  }
  return result;
}
