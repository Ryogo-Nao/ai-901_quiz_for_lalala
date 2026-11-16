// 保存した個体の一覧。

import { useState } from 'react';
import { buildBattler } from '../../calc/battler.ts';
import TypeChips from '../../components/TypeChips.tsx';
import type { MasterData } from '../../data/index.ts';
import type { Individual } from '../../domain/individual.ts';
import { MAX_INDIVIDUALS } from '../../domain/limits.ts';
import { STAT_KEYS } from '../../domain/stats.ts';

interface Props {
  data: MasterData;
  individuals: Individual[];
  onCreate: () => void;
  onEdit: (individual: Individual) => void;
  onDuplicate: (individual: Individual) => void;
  onDelete: (individual: Individual) => void;
}

export default function IndividualList({ data, individuals, onCreate, onEdit, onDuplicate, onDelete }: Props) {
  const [query, setQuery] = useState('');
  // 削除の確認を出している個体の id。確認していなければ null
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const isFull = individuals.length >= MAX_INDIVIDUALS;
  const speciesName = (individual: Individual) => data.pokemon.get(individual.speciesId)?.name ?? '不明なポケモン';

  // 検索: ニックネームかポケモンの名前に、入力した文字が含まれるものだけを残す
  const keyword = query.trim();
  const visible = individuals.filter(
    (individual) => keyword === '' || individual.nickname.includes(keyword) || speciesName(individual).includes(keyword),
  );

  return (
    <div className="list-page">
      <section className="card">
        <div className="card-heading">
          <h2>
            個体 <span className="count">{individuals.length} / {MAX_INDIVIDUALS}</span>
          </h2>
          <button type="button" className="button-primary" disabled={isFull} onClick={onCreate}>
            + 新しく作る
          </button>
        </div>
        {isFull && (
          <p className="notice notice-warn">
            個体は{MAX_INDIVIDUALS}体まで保存できます。新しく作るには、使わない個体を削除してください。
          </p>
        )}
        {individuals.length > 0 && (
          <input
            id="individual-search"
            className="field-control"
            type="search"
            placeholder="名前で探す"
            aria-label="名前で探す"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </section>

      {individuals.length === 0 && (
        <section className="card empty">
          <p>まだ個体がありません。「+ 新しく作る」から作成して保存すると、ここに並びます。</p>
        </section>
      )}
      {individuals.length > 0 && visible.length === 0 && (
        <section className="card empty">
          <p>「{keyword}」に合う個体はありません。</p>
        </section>
      )}

      <ul className="individual-list">
        {visible.map((individual) => {
          const species = data.pokemon.get(individual.speciesId);
          // データに無いポケモン(データを減らしたあとの古い個体など)でも、一覧は壊さずに表示する
          const battler = species ? buildBattler(individual, null, data) : null;
          const moveNames = individual.moveIds
            .filter((id) => id !== null)
            .map((id) => data.moves.get(id)?.name ?? id);
          const itemName = individual.itemId ? (data.items.get(individual.itemId)?.name ?? individual.itemId) : 'なし';
          return (
            <li key={individual.id} className="card individual-card">
              <div className="individual-head">
                <span className="individual-name">{individual.nickname || speciesName(individual)}</span>
                {individual.nickname && <span className="individual-species">{speciesName(individual)}</span>}
                {species && <TypeChips typeIds={species.types} data={data} />}
              </div>
              {battler ? (
                <>
                  <p className="individual-line">
                    {data.natures.get(individual.natureId)?.name} / {data.abilities.get(individual.abilityId)?.name} /{' '}
                    {itemName}
                  </p>
                  <p className="individual-stats" aria-label="実数値">
                    {STAT_KEYS.map((key) => battler.stats[key]).join(' - ')}
                  </p>
                  <p className="individual-line">{moveNames.length > 0 ? moveNames.join(' / ') : '技なし'}</p>
                </>
              ) : (
                <p className="notice notice-warn">このポケモンのデータがありません({individual.speciesId})。</p>
              )}

              {confirmingDeleteId === individual.id ? (
                <div className="notice notice-warn" role="alertdialog" aria-label="削除の確認">
                  <p>この個体を削除しますか? 元に戻せません。</p>
                  <div className="notice-actions">
                    <button type="button" className="button-quiet" onClick={() => setConfirmingDeleteId(null)}>
                      やめる
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => {
                        setConfirmingDeleteId(null);
                        onDelete(individual);
                      }}
                    >
                      削除する
                    </button>
                  </div>
                </div>
              ) : (
                <div className="individual-actions">
                  <button type="button" className="button-quiet" disabled={!species} onClick={() => onEdit(individual)}>
                    編集
                  </button>
                  <button type="button" className="button-quiet" disabled={isFull} onClick={() => onDuplicate(individual)}>
                    複製
                  </button>
                  <button type="button" className="button-quiet" onClick={() => setConfirmingDeleteId(individual.id)}>
                    削除
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
