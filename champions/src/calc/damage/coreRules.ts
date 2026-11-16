// どんな対戦でも必ず関わる、基本の補正ルール。
//
// ルール = 「入力を見て、Modifier(補正)の一覧を返す関数」。
// 特性・持ち物・天気などのルールは、次のステップで rules/ フォルダに足していく。

import type { DamageContext } from './context.ts';
import type { Modifier } from './modifier.ts';

/** ルールの形 */
export type ModifierRule = (context: DamageContext) => Modifier[];

/** タイプ一致: 技のタイプが、攻撃側のタイプに含まれていれば 1.5 倍(4096 + 2048 = 6144) */
export const stabRule: ModifierRule = ({ attacker, move }) =>
  attacker.battler.form.stabTypes.includes(move.type) ? [{ stage: 'stab', value: 2048, label: 'タイプ一致' }] : [];

/** 急所: 1.5 倍 */
export const criticalRule: ModifierRule = ({ conditions }) =>
  conditions.isCritical ? [{ stage: 'critical', value: 6144, label: '急所' }] : [];

/**
 * やけど: 物理技のダメージが 0.5 倍。
 * (「こんじょう」「からげんき」のような例外は、特性と技のルールを作るときに扱う)
 */
export const burnRule: ModifierRule = ({ attacker, move }) =>
  attacker.isBurned && move.category === 'physical' ? [{ stage: 'burn', value: 2048, label: 'やけど' }] : [];

/** 範囲技: ダブルバトルで複数の相手に当たるとき 0.75 倍 */
export const spreadRule: ModifierRule = ({ conditions }) =>
  conditions.isSpread ? [{ stage: 'spread', value: 3072, label: '範囲技' }] : [];

/** 基本のルールの一覧 */
export const CORE_RULES: readonly ModifierRule[] = [stabRule, criticalRule, burnRule, spreadRule];
