// ダメージ計算の本体。集めた補正を、決まった順番で1段階ずつ適用する。
//
// 採用している式: 第9世代(スカーレット・バイオレット)本編のダメージ計算式。
// 手本にした実装: @smogon/calc 0.12.0 の src/mechanics/util.ts
//   (getBaseDamage / getFinalDamage)と src/mechanics/gen789.ts。
//
//   1 威力   = 技の威力 × 威力補正                          [五捨五超入、最低1]
//   2 攻撃   = 実数値 × ランク補正 [切り捨て] × 攻撃補正     [五捨五超入、最低1]
//   3 防御   = 実数値 × ランク補正 [切り捨て] × 防御補正     [五捨五超入、最低1]
//   4 基礎ダメージ = floor( floor( floor(2 × レベル ÷ 5 + 2) × 威力 × 攻撃 ÷ 防御 ) ÷ 50 ) + 2
//                    レベル50では floor(2 × 50 ÷ 5 + 2) = 22
//   5 範囲補正   × 0.75                                    [五捨五超入]
//   6 天気補正   × 1.5 または × 0.5                        [五捨五超入]
//   7 急所       × 1.5                                     [五捨五超入]
//   8 乱数       × (85〜100) ÷ 100 の16通り                [切り捨て]
//   9 タイプ一致 × 1.5 など                                [五捨五超入]
//  10 タイプ相性 × 0 / 0.25 / 0.5 / 1 / 2 / 4             [切り捨て]
//  11 やけど     × 0.5                                     [五捨五超入]
//  12 最終補正(壁、いのちのたま など)                       [五捨五超入]
//  13 相性が「こうかなし」でなければ、最低1ダメージ
//
// 補足: 7 と 11 は手本では「切り捨て」と書かれているが、1.5 倍と 0.5 倍では
// 小数部分が 0 か 0.5 にしかならず、五捨五超入と同じ結果になる。

import type { MoveData } from '../../data/index.ts';
import { LEVEL } from '../../domain/limits.ts';
import { gimmickRegistry } from '../../gimmicks/registry.ts';
import type { GimmickId } from '../../domain/individual.ts';
import { MOD_BASE, applyMod, applyRank, chainMods } from '../rounding.ts';
import { typeEffectiveness } from '../typeChart.ts';
import type { Combatant, DamageContext } from './context.ts';
import { CORE_RULES, type ModifierRule } from './coreRules.ts';
import { calcKo, type KoResult } from './ko.ts';
import { isUnsupportedMove } from './unsupportedMoves.ts';
import { STAGES, modifiersOf, type Modifier, type StageId } from './modifier.ts';

/** 乱数の16通り(85, 86, …, 100) */
export const RANDOM_FACTORS = Array.from({ length: 16 }, (_, index) => 85 + index);

/** ダメージ計算の結果 */
export interface DamageResult {
  /** ダメージ16通り(小さい順)。連続技は1回ぶんのダメージ */
  rolls: number[];
  min: number;
  max: number;
  /** 相手の最大HPに対する割合(%)。丸めていない値 */
  minPercent: number;
  maxPercent: number;
  /** タイプ相性の倍率 */
  effectiveness: number;
  /** 確定数。ダメージを与えない技などでは null */
  ko: KoResult | null;
  /** ダメージを与えない理由。ダメージを与える技なら null */
  /**
   * ダメージを与えない(計算しない)理由。ダメージを与える技なら null
   *   status      … 変化技
   *   immune      … タイプ相性が「こうかなし」
   *   unsupported … 特別な決まりを持つ技で、まだ正しく計算できない
   */
  noDamageReason: 'status' | 'immune' | 'unsupported' | null;
  /** 計算の途中の値(検算や、画面での内訳表示に使う) */
  detail: {
    /** 実際に計算に使った技(ギミックで変わったあとのもの) */
    move: MoveData;
    power: number;
    attack: number;
    defense: number;
    baseDamage: number;
    /** 適用された補正の一覧 */
    modifiers: Modifier[];
  };
}

/** 1つの段階の補正を、値に適用する */
function applyStage(value: number, modifiers: readonly Modifier[], stage: StageId): number {
  const mods = modifiersOf(modifiers, stage).map((modifier) => modifier.value);
  const combine = STAGES.find((candidate) => candidate.id === stage)!.combine;
  switch (combine) {
    case 'chain': // 1つにまとめてから掛ける
      return applyMod(value, chainMods(mods));
    case 'each': // 1つずつ掛ける
      return mods.reduce((current, mod) => applyMod(current, mod), value);
    case 'add': // 4096 に足し合わせてから掛ける
      return applyMod(value, mods.reduce((sum, mod) => sum + mod, MOD_BASE));
  }
}

/** ギミックが技を変える場合は、変えたあとの技を返す */
function resolveMove(context: DamageContext): MoveData {
  const { attacker } = context;
  return attacker.activeGimmick ? changeMoveBy(attacker.activeGimmick, attacker, context) : context.move;
}

function changeMoveBy<K extends GimmickId>(id: K, attacker: Combatant, context: DamageContext): MoveData {
  const config = attacker.individual.gimmicks[id];
  const hook = gimmickRegistry[id].changeMove;
  return config && hook ? hook(context.move, config, context) : context.move;
}

/** 発動しているギミックが返す補正 */
function gimmickModifiers(context: DamageContext): Modifier[] {
  const sides = [
    { side: 'attacker', combatant: context.attacker },
    { side: 'defender', combatant: context.defender },
  ] as const;
  return sides.flatMap(({ side, combatant }) =>
    combatant.activeGimmick ? modifiersBy(combatant.activeGimmick, combatant, side, context) : [],
  );
}

function modifiersBy<K extends GimmickId>(
  id: K,
  combatant: Combatant,
  side: 'attacker' | 'defender',
  context: DamageContext,
): Modifier[] {
  const config = combatant.individual.gimmicks[id];
  const hook = gimmickRegistry[id].getModifiers;
  return config && hook ? hook(config, { ...context, side }) : [];
}

/**
 * ダメージを計算する。
 * @param input 攻撃側・防御側・技・条件
 * @param rules 補正のルール。省略すると基本のルール(タイプ一致・急所・やけど・範囲技)
 */
export function calcDamage(input: DamageContext, rules: readonly ModifierRule[] = CORE_RULES): DamageResult {
  // A. 技を確定する(ギミックが技を変えることがある)
  const move = resolveMove(input);
  const context: DamageContext = { ...input, move };
  const { attacker, defender, conditions, data } = context;

  // B. 補正を集める
  const modifiers = [...rules.flatMap((rule) => rule(context)), ...gimmickModifiers(context)];

  const effectiveness = typeEffectiveness(data.typeEffectiveness, move.type, defender.battler.form.types);
  const defenderMaxHp = defender.battler.stats.hp;

  const noDamage = (reason: DamageResult['noDamageReason']): DamageResult => ({
    rolls: RANDOM_FACTORS.map(() => 0),
    min: 0,
    max: 0,
    minPercent: 0,
    maxPercent: 0,
    effectiveness,
    ko: null,
    noDamageReason: reason,
    detail: { move, power: 0, attack: 0, defense: 0, baseDamage: 0, modifiers: [] },
  });

  if (move.category === 'status') return noDamage('status');
  // 特別な決まりを持つ技は、間違った数字を出さないよう、計算せずに「未対応」と知らせる
  if (move.power === 0 || isUnsupportedMove(move)) return noDamage('unsupported');
  if (effectiveness === 0) return noDamage('immune');

  // C. 段階の順番どおりに適用する
  const isPhysical = move.category === 'physical';

  // 1 威力
  const power = Math.max(1, applyStage(move.power, modifiers, 'power'));

  // 2 攻撃。急所のとき、攻撃側の「下がっている」ランクは無視する
  const attackKey = isPhysical ? 'atk' : 'spa';
  const attackRank = conditions.isCritical ? Math.max(0, attacker.ranks[attackKey]) : attacker.ranks[attackKey];
  const attack = Math.max(
    1,
    applyStage(applyRank(attacker.battler.stats[attackKey], attackRank), modifiers, 'attack'),
  );

  // 3 防御。急所のとき、防御側の「上がっている」ランクは無視する
  const defenseKey = isPhysical ? 'def' : 'spd';
  const defenseRank = conditions.isCritical ? Math.min(0, defender.ranks[defenseKey]) : defender.ranks[defenseKey];
  const defense = Math.max(
    1,
    applyStage(applyRank(defender.battler.stats[defenseKey], defenseRank), modifiers, 'defense'),
  );

  // 4 基礎ダメージ
  const levelFactor = Math.floor((2 * LEVEL) / 5 + 2);
  const baseDamage = Math.floor(Math.floor((levelFactor * power * attack) / defense) / 50) + 2;

  // 5〜7 範囲 → 天気 → 急所
  let beforeRandom = baseDamage;
  for (const stage of ['spread', 'weather', 'critical'] as const) {
    beforeRandom = applyStage(beforeRandom, modifiers, stage);
  }

  // 8〜13 乱数の16通りそれぞれについて、残りの段階を適用する
  const rolls = RANDOM_FACTORS.map((factor) => {
    let damage = Math.floor((beforeRandom * factor) / 100); // 8 乱数
    damage = applyStage(damage, modifiers, 'stab'); // 9 タイプ一致
    damage = Math.floor(damage * effectiveness); // 10 タイプ相性
    damage = applyStage(damage, modifiers, 'burn'); // 11 やけど
    damage = applyStage(damage, modifiers, 'final'); // 12 最終補正
    return Math.max(1, damage); // 13 最低1ダメージ
  });

  const min = rolls[0];
  const max = rolls[rolls.length - 1];
  return {
    rolls,
    min,
    max,
    minPercent: (min / defenderMaxHp) * 100,
    maxPercent: (max / defenderMaxHp) * 100,
    effectiveness,
    ko: calcKo(rolls, defenderMaxHp),
    noDamageReason: null,
    detail: { move, power, attack, defense, baseDamage, modifiers },
  };
}
