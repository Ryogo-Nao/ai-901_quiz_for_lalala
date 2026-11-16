// ギミックの登録簿。
//
// アプリのほかの部分は、この登録簿を通してギミックを使う。
// 新しいギミックを足すときは、ここに1行並べる。

import type { PokemonData, RegulationData } from '../data/index.ts';
import type { GimmickId } from '../domain/individual.ts';
import { mega } from './mega.ts';
import type { GimmickRegistry } from './types.ts';

export const gimmickRegistry: GimmickRegistry = {
  mega,
  // 将来の例 → tera,
};

/** 登録されているギミックの名前の一覧 */
export const GIMMICK_IDS = Object.keys(gimmickRegistry) as GimmickId[];

/**
 * そのレギュレーションで、そのポケモンが使えるギミックの名前の一覧。
 * 画面は、ここで返ってきたギミックの設定欄だけを表示する。
 */
export function usableGimmickIds(regulation: RegulationData, species: PokemonData): GimmickId[] {
  return GIMMICK_IDS.filter((id) => regulation.gimmicks.includes(id) && gimmickRegistry[id].canUse(species));
}
