// 個体のデータが、決まりとマスターデータに合っているかを調べる。
//
// 画面からの入力は editIndividual.ts が守っているので、ふつうは問題が出ない。
// それでも調べるのは、あとのステップで
//   ・ファイルから読み込んだデータ
//   ・マスターデータを更新したあとの、古い保存データ
// のように、画面を通らないデータを扱うため。

import { isValidStatPoints } from '../calc/statPoints.ts';
import type { MasterData, PokemonData } from '../data/index.ts';
import { GIMMICK_IDS, gimmickRegistry } from '../gimmicks/registry.ts';
import { selectableItems } from './editIndividual.ts';
import type { GimmickId, Individual } from './individual.ts';
import { MAX_NICKNAME_LENGTH, MAX_STAT_POINTS_PER_STAT, MAX_TOTAL_STAT_POINTS, MOVE_SLOT_COUNT } from './limits.ts';

/** 見つかった問題 */
export interface Problem {
  /** どの項目の問題か */
  field: 'species' | 'nickname' | 'nature' | 'ability' | 'item' | 'moves' | 'statPoints' | 'gimmicks';
  /** 利用者に見せる説明 */
  message: string;
}

/**
 * 個体を調べて、問題の一覧を返す。問題が無ければ空の配列を返す。
 */
export function validateIndividual(individual: Individual, data: MasterData): Problem[] {
  const problems: Problem[] = [];
  const add = (field: Problem['field'], message: string) => problems.push({ field, message });

  const species = data.pokemon.get(individual.speciesId);
  if (!species) {
    // ポケモンが分からないと、ほかの項目は調べようがない
    return [{ field: 'species', message: `データに無いポケモンです(${individual.speciesId})` }];
  }

  if ([...individual.nickname].length > MAX_NICKNAME_LENGTH) {
    add('nickname', `ニックネームは${MAX_NICKNAME_LENGTH}文字までです`);
  }

  if (!data.natures.has(individual.natureId)) {
    add('nature', `データに無い性格です(${individual.natureId})`);
  }

  if (!species.abilities.includes(individual.abilityId)) {
    const name = data.abilities.get(individual.abilityId)?.name ?? individual.abilityId;
    add('ability', `${species.name}は特性「${name}」を持てません`);
  }

  if (individual.itemId !== null) {
    const item = data.items.get(individual.itemId);
    if (!item) {
      add('item', `データに無い持ち物です(${individual.itemId})`);
    } else if (!selectableItems(species, data).some((candidate) => candidate.id === item.id)) {
      add('item', `${species.name}は「${item.name}」を持てません(ほかのポケモン用のメガストーンです)`);
    }
  }

  if (individual.moveIds.length !== MOVE_SLOT_COUNT) {
    add('moves', `技の欄は${MOVE_SLOT_COUNT}つ必要です`);
  }
  const chosenMoveIds = individual.moveIds.filter((id) => id !== null);
  for (const moveId of new Set(chosenMoveIds)) {
    if (!species.learnset.includes(moveId)) {
      const name = data.moves.get(moveId)?.name ?? moveId;
      add('moves', `${species.name}は技「${name}」を覚えません`);
    }
  }
  if (new Set(chosenMoveIds).size !== chosenMoveIds.length) {
    add('moves', '同じ技が2つ以上選ばれています');
  }

  if (!isValidStatPoints(individual.statPoints)) {
    add(
      'statPoints',
      `能力ポイントは1つの能力に0〜${MAX_STAT_POINTS_PER_STAT}、合計${MAX_TOTAL_STAT_POINTS}までです`,
    );
  }

  // ギミックの設定。登録簿にあるギミックを順番に調べる(個々のギミックの名前はここに書かない)
  for (const id of GIMMICK_IDS) {
    const message = gimmickProblem(id, individual, species);
    if (message) add('gimmicks', message);
  }

  return problems;
}

/** ギミック1つ分の設定を調べる。問題があれば説明を、無ければ null を返す */
function gimmickProblem<K extends GimmickId>(id: K, individual: Individual, species: PokemonData): string | null {
  const gimmick = gimmickRegistry[id];
  const setting = individual.gimmicks[id];

  if (setting && !gimmick.canUse(species)) return `${species.name}は${gimmick.label}を使えません`;

  if (gimmick.syncSettings) {
    // 「いまの個体にふさわしい設定」と、実際の設定を比べる
    const expected = gimmick.syncSettings(individual, species);
    if (JSON.stringify(expected) !== JSON.stringify(setting)) {
      return `${gimmick.label}の設定が、ほかの項目(持ち物など)と合っていません`;
    }
  }
  return null;
}
