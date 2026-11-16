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

/** 状態異常。やけど / まひ / どく / もうどく / ねむり / こおり */
export type StatusId = 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz';

export const STATUS_LABELS: Record<StatusId, string> = {
  brn: 'やけど',
  par: 'まひ',
  psn: 'どく',
  tox: 'もうどく',
  slp: 'ねむり',
  frz: 'こおり',
};

/** 天気 */
export type WeatherId = 'sun' | 'rain' | 'sand' | 'snow';
export const WEATHER_LABELS: Record<WeatherId, string> = { sun: 'はれ', rain: 'あめ', sand: 'すなあらし', snow: 'ゆき' };

/** フィールド */
export type TerrainId = 'electric' | 'grassy' | 'misty' | 'psychic';
export const TERRAIN_LABELS: Record<TerrainId, string> = {
  electric: 'エレキフィールド',
  grassy: 'グラスフィールド',
  misty: 'ミストフィールド',
  psychic: 'サイコフィールド',
};

/** 戦っているポケモン1体(攻撃側、または防御側) */
export interface Combatant {
  /** 個体(持ち物などを見るために使う) */
  individual: Individual;
  /** いま発動しているギミック。何も発動していなければ null */
  activeGimmick: GimmickId | null;
  /** 戦闘中の姿(種族値・タイプ・特性・実数値)。ギミックによる変化を反映したもの */
  battler: Battler;
  ranks: Ranks;
  /** 状態異常。なければ null */
  status: StatusId | null;
  /** いまのHP(1〜最大HP) */
  currentHp: number;
}

/** 場の状態と、技の当たり方 */
export interface DamageConditions {
  /** 急所に当たったか */
  isCritical: boolean;
  /** ダブルバトルか(壁の効き方が変わる) */
  isDoubles: boolean;
  /** ダブルバトルで、複数の相手に当たる技として使ったか(ダメージ 0.75 倍) */
  isSpread: boolean;
  weather: WeatherId | null;
  terrain: TerrainId | null;
  /** 防御側の場の壁 */
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
  /** 攻撃側が「てだすけ」を受けているか */
  helpingHand: boolean;
  /** 連続技の何回目か(1から)。回数で威力が変わる技(トリプルアクセル)に使う */
  hit: number;
}

export const DEFAULT_CONDITIONS: DamageConditions = {
  isCritical: false,
  isDoubles: false,
  isSpread: false,
  weather: null,
  terrain: null,
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
  helpingHand: false,
  hit: 1,
};

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
  options: { ranks?: Partial<Ranks>; status?: StatusId | null; currentHp?: number } = {},
): Combatant {
  const battler = buildBattler(individual, activeGimmick, data);
  const maxHp = battler.stats.hp;
  return {
    individual,
    activeGimmick,
    battler,
    ranks: { ...NO_RANKS, ...options.ranks },
    status: options.status ?? null,
    currentHp: Math.max(1, Math.min(maxHp, Math.trunc(options.currentHp ?? maxHp))),
  };
}
