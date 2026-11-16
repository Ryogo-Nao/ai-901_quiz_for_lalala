// 補正ルールの一覧。
//
// 新しい特性や持ち物の補正を足すときは、power.ts / stats.ts / damage.ts のどれかにルールを足す。
// 計算の本体(pipeline.ts)は変えない。

import { DAMAGE_RULES } from './damage.ts';
import { POWER_RULES } from './power.ts';
import { STAT_RULES } from './stats.ts';
import type { ModifierRule } from './types.ts';

export type { ModifierRule } from './types.ts';

export const ALL_RULES: readonly ModifierRule[] = [...POWER_RULES, ...STAT_RULES, ...DAMAGE_RULES];

/**
 * ダメージに関わるが、このアプリではまだ補正を入れていない特性。
 * 画面で「この特性の補正は入っていません」と知らせるために使う。
 * (前のターンの行動や、味方の数など、画面で指定できない条件で決まるもの)
 */
export const UNSUPPORTED_ABILITY_IDS: ReadonlySet<string> = new Set([
  'supremeoverlord', // そうだいしょう: 倒された味方の数
  'analytic', // アナライズ: 最後に動いたか
  'stakeout', // はりこみ: 相手が交代してきたか
  'rivalry', // とうそうしん: 性別
  'flashfire', // もらいび: ほのお技を受けたあとの強化(無効にする効果は対応済み)
  'plus', 'minus', // プラス・マイナス: 味方の特性
  'parentalbond', // おやこあい: 2回攻撃
  'merciless', // ひとでなし: どく状態の相手に必ず急所
  'steelyspirit', // はがねのせいしん: 味方からの強化(自分の技は対応済み)
  'friendguard', 'battery', 'powerspot', // 味方からの効果
  'neuroforce', 'tintedlens', 'stancechange', 'electromorphosis', 'windpower', 'toxicboost', 'flareboost',
  'slowstart', 'defeatist', 'gorillatactics', 'transistor', 'dragonsmaw', 'rockypayload', 'orichalcumpulse',
  'hadronengine', 'icescales', 'shadowshield', 'prismarmor', 'wonderguard', 'normalize', 'galvanize',
]);
