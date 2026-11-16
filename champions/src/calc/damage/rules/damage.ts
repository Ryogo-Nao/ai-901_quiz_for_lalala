// ダメージそのものに掛かる補正(範囲・天気・急所・タイプ一致・やけど・最終補正)。
// 手本: @smogon/calc 0.12.0 の calculateBaseDamageChampions / getStabMod / calculateFinalModsChampions。

import { WEATHER_LABELS } from '../context.ts';
import type { Situation } from '../situation.ts';
import { isOneOf, mod, type ModifierRule } from './types.ts';

const abilityName = (s: Situation, id: string) => s.data.abilities.get(id)?.name ?? id;
const itemName = (s: Situation, id: string) => s.data.items.get(id)?.name ?? id;

/** 半減のきのみ → 半減する技のタイプ */
export const RESIST_BERRIES: Record<string, string> = {
  chilanberry: 'normal', occaberry: 'fire', passhoberry: 'water', wacanberry: 'electric', rindoberry: 'grass',
  yacheberry: 'ice', chopleberry: 'fighting', kebiaberry: 'poison', shucaberry: 'ground', cobaberry: 'flying',
  payapaberry: 'psychic', tangaberry: 'bug', chartiberry: 'rock', kasibberry: 'ghost', habanberry: 'dragon',
  colburberry: 'dark', babiriberry: 'steel', roseliberry: 'fairy',
};

/** 範囲技: ダブルバトルで複数の相手に当たるとき 0.75 倍 */
const spreadRule: ModifierRule = (s) => (s.conditions.isSpread ? [mod('spread', 3072, '範囲技')] : []);

/** 天気: はれ で ほのお 1.5 倍・みず 0.5 倍、あめ で みず 1.5 倍・ほのお 0.5 倍 */
const weatherRule: ModifierRule = (s) => {
  const { type } = s.move;
  const megaSol = s.attackerAbility === 'megasol'; // メガソーラー: 自分の技だけ、いつも はれ として扱う
  const sunny = s.weather === 'sun' || megaSol;
  const rainy = s.weather === 'rain' && !megaSol;
  const label = megaSol ? abilityName(s, 'megasol') : s.weather ? WEATHER_LABELS[s.weather] : '';
  if ((sunny && type === 'fire') || (rainy && type === 'water')) return [mod('weather', 6144, label)];
  if ((sunny && type === 'water') || (s.weather === 'rain' && type === 'fire')) return [mod('weather', 2048, label)];
  return [];
};

/** 急所: 1.5 倍 */
const criticalRule: ModifierRule = (s) => (s.isCritical ? [mod('critical', 6144, '急所')] : []);

/** タイプ一致。「4096 に足す量」を返す(1.5倍なら 2048) */
const stabRule: ModifierRule = (s) => {
  const { type } = s.move;
  const a = s.attackerAbility;
  const result = [];
  if (s.attacker.battler.form.stabTypes.includes(type)) result.push(mod('stab', 2048, 'タイプ一致'));
  // へんげんじざい・リベロ: 技を使う前に、自分のタイプが技のタイプに変わる
  else if (isOneOf(a, 'protean', 'libero')) result.push(mod('stab', 2048, abilityName(s, a)));
  // てきおうりょく: タイプ一致が 2 倍になる
  if (a === 'adaptability' && s.attacker.battler.form.types.includes(type)) result.push(mod('stab', 2048, abilityName(s, a)));
  return result;
};

/** やけど: 物理技のダメージが半分。「こんじょう」と「からげんき」は例外 */
const burnRule: ModifierRule = (s) =>
  s.attacker.status === 'brn' && s.move.category === 'physical' && s.attackerAbility !== 'guts' && s.move.id !== 'facade'
    ? [mod('burn', 2048, 'やけど')]
    : [];

/** 壁。急所には効かない。ダブルバトルでは効き目が弱い(約 0.667 倍) */
const screenRule: ModifierRule = (s) => {
  const { conditions, move } = s;
  if (s.isCritical) return [];
  // 「すりぬけ」は壁を無視する。「かわらわり」などは壁を壊してから攻撃する
  if (s.attackerAbility === 'infiltrator' || isOneOf(move.id, 'brickbreak', 'psychicfangs', 'ragingbull')) return [];
  const value = conditions.isDoubles ? 2732 : 2048;
  if (conditions.auroraVeil) return [mod('final', value, 'オーロラベール')];
  if (conditions.reflect && move.category === 'physical') return [mod('final', value, 'リフレクター')];
  if (conditions.lightScreen && move.category === 'special') return [mod('final', value, 'ひかりのかべ')];
  return [];
};

/** 特性(最終補正) */
const finalAbilityRule: ModifierRule = (s) => {
  const { move, defender } = s;
  const a = s.attackerAbility;
  const d = s.defenderAbility;
  const result = [];
  if (a === 'sniper' && s.isCritical) result.push(mod('final', 6144, abilityName(s, a)));
  // マルチスケイル: HP が満タンのとき、受けるダメージが半分(連続技は1回目だけ)
  if (d === 'multiscale' && defender.currentHp === defender.battler.stats.hp && s.conditions.hit === 1) {
    result.push(mod('final', 2048, `相手の${abilityName(s, d)}`));
  }
  if (isOneOf(d, 'fluffy', 'auraguard') && move.flags.includes('contact') && a !== 'longreach') {
    result.push(mod('final', 2048, `相手の${abilityName(s, d)}`));
  } else if (d === 'punkrock' && move.flags.includes('sound')) {
    result.push(mod('final', 2048, `相手の${abilityName(s, d)}`));
  }
  if (isOneOf(d, 'solidrock', 'filter') && s.effectiveness > 1) result.push(mod('final', 3072, `相手の${abilityName(s, d)}`));
  if (d === 'fluffy' && move.type === 'fire') result.push(mod('final', 8192, `相手の${abilityName(s, d)}`));
  return result;
};

/** 持ち物(最終補正) */
const finalItemRule: ModifierRule = (s) => {
  const result = [];
  if (s.attackerItem === 'expertbelt' && s.effectiveness > 1) result.push(mod('final', 4915, itemName(s, 'expertbelt')));
  else if (s.attackerItem === 'lifeorb') result.push(mod('final', 5324, itemName(s, 'lifeorb')));

  // 半減のきのみ: ばつぐん の技(ノーマル技はいつでも)を1回だけ半減する。「きんちょうかん」の相手には使えない
  const berry = s.defenderItem;
  if (
    berry &&
    RESIST_BERRIES[berry] === s.move.type &&
    (s.effectiveness > 1 || s.move.type === 'normal') &&
    s.conditions.hit === 1 &&
    s.attackerAbility !== 'unnerve'
  ) {
    result.push(mod('final', s.defenderAbility === 'ripen' ? 1024 : 2048, `相手の${itemName(s, berry)}`));
  }
  return result;
};

export const DAMAGE_RULES: readonly ModifierRule[] = [
  spreadRule,
  weatherRule,
  criticalRule,
  stabRule,
  burnRule,
  screenRule,
  finalAbilityRule,
  finalItemRule,
];
