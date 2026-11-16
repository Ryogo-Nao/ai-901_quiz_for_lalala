// 個体を編集するときの決まり。
//
// ポケモンごとに「覚える技」「持てる特性」「対応するメガストーン」が違う。
// 画面はここにある関数を通して、
//   ・選べる候補の一覧をもらう(そのポケモンに合うものだけ)
//   ・項目を変える(変えた結果、つじつまが合わなくなる項目も一緒に直す)
// ので、データに合わない組み合わせは入力できない。
//
// どの関数も、元の個体を書き換えずに「新しい個体」を返す。

import type { ItemData, MasterData, MoveData, PokemonData } from '../data/index.ts';
import { GIMMICK_IDS, gimmickRegistry } from '../gimmicks/registry.ts';
import type { GimmickId, GimmickSettings, Individual } from './individual.ts';
import { MAX_NICKNAME_LENGTH, MOVE_SLOT_COUNT } from './limits.ts';

/** データからポケモンを引く。無ければエラーにする */
export function requireSpecies(data: MasterData, speciesId: string): PokemonData {
  const species = data.pokemon.get(speciesId);
  if (!species) throw new Error(`データに無いポケモンです: ${speciesId}`);
  return species;
}

// ---------------------------------------------------------------------------
// 選べる候補
// ---------------------------------------------------------------------------

/** 日本語名の五十音順に並べる */
function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

/**
 * そのポケモンが持てる持ち物。
 * 誰でも持てる持ち物すべて + そのポケモン専用のメガストーン。
 * (ほかのポケモン用のメガストーンは候補に出さない)
 */
export function selectableItems(species: PokemonData, data: MasterData): ItemData[] {
  const ownStones = new Set(species.megaForms.map((form) => form.requiredItem));
  const items = [...data.items.values()].filter((item) => !item.isMegaStone || ownStones.has(item.id));
  return sortByName(items);
}

/**
 * 技の欄(slotIndex 番目)で選べる技。
 * そのポケモンが覚える技から、ほかの欄ですでに選んでいる技を除いたもの。
 */
export function selectableMoves(individual: Individual, slotIndex: number, data: MasterData): MoveData[] {
  const species = requireSpecies(data, individual.speciesId);
  const usedElsewhere = new Set(individual.moveIds.filter((id, index) => id !== null && index !== slotIndex));
  const moves = species.learnset
    .filter((id) => !usedElsewhere.has(id))
    .map((id) => data.moves.get(id))
    .filter((move) => move !== undefined);
  return sortByName(moves);
}

// ---------------------------------------------------------------------------
// 項目を変える
// ---------------------------------------------------------------------------

/**
 * ギミックの設定を、個体のいまの状態に合わせ直す。
 * 例: メガストーンを外したら、メガシンカの設定も外す。
 */
function syncGimmicks(individual: Individual, species: PokemonData): Individual {
  const gimmicks: GimmickSettings = { ...individual.gimmicks };
  for (const id of GIMMICK_IDS) syncOneGimmick(id, gimmicks, individual, species);
  return { ...individual, gimmicks };
}

function syncOneGimmick<K extends GimmickId>(
  id: K,
  gimmicks: GimmickSettings,
  individual: Individual,
  species: PokemonData,
): void {
  const gimmick = gimmickRegistry[id];
  if (!gimmick.canUse(species)) {
    delete gimmicks[id]; // このポケモンでは使えないギミックの設定は外す
    return;
  }
  if (!gimmick.syncSettings) return; // 合わせ直す決まりを持たないギミックは、そのまま
  const config = gimmick.syncSettings(individual, species);
  if (config === undefined) delete gimmicks[id];
  else gimmicks[id] = config;
}

/**
 * ポケモンを変える。
 * 特性は新しいポケモンの1つ目の特性に、技はすべて空欄にする(覚える技が違うため)。
 * ほかのポケモン専用のメガストーンを持っていたら外す。
 * 性格・能力ポイント・ニックネームはそのまま残す。
 */
export function changeSpecies(individual: Individual, speciesId: string, data: MasterData): Individual {
  const species = requireSpecies(data, speciesId);
  const canKeepItem =
    individual.itemId !== null && selectableItems(species, data).some((item) => item.id === individual.itemId);
  return syncGimmicks(
    {
      ...individual,
      speciesId,
      abilityId: species.abilities[0],
      itemId: canKeepItem ? individual.itemId : null,
      moveIds: Array.from({ length: MOVE_SLOT_COUNT }, () => null),
    },
    species,
  );
}

/** 特性を変える。そのポケモンが持てない特性なら、何も変えない */
export function changeAbility(individual: Individual, abilityId: string, data: MasterData): Individual {
  const species = requireSpecies(data, individual.speciesId);
  if (!species.abilities.includes(abilityId)) return individual;
  return { ...individual, abilityId };
}

/**
 * 持ち物を変える(null は「持ち物なし」)。そのポケモンが持てない持ち物なら、何も変えない。
 * メガストーンを持たせた/外したときは、メガシンカの設定も合わせて変わる。
 */
export function changeItem(individual: Individual, itemId: string | null, data: MasterData): Individual {
  const species = requireSpecies(data, individual.speciesId);
  if (itemId !== null && !selectableItems(species, data).some((item) => item.id === itemId)) return individual;
  return syncGimmicks({ ...individual, itemId }, species);
}

/**
 * メガシンカ後の姿を選ぶ(null は「メガシンカしない」)。
 * メガシンカにはメガストーンが必要なので、持ち物も一緒に変える。
 */
export function changeMegaForm(individual: Individual, formId: string | null, data: MasterData): Individual {
  const species = requireSpecies(data, individual.speciesId);
  if (formId === null) {
    // メガシンカをやめる → メガストーンを持っていたら外す
    const holdsStone = species.megaForms.some((form) => form.requiredItem === individual.itemId);
    return holdsStone ? changeItem(individual, null, data) : individual;
  }
  const form = species.megaForms.find((candidate) => candidate.id === formId);
  if (!form) return individual; // このポケモンには無い姿なら、何も変えない
  return changeItem(individual, form.requiredItem, data);
}

/**
 * 技を変える(null は「空欄」)。
 * そのポケモンが覚えない技、ほかの欄と同じ技なら、何も変えない。
 */
export function changeMove(
  individual: Individual,
  slotIndex: number,
  moveId: string | null,
  data: MasterData,
): Individual {
  if (slotIndex < 0 || slotIndex >= MOVE_SLOT_COUNT) return individual;
  if (moveId !== null && !selectableMoves(individual, slotIndex, data).some((move) => move.id === moveId)) {
    return individual;
  }
  const moveIds = individual.moveIds.map((current, index) => (index === slotIndex ? moveId : current));
  return { ...individual, moveIds };
}

/** 性格を変える。データに無い性格なら、何も変えない */
export function changeNature(individual: Individual, natureId: string, data: MasterData): Individual {
  return data.natures.has(natureId) ? { ...individual, natureId } : individual;
}

/** ニックネームを変える。長すぎる分は切り捨てる */
export function changeNickname(individual: Individual, nickname: string): Individual {
  // [...文字列] は、絵文字なども1文字として数えるための書き方
  return { ...individual, nickname: [...nickname].slice(0, MAX_NICKNAME_LENGTH).join('') };
}
