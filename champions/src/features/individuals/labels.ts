// 選択欄に並べる文字を作る関数。

import type { SelectGroup, SelectOption } from '../../components/SelectField.tsx';
import type { ItemData, MasterData, MoveData, NatureData, PokemonData } from '../../data/index.ts';
import { STAT_KEYS, STAT_LABELS } from '../../domain/stats.ts';

const CATEGORY_LABELS: Record<MoveData['category'], string> = {
  physical: '物理',
  special: '特殊',
  status: '変化',
};

/** 技の選択肢の文字。例: 「じしん(じめん・物理・威力100)」 */
export function moveLabel(move: MoveData, data: MasterData): string {
  const details = [data.types.get(move.type)?.name ?? move.type, CATEGORY_LABELS[move.category]];
  if (move.variablePower) details.push('威力は状況で変わる');
  else if (move.power > 0) details.push(`威力${move.power}`);
  return `${move.name}(${details.join('・')})`;
}

/** 性格の選択肢の文字。例: 「ようき(すばやさ↑ とくこう↓)」 */
export function natureLabel(nature: NatureData): string {
  if (nature.up === null || nature.down === null) return `${nature.name}(補正なし)`;
  return `${nature.name}(${STAT_LABELS[nature.up]}↑ ${STAT_LABELS[nature.down]}↓)`;
}

/** 性格を「補正なし」「こうげき↑」「ぼうぎょ↑」…のグループに分ける */
export function natureGroups(data: MasterData): SelectGroup[] {
  const natures = [...data.natures.values()];
  const toOption = (nature: NatureData): SelectOption => ({ value: nature.id, label: natureLabel(nature) });
  const groups: SelectGroup[] = [
    { label: '補正なし', options: natures.filter((nature) => nature.up === null).map(toOption) },
  ];
  for (const key of STAT_KEYS) {
    const options = natures.filter((nature) => nature.up === key).map(toOption);
    if (options.length > 0) groups.push({ label: `${STAT_LABELS[key]}が上がる`, options });
  }
  return groups;
}

/** 持ち物を「メガストーン」と「それ以外」のグループに分ける */
export function itemGroups(items: ItemData[]): SelectGroup[] {
  const toOption = (item: ItemData): SelectOption => ({ value: item.id, label: item.name });
  const stones = items.filter((item) => item.isMegaStone).map(toOption);
  const others = items.filter((item) => !item.isMegaStone).map(toOption);
  const groups: SelectGroup[] = [];
  if (stones.length > 0) groups.push({ label: 'メガストーン', options: stones });
  groups.push({ label: '持ち物', options: others });
  return groups;
}

/** ポケモンの選択肢 */
export function pokemonOptions(data: MasterData): SelectOption[] {
  return [...data.pokemon.values()].map((species: PokemonData) => ({ value: species.id, label: species.name }));
}
