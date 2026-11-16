// タイプの名前を、色の印つきで並べて表示する部品。

import type { MasterData } from '../data/index.ts';

interface Props {
  typeIds: string[];
  data: MasterData;
}

export default function TypeChips({ typeIds, data }: Props) {
  return (
    <span className="type-chips">
      {typeIds.map((id) => (
        // data-type に ID を入れておき、色は CSS 側で決める(global.css の .type-chip)
        <span key={id} className="type-chip" data-type={id}>
          {data.types.get(id)?.name ?? id}
        </span>
      ))}
    </span>
  );
}
