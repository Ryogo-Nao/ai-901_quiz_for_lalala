// ダメージ計算に渡す入力の形。

import type { MasterData, MoveData } from '../../data/index.ts';
import type { GimmickId, Individual } from '../../domain/individual.ts';
import { buildBattler, type Battler } from '../battler.ts';

/** ランク補正(-6〜+6)。HP にはランクが無い */
export interface Ranks {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export const NO_RANKS: Ranks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** 戦っているポケモン1体(攻撃側、または防御側) */
export interface Combatant {
  /** 個体(持ち物などを見るために使う) */
  individual: Individual;
  /** いま発動しているギミック。何も発動していなければ null */
  activeGimmick: GimmickId | null;
  /** 戦闘中の姿(種族値・タイプ・特性・実数値)。ギミックによる変化を反映したもの */
  battler: Battler;
  ranks: Ranks;
  /** やけど状態か */
  isBurned: boolean;
}

/** 技の当たり方などの条件 */
export interface DamageConditions {
  /** 急所に当たったか */
  isCritical: boolean;
  /** ダブルバトルで、複数の相手に当たる技として使ったか(ダメージ 0.75 倍) */
  isSpread: boolean;
}

export const DEFAULT_CONDITIONS: DamageConditions = { isCritical: false, isSpread: false };

/** ダメージ計算1回ぶんの入力 */
export interface DamageContext {
  attacker: Combatant;
  defender: Combatant;
  move: MoveData;
  conditions: DamageConditions;
  data: MasterData;
}

/** 個体から、戦っているポケモンを作る */
export function makeCombatant(
  individual: Individual,
  activeGimmick: GimmickId | null,
  data: MasterData,
  options: { ranks?: Partial<Ranks>; isBurned?: boolean } = {},
): Combatant {
  return {
    individual,
    activeGimmick,
    battler: buildBattler(individual, activeGimmick, data),
    ranks: { ...NO_RANKS, ...options.ranks },
    isBurned: options.isBurned ?? false,
  };
}
