// 技の「威力」に掛かる補正。
// 手本: @smogon/calc 0.12.0 の calculateBPModsChampions。並べる順番も手本に合わせてある
// (補正を1つにまとめるときの丸めが、順番で変わることがあるため)。

import { TERRAIN_LABELS } from '../context.ts';
import type { Situation } from '../situation.ts';
import { isOneOf, mod, type ModifierRule } from './types.ts';

/** 持ち物 → その持ち物が強化する技のタイプ(1.2倍) */
export const TYPE_BOOST_ITEMS: Record<string, string> = {
  silkscarf: 'normal', blackbelt: 'fighting', sharpbeak: 'flying', poisonbarb: 'poison', softsand: 'ground',
  hardstone: 'rock', silverpowder: 'bug', spelltag: 'ghost', metalcoat: 'steel', charcoal: 'fire',
  mysticwater: 'water', miracleseed: 'grass', magnet: 'electric', twistedspoon: 'psychic', nevermeltice: 'ice',
  dragonfang: 'dragon', blackglasses: 'dark', fairyfeather: 'fairy',
};

const abilityName = (s: Situation, id: string) => s.data.abilities.get(id)?.name ?? id;
const itemName = (s: Situation, id: string) => s.data.items.get(id)?.name ?? id;

/** 「はたきおとす」の威力が上がらない相手か(持ち物が無い、または自分用のメガストーン) */
function resistsKnockOff(s: Situation): boolean {
  const item = s.defenderHeldItem;
  if (!item) return true;
  const species = s.data.pokemon.get(s.defender.individual.speciesId);
  return species?.megaForms.some((form) => form.requiredItem === item) ?? false;
}

/** 技そのものが持つ、条件つきの威力の変化 */
const moveEffectRule: ModifierRule = (s) => {
  const { move, attacker, defender, conditions } = s;
  const statused = (status: string | null) => isOneOf(status, 'brn', 'par', 'psn', 'tox');
  if (move.id === 'facade' && statused(attacker.status)) return [mod('power', 8192, 'からげんき(状態異常)')];
  if (move.id === 'venoshock' && isOneOf(defender.status, 'psn', 'tox')) return [mod('power', 8192, 'ベノムショック(相手がどく)')];
  if (move.id === 'expandingforce' && s.attackerGrounded && conditions.terrain === 'psychic') {
    return [mod('power', 6144, 'ワイドフォース(サイコフィールド)')];
  }
  if (move.id === 'knockoff' && !resistsKnockOff(s)) return [mod('power', 6144, 'はたきおとす(相手が持ち物あり)')];
  if (move.id === 'mistyexplosion' && s.attackerGrounded && conditions.terrain === 'misty') {
    return [mod('power', 6144, 'ミストバースト(ミストフィールド)')];
  }
  if (isOneOf(move.id, 'solarbeam', 'solarblade') && isOneOf(s.weather, 'rain', 'sand', 'snow') && s.attackerAbility !== 'megasol') {
    return [mod('power', 2048, 'ソーラービーム(天気で半減)')];
  }
  return [];
};

const helpingHandRule: ModifierRule = (s) => (s.conditions.helpingHand ? [mod('power', 6144, 'てだすけ')] : []);

/** フィールド。地面にいるポケモンだけが効果を受ける */
const terrainRule: ModifierRule = (s) => {
  const { move, conditions } = s;
  const { terrain } = conditions;
  if (!terrain) return [];
  const result = [];
  const boosted = { electric: 'electric', grassy: 'grass', psychic: 'psychic' } as Record<string, string>;
  if (s.attackerGrounded && boosted[terrain] === move.type) result.push(mod('power', 5325, TERRAIN_LABELS[terrain]));
  if (s.defenderGrounded) {
    if (terrain === 'misty' && move.type === 'dragon') result.push(mod('power', 2048, 'ミストフィールド(ドラゴン半減)'));
    if (terrain === 'grassy' && isOneOf(move.id, 'bulldoze', 'earthquake')) {
      result.push(mod('power', 2048, 'グラスフィールド(じしん・じならし半減)'));
    }
  }
  return result;
};

/** 特性 */
const abilityRule: ModifierRule = (s) => {
  const { move } = s;
  const a = s.attackerAbility;
  const d = s.defenderAbility;
  const flag = (name: string) => move.flags.includes(name);
  const result = [];

  if (
    (a === 'technician' && s.basePower <= 60) ||
    (a === 'megalauncher' && flag('pulse')) ||
    (a === 'strongjaw' && flag('bite')) ||
    (a === 'steelyspirit' && move.type === 'steel') ||
    (a === 'sharpness' && flag('slicing'))
  ) {
    result.push(mod('power', 6144, abilityName(s, a)));
  }

  // オーラ: 場にいるどちらかが持っていれば、そのタイプの技が強くなる
  const aura = `${move.type}aura`;
  if (isOneOf(aura, 'fairyaura', 'darkaura') && (a === aura || d === aura)) {
    result.push(mod('power', 5448, abilityName(s, aura)));
  }

  if (
    (a === 'sheerforce' && move.hasSecondary === true) ||
    (a === 'sandforce' && s.weather === 'sand' && isOneOf(move.type, 'rock', 'ground', 'steel')) ||
    (a === 'toughclaws' && flag('contact')) ||
    (a === 'punkrock' && flag('sound'))
  ) {
    result.push(mod('power', 5325, abilityName(s, a)));
  }

  if (s.typeChangedByAbility) result.push(mod('power', 4915, abilityName(s, a))); // スキン系

  if ((a === 'reckless' && move.hasRecoil === true) || (a === 'ironfist' && flag('punch'))) {
    result.push(mod('power', 4915, abilityName(s, a)));
  }

  if (d === 'dryskin' && move.type === 'fire') result.push(mod('power', 5120, `相手の${abilityName(s, d)}`));
  return result;
};

/** 持ち物 */
const itemRule: ModifierRule = (s) => {
  const { move } = s;
  const item = s.attackerItem;
  if (!item) return [];
  if (item === `${move.type}gem`) return [mod('power', 5325, itemName(s, item))]; // ジュエル
  if (TYPE_BOOST_ITEMS[item] === move.type) return [mod('power', 4915, itemName(s, item))];
  if ((item === 'muscleband' && move.category === 'physical') || (item === 'wiseglasses' && move.category === 'special')) {
    return [mod('power', 4505, itemName(s, item))];
  }
  return [];
};

export const POWER_RULES: readonly ModifierRule[] = [moveEffectRule, helpingHandRule, terrainRule, abilityRule, itemRule];
