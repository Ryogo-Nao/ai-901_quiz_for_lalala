// 個体1体ぶんの要約(名前・タイプ・性格・特性・持ち物・実数値・技)。
// 個体の一覧と、チームの画面の両方で使う。

import { buildBattler } from '../calc/battler.ts';
import type { MasterData } from '../data/index.ts';
import type { Individual } from '../domain/individual.ts';
import { STAT_KEYS } from '../domain/stats.ts';
import TypeChips from './TypeChips.tsx';

interface Props {
  individual: Individual;
  data: MasterData;
  /** true のとき、名前と実数値だけの短い表示にする */
  compact?: boolean;
}

export default function IndividualSummary({ individual, data, compact = false }: Props) {
  const species = data.pokemon.get(individual.speciesId);
  const speciesName = species?.name ?? '不明なポケモン';

  // データに無いポケモン(データを減らしたあとの古い個体など)でも、壊さずに表示する
  if (!species) {
    return (
      <div className="summary">
        <div className="summary-head">
          <span className="summary-name">{individual.nickname || speciesName}</span>
        </div>
        <p className="notice notice-warn">このポケモンのデータがありません({individual.speciesId})。</p>
      </div>
    );
  }

  const battler = buildBattler(individual, null, data);
  const moveNames = individual.moveIds.filter((id) => id !== null).map((id) => data.moves.get(id)?.name ?? id);
  const itemName = individual.itemId ? (data.items.get(individual.itemId)?.name ?? individual.itemId) : 'なし';

  return (
    <div className="summary">
      <div className="summary-head">
        <span className="summary-name">{individual.nickname || speciesName}</span>
        {individual.nickname && <span className="summary-sub">{speciesName}</span>}
        <TypeChips typeIds={species.types} data={data} />
      </div>
      {!compact && (
        <p className="summary-sub">
          {data.natures.get(individual.natureId)?.name} / {data.abilities.get(individual.abilityId)?.name} / {itemName}
        </p>
      )}
      <p className="summary-stats" aria-label="実数値">
        {STAT_KEYS.map((key) => battler.stats[key]).join(' - ')}
      </p>
      {!compact && <p className="summary-sub">{moveNames.length > 0 ? moveNames.join(' / ') : '技なし'}</p>}
    </div>
  );
}
