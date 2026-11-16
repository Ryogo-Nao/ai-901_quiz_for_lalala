// ダメージ計算の本体。集めた補正を、決まった順番で1段階ずつ適用する。
//
// 採用している式: 第9世代(スカーレット・バイオレット)本編のダメージ計算式。
// 手本にした実装: @smogon/calc 0.12.0 の src/mechanics/util.ts
//   (getBaseDamage / getFinalDamage)と src/mechanics/gen789.ts。
//
//   1 威力   = 技の威力 × 威力補正                          [五捨五超入、最低1]
//   2 攻撃   = 実数値 × ランク補正 [切り捨て] × 攻撃補正     [五捨五超入、最低1]
//              (急所のとき、攻撃側の下がったランクは無視する)
//   3 防御   = 実数値 × ランク補正 [切り捨て] × 防御補正     [五捨五超入、最低1]
//              (急所のとき、防御側の上がったランクは無視する)
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
import type { GimmickId } from '../../domain/individual.ts';
import { LEVEL } from '../../domain/limits.ts';
import { gimmickRegistry } from '../../gimmicks/registry.ts';
import { MOD_BASE, applyMod, chainMods } from '../rounding.ts';
import type { Combatant, DamageContext } from './context.ts';
import { calcKo, type KoResult } from './ko.ts';
import { STAGES, modifiersOf, type Modifier, type StageId } from './modifier.ts';
import { ALL_RULES, type ModifierRule } from './rules/index.ts';
import { resolveSituation, type StopReason } from './situation.ts';

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
  /** ダメージを与えない(計算しない)理由と説明。ダメージを与える技なら null */
  stop: StopReason | null;
  /** 利用者に伝えたい注意(「条件つきで威力が上がる技です」など) */
  notes: string[];
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
 * @param input 攻撃側・防御側・技・場の状態
 * @param rules 補正のルール。省略すると、このアプリが持っているすべてのルール
 */
export function calcDamage(input: DamageContext, rules: readonly ModifierRule[] = ALL_RULES): DamageResult {
  // A. 技を確定する(ギミックが技を変えることがある)
  const context: DamageContext = { ...input, move: resolveMove(input) };

  // B. 状況を整理する(効いている特性・持ち物、技のタイプ、使う能力値、相性、威力)
  const situation = resolveSituation(context);
  const { move, defender, effectiveness } = situation;
  const defenderMaxHp = defender.battler.stats.hp;

  /** 16通りすべてが同じダメージの結果を作る(ダメージなし、決まったダメージ) */
  const flat = (damage: number, modifiers: Modifier[] = []): DamageResult => ({
    rolls: RANDOM_FACTORS.map(() => damage),
    min: damage,
    max: damage,
    minPercent: (damage / defenderMaxHp) * 100,
    maxPercent: (damage / defenderMaxHp) * 100,
    effectiveness,
    ko: calcKo(RANDOM_FACTORS.map(() => damage), defender.currentHp),
    stop: situation.stop,
    notes: situation.notes,
    detail: { move, power: 0, attack: 0, defense: 0, baseDamage: 0, modifiers },
  });

  if (situation.stop) return flat(0);
  if (situation.fixedDamage !== null) return flat(situation.fixedDamage);

  // C. 補正を集める
  const modifiers = [...rules.flatMap((rule) => rule(situation)), ...gimmickModifiers(situation)];

  // D. 段階の順番どおりに適用する
  // 1 威力
  const power = Math.max(1, applyStage(situation.basePower, modifiers, 'power'));
  // 2 攻撃(ランク補正は、状況の整理の中で掛けてある)
  const attack = Math.max(1, applyStage(applyStage(situation.attackStat, modifiers, 'attackStat'), modifiers, 'attack'));
  // 3 防御
  const defense = Math.max(1, applyStage(applyStage(situation.defenseStat, modifiers, 'defenseStat'), modifiers, 'defense'));

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
    ko: calcKo(rolls, defender.currentHp),
    stop: null,
    notes: situation.notes,
    detail: { move, power, attack, defense, baseDamage, modifiers },
  };
}
