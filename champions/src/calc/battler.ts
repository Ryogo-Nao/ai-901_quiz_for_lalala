// 保存された個体(設計図)から、「戦闘中の姿」を作る。
//
//   個体
//     │ (1) 種族データを引く
//     ▼
//   元の姿(種族値・タイプ・特性)
//     │ (2) ギミックの changeForm   … メガシンカならここで種族値などが差し替わる
//     ▼
//   変化後の姿
//     │ (3) 能力値の計算            … stats.ts の式。ギミックのことは知らない
//     ▼
//   実数値
//     │ (4) ギミックの changeStats  … (将来) ダイマックスなら HP が2倍になる
//     ▼
//   戦闘中の姿(Battler)
//
// 発動しているギミックが無いとき、(2) と (4) は素通りする。

import type { MasterData, PokemonData } from '../data/index.ts';
import type { GimmickId, Individual } from '../domain/individual.ts';
import type { StatTable } from '../domain/stats.ts';
import { gimmickRegistry } from '../gimmicks/registry.ts';
import type { BattleForm, GimmickContext } from '../gimmicks/types.ts';
import { calcStats } from './stats.ts';

/** 戦闘中の姿 */
export interface Battler {
  /** 種族値・タイプ・特性(ギミックによる変化を反映したもの) */
  form: BattleForm;
  /** 実数値 */
  stats: StatTable;
}

/** ギミックを発動していないときの姿 */
function baseForm(individual: Individual, species: PokemonData): BattleForm {
  return {
    name: species.name,
    baseStats: species.baseStats,
    types: species.types,
    stabTypes: species.types,
    abilityId: individual.abilityId,
    weightKg: species.weightKg,
  };
}

/**
 * 個体から戦闘中の姿を作る。
 * @param individual 個体
 * @param activeGimmick いま発動しているギミック。何も発動していなければ null
 * @param data マスターデータ
 */
export function buildBattler(individual: Individual, activeGimmick: GimmickId | null, data: MasterData): Battler {
  const species = data.pokemon.get(individual.speciesId);
  if (!species) throw new Error(`データに無いポケモンです: ${individual.speciesId}`);
  const nature = data.natures.get(individual.natureId) ?? { up: null, down: null };
  const context: GimmickContext = { individual, species, data };

  let form = baseForm(individual, species);
  if (activeGimmick) form = applyChangeForm(activeGimmick, form, context);

  let stats = calcStats(form.baseStats, individual.statPoints, nature);
  if (activeGimmick) stats = applyChangeStats(activeGimmick, stats, context);

  return { form, stats };
}

// 下の2つは「登録簿からギミックを取り出し、その個体の設定を渡してフックを呼ぶ」だけの関数。
// <K extends GimmickId> は「K はギミックの名前のどれか」という意味で、
// こう書くと TypeScript が「mega の実装には mega の設定を渡している」と確かめてくれる。

function applyChangeForm<K extends GimmickId>(id: K, form: BattleForm, context: GimmickContext): BattleForm {
  const gimmick = gimmickRegistry[id];
  const config = context.individual.gimmicks[id];
  if (!config || !gimmick.changeForm) return form; // 設定が無い・フックが無いなら素通り
  return gimmick.changeForm(form, config, context);
}

function applyChangeStats<K extends GimmickId>(id: K, stats: StatTable, context: GimmickContext): StatTable {
  const gimmick = gimmickRegistry[id];
  const config = context.individual.gimmicks[id];
  if (!config || !gimmick.changeStats) return stats;
  return gimmick.changeStats(stats, config, context);
}
