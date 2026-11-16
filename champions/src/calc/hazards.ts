// 場に出たときに受けるダメージ(ステルスロック、まきびし)の計算。
//
// 採用している決まり(第9世代の本編。手本: Pokémon Showdown の data/moves.ts)
//   ステルスロック: 最大HP × (いわタイプの技の相性) ÷ 8
//                   等倍 1/8、ばつぐん 1/4、4倍 1/2、いまひとつ 1/16、4分の1 1/32
//   まきびし      : 1回まいて 最大HP の 1/8、2回で 1/6、3回で 1/4。地面にいるポケモンだけが受ける
//   どちらも小数点以下は切り捨て、最低 1 ダメージ。特性「マジックガード」は受けない。

import type { TypeChart } from './typeChart.ts';
import { typeEffectiveness } from './typeChart.ts';

/** 場にまかれているもの */
export interface Hazards {
  stealthRock: boolean;
  /** まきびしをまいた回数(0〜3) */
  spikes: number;
}

export const NO_HAZARDS: Hazards = { stealthRock: false, spikes: 0 };

/** 場に出るポケモンについて、計算に必要なもの */
export interface HazardTarget {
  maxHp: number;
  types: readonly string[];
  abilityId: string;
  itemId: string | null;
}

export interface HazardDamage {
  stealthRock: number;
  spikes: number;
  total: number;
}

/** まきびしの回数ごとの、最大HPに対する割合(24分のいくつか)。1回 3/24 = 1/8、2回 4/24 = 1/6、3回 6/24 = 1/4 */
const SPIKES_PER_24 = [0, 3, 4, 6];

/** 地面にいるか。ひこうタイプ・ふゆう・ふうせん は浮いている。くろいてっきゅう を持つと必ず地面 */
function isGrounded(target: HazardTarget, item: string | null): boolean {
  if (item === 'ironball') return true;
  return !target.types.includes('flying') && target.abilityId !== 'levitate' && target.abilityId !== 'eelevate' && item !== 'airballoon';
}

/** 場に出たときに受けるダメージを求める */
export function calcHazardDamage(target: HazardTarget, hazards: Hazards, chart: TypeChart): HazardDamage {
  if (target.abilityId === 'magicguard') return { stealthRock: 0, spikes: 0, total: 0 };
  const item = target.abilityId === 'klutz' ? null : target.itemId; // ぶきよう は持ち物の効果が無い

  const stealthRock = hazards.stealthRock
    ? Math.max(1, Math.floor((target.maxHp * typeEffectiveness(chart, 'rock', target.types)) / 8))
    : 0;

  const layers = Math.max(0, Math.min(3, Math.trunc(hazards.spikes)));
  const spikes = layers > 0 && isGrounded(target, item) ? Math.max(1, Math.floor((target.maxHp * SPIKES_PER_24[layers]) / 24)) : 0;

  return { stealthRock, spikes, total: stealthRock + spikes };
}
