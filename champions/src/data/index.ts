// マスターデータ(種族値・技・特性・持ち物など)の「形」の定義と、読み込み。
//
// このフォルダの JSON は `npm run data:build` が公開データから作る(sources.json に出典)。
// regulations.json だけは手で書く。

import type { GimmickId } from '../domain/individual.ts';
import type { StatKey, StatTable } from '../domain/stats.ts';
import abilitiesJson from './abilities.json';
import itemsJson from './items.json';
import movesJson from './moves.json';
import naturesJson from './natures.json';
import pokemonJson from './pokemon.json';
import regulationsJson from './regulations.json';
import typesJson from './types.json';

// ---------------------------------------------------------------------------
// データの形
// ---------------------------------------------------------------------------

/** メガシンカ後の姿 */
export interface MegaFormData {
  id: string;
  name: string;
  nameEn: string;
  /** メガシンカに必要な持ち物(メガストーン)の ID */
  requiredItem: string;
  types: string[];
  baseStats: StatTable;
  /** メガシンカ後の特性の ID */
  ability: string;
  weightKg: number;
}

/** ポケモン */
export interface PokemonData {
  id: string;
  name: string;
  nameEn: string;
  types: string[];
  baseStats: StatTable;
  /** このポケモンが持てる特性の ID */
  abilities: string[];
  weightKg: number;
  /** このポケモンが覚える技の ID */
  learnset: string[];
  /** メガシンカ後の姿。メガシンカできないポケモンは空の配列 */
  megaForms: MegaFormData[];
}

export type MoveCategory = 'physical' | 'special' | 'status';

/** 技 */
export interface MoveData {
  id: string;
  name: string;
  nameEn: string;
  type: string;
  /** 分類: 物理 / 特殊 / 変化 */
  category: MoveCategory;
  /** 威力。変化技や、威力が状況で決まる技は 0 */
  power: number;
  /** 命中率。必ず当たる技は null */
  accuracy: number | null;
  priority: number;
  /** 技の対象(取得元の表記のまま。"allAdjacentFoes" は相手全体、など) */
  target: string;
  /** 技の性質(取得元の表記のまま。"contact" は接触技、など) */
  flags: string[];
  /** 連続技の回数。[2, 5] は2〜5回 */
  multihit?: number | number[];
  /** 威力が状況で変わる技の目印 */
  variablePower?: boolean;
}

/** 特性 */
export interface AbilityData {
  id: string;
  name: string;
  nameEn: string;
}

/** 持ち物 */
export interface ItemData {
  id: string;
  name: string;
  nameEn: string;
  /** メガストーンの目印 */
  isMegaStone?: boolean;
}

/** 性格 */
export interface NatureData {
  id: string;
  name: string;
  nameEn: string;
  /** 上がる能力。補正なしの性格は null */
  up: StatKey | null;
  /** 下がる能力。補正なしの性格は null */
  down: StatKey | null;
}

/** タイプ */
export interface TypeData {
  id: string;
  name: string;
  nameEn: string;
}

/** レギュレーション(対戦ルール)。使えるギミックをここで切り替える */
export interface RegulationData {
  id: string;
  name: string;
  /** このレギュレーションで使えるギミック */
  gimmicks: GimmickId[];
}

/**
 * マスターデータ一式。
 *
 * 計算の関数には、これを「引数」として渡す。
 * 計算の関数が JSON を直接読みに行かないようにしておくと、
 * テストのときに小さな偽物のデータを渡して確かめられる。
 */
export interface MasterData {
  /** ID → データ の対応表。Map は「見出しで引ける表」 */
  pokemon: ReadonlyMap<string, PokemonData>;
  moves: ReadonlyMap<string, MoveData>;
  abilities: ReadonlyMap<string, AbilityData>;
  items: ReadonlyMap<string, ItemData>;
  natures: ReadonlyMap<string, NatureData>;
  types: ReadonlyMap<string, TypeData>;
  /** タイプ相性。typeEffectiveness[技のタイプ][受ける側のタイプ] = 倍率 */
  typeEffectiveness: Record<string, Record<string, number>>;
  regulations: readonly RegulationData[];
}

// ---------------------------------------------------------------------------
// 読み込み
// ---------------------------------------------------------------------------

/** 配列を「ID → データ」の対応表にする */
function indexById<T extends { id: string }>(list: readonly T[]): ReadonlyMap<string, T> {
  return new Map(list.map((entry) => [entry.id, entry]));
}

// `as 型` は「この JSON はこの形です」と TypeScript に伝える書き方。
// 本当にその形かどうかは data/masterData.test.ts のテストで確かめている。
export const masterData: MasterData = {
  pokemon: indexById(pokemonJson as PokemonData[]),
  moves: indexById(movesJson as MoveData[]),
  abilities: indexById(abilitiesJson as AbilityData[]),
  items: indexById(itemsJson as ItemData[]),
  natures: indexById(naturesJson as NatureData[]),
  types: indexById(typesJson.types as TypeData[]),
  typeEffectiveness: typesJson.effectiveness,
  regulations: regulationsJson as RegulationData[],
};
