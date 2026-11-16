// ギミックの設定欄(画面の部品)が受け取るものの形。

import type { MasterData, PokemonData } from '../../data/index.ts';
import type { Individual } from '../../domain/individual.ts';

export interface GimmickEditorProps {
  individual: Individual;
  species: PokemonData;
  data: MasterData;
  /** 設定が変わったとき、変更後の個体を渡して呼ぶ関数 */
  onChange: (next: Individual) => void;
}
