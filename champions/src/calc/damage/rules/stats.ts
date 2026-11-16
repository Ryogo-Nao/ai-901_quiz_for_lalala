// 「攻撃」と「防御」の能力値に掛かる補正。
// 手本: @smogon/calc 0.12.0 の calculateAtModsChampions / calculateDefenseChampions / calculateDfModsChampions。

import { WEATHER_LABELS } from '../context.ts';
import type { Situation } from '../situation.ts';
import { isOneOf, mod, type ModifierRule } from './types.ts';

const abilityName = (s: Situation, id: string) => s.data.abilities.get(id)?.name ?? id;

/** はりきり: 物理技の こうげき が 1.5 倍(ほかの補正より先に掛かる) */
const hustleRule: ModifierRule = (s) =>
  s.attackerAbility === 'hustle' && s.move.category === 'physical' ? [mod('attackStat', 6144, abilityName(s, 'hustle'))] : [];

/** 攻撃側の特性 */
const attackAbilityRule: ModifierRule = (s) => {
  const { move, attacker } = s;
  const a = s.attackerAbility;
  const special = move.category === 'special';
  const physical = move.category === 'physical';
  const inPinch = attacker.currentHp <= attacker.battler.stats.hp / 3; // HP が 1/3 以下

  if (a === 'solarpower' && s.weather === 'sun' && special) return [mod('attack', 6144, abilityName(s, a))];
  if (
    (a === 'guts' && attacker.status !== null && physical) ||
    (inPinch &&
      ((a === 'overgrow' && move.type === 'grass') ||
        (a === 'blaze' && move.type === 'fire') ||
        (a === 'torrent' && move.type === 'water') ||
        (a === 'swarm' && move.type === 'bug')))
  ) {
    return [mod('attack', 6144, abilityName(s, a))];
  }
  if (a === 'firemane' && move.type === 'fire') return [mod('attack', 6144, abilityName(s, a))];
  if ((a === 'waterbubble' && move.type === 'water') || (isOneOf(a, 'hugepower', 'purepower') && physical)) {
    return [mod('attack', 8192, abilityName(s, a))];
  }
  return [];
};

/** 防御側の特性で、相手の攻撃を下げるもの */
const defenderAbilityOnAttackRule: ModifierRule = (s) => {
  const { move } = s;
  const d = s.defenderAbility;
  const result = [];
  if (
    (d === 'thickfat' && isOneOf(move.type, 'fire', 'ice')) ||
    (d === 'waterbubble' && move.type === 'fire') ||
    (d === 'purifyingsalt' && move.type === 'ghost')
  ) {
    result.push(mod('attack', 2048, `相手の${abilityName(s, d)}`));
  }
  if (d === 'heatproof' && move.type === 'fire') result.push(mod('attack', 2048, `相手の${abilityName(s, d)}`));
  return result;
};

/** でんきだま: ピカチュウが持つと こうげき・とくこう が2倍 */
const lightBallRule: ModifierRule = (s) =>
  s.attackerItem === 'lightball' && s.attacker.individual.speciesId.startsWith('pikachu')
    ? [mod('attack', 8192, s.data.items.get('lightball')?.name ?? 'でんきだま')]
    : [];

/** 天気による防御の上昇: すなあらし で いわタイプの とくぼう、ゆき で こおりタイプの ぼうぎょ が 1.5 倍 */
const weatherDefenseRule: ModifierRule = (s) => {
  if (s.attackerAbility === 'megasol') return [];
  const types = s.defender.battler.form.types;
  if (s.weather === 'sand' && types.includes('rock') && !s.hitsPhysical) {
    return [mod('defenseStat', 6144, `${WEATHER_LABELS.sand}(いわタイプの とくぼう)`)];
  }
  if (s.weather === 'snow' && types.includes('ice') && s.hitsPhysical) {
    return [mod('defenseStat', 6144, `${WEATHER_LABELS.snow}(こおりタイプの ぼうぎょ)`)];
  }
  return [];
};

/** 防御側の特性 */
const defenseAbilityRule: ModifierRule = (s) => {
  const d = s.defenderAbility;
  if (d === 'marvelscale' && s.defender.status !== null && s.hitsPhysical) return [mod('defense', 6144, abilityName(s, d))];
  if (d === 'grasspelt' && s.conditions.terrain === 'grassy' && s.hitsPhysical) return [mod('defense', 6144, abilityName(s, d))];
  if (d === 'furcoat' && s.hitsPhysical) return [mod('defense', 8192, abilityName(s, d))];
  return [];
};

export const STAT_RULES: readonly ModifierRule[] = [
  hustleRule,
  attackAbilityRule,
  defenderAbilityOnAttackRule,
  lightBallRule,
  weatherDefenseRule,
  defenseAbilityRule,
];
