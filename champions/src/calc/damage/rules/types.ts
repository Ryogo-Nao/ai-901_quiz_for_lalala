// 補正ルールの形。

import type { Modifier, StageId } from '../modifier.ts';
import type { Situation } from '../situation.ts';

/** ルール = 「整理した状況を見て、Modifier(補正)の一覧を返す関数」 */
export type ModifierRule = (situation: Situation) => Modifier[];

/** Modifier を1つ作る(書く量を減らすための小さな関数) */
export const mod = (stage: StageId, value: number, label: string): Modifier => ({ stage, value, label });

/** value が candidates のどれかと同じか */
export const isOneOf = (value: string | null, ...candidates: string[]): boolean =>
  value !== null && candidates.includes(value);
