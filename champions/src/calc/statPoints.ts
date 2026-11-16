// 能力ポイントの決まり(合計66まで、1つの能力に32まで)を扱う関数。
//
// 画面はここにある関数を通してしか能力ポイントを変えない。
// そうすると「上限を超えた値」は、どんな入力のしかたをされても作られない。

import { MAX_STAT_POINTS_PER_STAT, MAX_TOTAL_STAT_POINTS } from '../domain/limits.ts';
import { STAT_KEYS, type StatKey, type StatTable } from '../domain/stats.ts';

/** 使っている能力ポイントの合計 */
export function totalStatPoints(points: StatTable): number {
  return STAT_KEYS.reduce((sum, key) => sum + points[key], 0);
}

/** 残りの能力ポイント */
export function remainingStatPoints(points: StatTable): number {
  return MAX_TOTAL_STAT_POINTS - totalStatPoints(points);
}

/**
 * その能力に、いま最大でいくつまで振れるか。
 * 「1つの能力に32まで」と「合計66まで」の両方を満たす最大の値。
 */
export function maxStatPointsFor(points: StatTable, key: StatKey): number {
  return Math.min(MAX_STAT_POINTS_PER_STAT, points[key] + remainingStatPoints(points));
}

/**
 * 1つの能力のポイントを変えた、新しい表を返す。
 * 希望の値が上限を超えていたら、入れられる最大の値に直す。0 未満や数値でないものは 0 にする。
 *
 * 元の表は書き換えず、新しい表を作って返す。
 * (React は「前と違う入れ物になったか」で描き直すかどうかを決めるので、この書き方が必要)
 */
export function setStatPoint(points: StatTable, key: StatKey, requested: number): StatTable {
  const wholeNumber = Number.isFinite(requested) ? Math.trunc(requested) : 0;
  const clamped = Math.max(0, Math.min(wholeNumber, maxStatPointsFor(points, key)));
  return { ...points, [key]: clamped };
}

/** 能力ポイントが決まりを守っているか */
export function isValidStatPoints(points: StatTable): boolean {
  const eachIsValid = STAT_KEYS.every(
    (key) => Number.isInteger(points[key]) && points[key] >= 0 && points[key] <= MAX_STAT_POINTS_PER_STAT,
  );
  return eachIsValid && totalStatPoints(points) <= MAX_TOTAL_STAT_POINTS;
}
