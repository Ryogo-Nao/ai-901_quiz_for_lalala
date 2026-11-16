// 性格を「この能力を 0.9 / 1.0 / 1.1 倍にしたい」という形で選ぶための関数。
//
// 性格は「上がる能力」と「下がる能力」の組み合わせで決まる(または、どちらも無い)。
// ダメージ計算の画面では、いま関係のある能力の補正だけを切り替えたいので、
// ほかの能力への影響をなるべく変えずに、希望に合う性格を探す。

import type { NatureEffect } from '../calc/stats.ts';
import type { NatureData } from '../data/index.ts';
import type { StatKey } from './stats.ts';

/** 相方にする能力を選ぶ順番。ダメージ計算に関わりにくいものから */
const FALLBACK_ORDER: StatKey[] = ['spa', 'atk', 'spd', 'def', 'spe'];

/**
 * 指定した能力への補正が effect になる性格を返す。
 * @param natures すべての性格
 * @param current いまの性格
 * @param key 補正を変えたい能力(HP 以外)
 * @param effect 'up'(1.1倍)/ 'neutral'(1.0倍)/ 'down'(0.9倍)
 */
export function natureForEffect(
  natures: readonly NatureData[],
  current: Pick<NatureData, 'up' | 'down'>,
  key: StatKey,
  effect: NatureEffect,
): NatureData | undefined {
  // いまの性格が、ほかの能力に与えている影響(変えたい能力のぶんは除く)
  const otherUp = current.up !== key ? current.up : null;
  const otherDown = current.down !== key ? current.down : null;
  const fallback = (...excluded: (StatKey | null)[]) => FALLBACK_ORDER.find((candidate) => !excluded.includes(candidate)) ?? null;

  let up: StatKey | null;
  let down: StatKey | null;
  if (effect === 'up') {
    up = key;
    down = otherDown ?? fallback(key, otherUp);
  } else if (effect === 'down') {
    down = key;
    up = otherUp ?? fallback(key, otherDown);
  } else if (otherUp === null && otherDown === null) {
    up = null; // ほかの能力にも影響が無いなら、補正なしの性格にする
    down = null;
  } else {
    // ほかの能力への影響は残し、相方を「関わりにくい能力」に移す
    up = otherUp ?? fallback(key, otherDown);
    down = otherDown ?? fallback(key, otherUp);
  }
  return natures.find((nature) => nature.up === up && nature.down === down);
}
