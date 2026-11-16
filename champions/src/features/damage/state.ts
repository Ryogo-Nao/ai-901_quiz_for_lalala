// ダメージ計算画面が持つ「一時データ」の形。
//
// ここにある個体は、保存した個体の「写し」。この画面でいくら変えても、保存データは変わらない。
// (保存の関数を呼ばないかぎり、IndexedDB は書き換わらない)

import { DEFAULT_CONDITIONS, NO_RANKS, type DamageConditions, type Ranks, type StatusId } from '../../calc/damage/context.ts';
import { NO_HAZARDS, type Hazards } from '../../calc/hazards.ts';
import type { MasterData } from '../../data/index.ts';
import { createIndividual, type Individual } from '../../domain/individual.ts';

/** 攻撃側または防御側の1体 */
export interface SideState {
  /** 個体(保存した個体の写し、またはこの画面で作ったもの) */
  individual: Individual;
  /** どの保存個体から呼び出したか。この画面で作ったものは null */
  sourceId: string | null;
  /** ギミック(メガシンカなど)を発動した姿で計算するか */
  gimmickOn: boolean;
  ranks: Ranks;
  status: StatusId | null;
  /** いまのHP(最大HPに対する%) */
  hpPercent: number;
  /**
   * 手で変えたタイプ。変えていなければ null(ポケモンの元のタイプを使う)。
   * 特性(へんげんじざい など)や技(みずびたし など)でタイプが変わった場面を計算するために使う
   */
  typeOverride: string[] | null;
}

/** 画面全体の一時データ */
export interface DamageState {
  attacker: SideState;
  defender: SideState;
  /** 選んでいる技の ID */
  moveId: string | null;
  conditions: DamageConditions;
  /** ダブルバトルで、範囲技を「複数に当たる」として計算するか */
  spreadEnabled: boolean;
  /** 連続技の回数(2〜5回の技で使う) */
  multiHitCount: number;
  /** 防御側の場にまかれているもの(ステルスロック、まきびし) */
  hazards: Hazards;
}

/** 個体から、1体ぶんの一時データを作る */
export function makeSide(individual: Individual, sourceId: string | null): SideState {
  return {
    // structuredClone で丸ごと写す。写しを変えても、元の個体は変わらない
    individual: structuredClone(individual),
    sourceId,
    gimmickOn: false,
    ranks: { ...NO_RANKS },
    status: null,
    hpPercent: 100,
    typeOverride: null,
  };
}

/** 画面を最初に開いたときの状態 */
export function createInitialDamageState(data: MasterData): DamageState {
  // 最初に出しておくポケモン。データにあれば ガブリアス と カバルドン、無ければ先頭の2体
  const all = [...data.pokemon.values()];
  const attacker = data.pokemon.get('garchomp') ?? all[0];
  const defender = data.pokemon.get('hippowdon') ?? all[1] ?? all[0];
  return {
    attacker: makeSide(createIndividual(attacker.id, attacker.abilities[0]), null),
    defender: makeSide(createIndividual(defender.id, defender.abilities[0]), null),
    moveId: null,
    conditions: { ...DEFAULT_CONDITIONS },
    spreadEnabled: true,
    multiHitCount: 2,
    hazards: { ...NO_HAZARDS },
  };
}
