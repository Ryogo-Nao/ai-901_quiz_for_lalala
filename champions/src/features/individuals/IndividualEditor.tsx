// 個体編集画面。
//
// この画面が持っているデータは「いま編集中の個体」1つだけ(useState)。
// 実数値・選べる候補・入力チェックの結果は、その個体から毎回計算して表示する。
// だから、どの項目を変えても、画面のすべての表示がいつも最新になる。

import { useId, useState } from 'react';
import { buildBattler } from '../../calc/battler.ts';
import SelectField from '../../components/SelectField.tsx';
import TypeChips from '../../components/TypeChips.tsx';
import type { MasterData, RegulationData } from '../../data/index.ts';
import {
  changeAbility,
  changeItem,
  changeMove,
  changeNature,
  changeNickname,
  changeSpecies,
  requireSpecies,
  selectableItems,
  selectableMoves,
} from '../../domain/editIndividual.ts';
import { createIndividual, type Individual } from '../../domain/individual.ts';
import { MAX_NICKNAME_LENGTH } from '../../domain/limits.ts';
import { validateIndividual } from '../../domain/validateIndividual.ts';
import { gimmickRegistry, usableGimmickIds } from '../../gimmicks/registry.ts';
import { gimmickEditors } from '../gimmick-ui/gimmickEditors.ts';
import './IndividualEditor.css';
import { itemGroups, moveLabel, natureGroups, pokemonOptions } from './labels.ts';
import StatPointsEditor, { type StatColumn } from './StatPointsEditor.tsx';

interface Props {
  data: MasterData;
  /** 選択中のレギュレーション(使えるギミックを決める) */
  regulation: RegulationData;
}

/** 一覧の先頭のポケモンで、まっさらな個体を作る */
function createFirstIndividual(data: MasterData): Individual {
  const first = [...data.pokemon.values()][0];
  return createIndividual(first.id, first.abilities[0]);
}

export default function IndividualEditor({ data, regulation }: Props) {
  // 編集中の個体。setIndividual に新しい個体を渡すと、画面が描き直される
  const [individual, setIndividual] = useState(() => createFirstIndividual(data));
  const nicknameId = useId();

  // ----- ここから下は、すべて「いまの個体」から計算している -----
  const species = requireSpecies(data, individual.speciesId);
  const nature = data.natures.get(individual.natureId) ?? { up: null, down: null };

  // このレギュレーション・このポケモンで使えるギミック
  const gimmickIds = usableGimmickIds(regulation, species);

  // ふだんの姿と、設定済みのギミックを発動したときの姿
  const normal = buildBattler(individual, null, data);
  const variants = gimmickIds
    .filter((id) => individual.gimmicks[id] !== undefined)
    .map((id) => ({
      id,
      label: `${gimmickRegistry[id].label}後`, // 例: 「メガシンカ後」
      shortLabel: `${gimmickRegistry[id].shortLabel}後`, // 例: 「メガ後」(表の見出し用)
      battler: buildBattler(individual, id, data),
    }));

  const statColumns: StatColumn[] = [
    { label: '実数値', baseStats: normal.form.baseStats, stats: normal.stats },
    ...variants.map((variant) => ({
      label: variant.shortLabel,
      baseStats: variant.battler.form.baseStats,
      stats: variant.battler.stats,
    })),
  ];

  const problems = validateIndividual(individual, data);
  const abilityName = (id: string) => data.abilities.get(id)?.name ?? id;

  return (
    <div className="editor">
      <div className="editor-column">
        <section className="card">
          <div className="card-heading">
            <h2>個体の作成</h2>
            <button type="button" className="button-quiet" onClick={() => setIndividual(createFirstIndividual(data))}>
              最初からやり直す
            </button>
          </div>

          <SelectField
            label="ポケモン"
            value={individual.speciesId}
            options={pokemonOptions(data)}
            onChange={(value) => setIndividual(changeSpecies(individual, value, data))}
            hint="変えると、技は空欄に、特性は新しいポケモンのものに変わります。"
          />

          <div className="field">
            <label className="field-label" htmlFor={nicknameId}>
              ニックネーム
            </label>
            <input
              id={nicknameId}
              className="field-control"
              type="text"
              maxLength={MAX_NICKNAME_LENGTH}
              placeholder={species.name}
              value={individual.nickname}
              onChange={(event) => setIndividual(changeNickname(individual, event.target.value))}
            />
          </div>

          <SelectField
            label="性格"
            value={individual.natureId}
            groups={natureGroups(data)}
            onChange={(value) => setIndividual(changeNature(individual, value, data))}
          />

          <SelectField
            label="特性"
            value={individual.abilityId}
            options={species.abilities.map((id) => ({ value: id, label: abilityName(id) }))}
            onChange={(value) => setIndividual(changeAbility(individual, value, data))}
          />

          <SelectField
            label="持ち物"
            value={individual.itemId ?? ''}
            options={[{ value: '', label: 'なし' }]}
            groups={itemGroups(selectableItems(species, data))}
            onChange={(value) => setIndividual(changeItem(individual, value === '' ? null : value, data))}
          />

          {/* 使えるギミックの設定欄だけを並べる。どのギミックかは、この画面は知らない */}
          {gimmickIds.map((id) => {
            const GimmickEditor = gimmickEditors[id];
            return (
              <GimmickEditor key={id} individual={individual} species={species} data={data} onChange={setIndividual} />
            );
          })}
        </section>

        <section className="card">
          <h2>技</h2>
          {individual.moveIds.map((moveId, slotIndex) => (
            <SelectField
              key={slotIndex}
              label={`技${slotIndex + 1}`}
              value={moveId ?? ''}
              options={[
                { value: '', label: 'なし' },
                ...selectableMoves(individual, slotIndex, data).map((move) => ({
                  value: move.id,
                  label: moveLabel(move, data),
                })),
              ]}
              onChange={(value) => setIndividual(changeMove(individual, slotIndex, value === '' ? null : value, data))}
            />
          ))}
          <p className="field-hint">
            {species.name}が覚える技({species.learnset.length}個)だけが選べます。同じ技は2つ選べません。
          </p>
        </section>
      </div>

      <div className="editor-column">
        <section className="card">
          <h2>{individual.nickname || species.name}</h2>
          <div className="form-summary">
            {[{ label: 'ふだんの姿', battler: normal }, ...variants].map(({ label, battler }) => (
              <dl className="form-summary-item" key={label}>
                <dt>{label}</dt>
                <dd>
                  <span className="form-name">{battler.form.name}</span>
                  <TypeChips typeIds={battler.form.types} data={data} />
                  <span className="form-ability">特性: {abilityName(battler.form.abilityId)}</span>
                </dd>
              </dl>
            ))}
          </div>
        </section>

        <StatPointsEditor
          statPoints={individual.statPoints}
          nature={nature}
          columns={statColumns}
          onChange={(statPoints) => setIndividual({ ...individual, statPoints })}
        />

        <section className="card">
          <h2>入力チェック</h2>
          {problems.length === 0 ? (
            <p className="check-ok">問題ありません</p>
          ) : (
            <ul className="check-problems">
              {problems.map((problem) => (
                <li key={problem.message}>{problem.message}</li>
              ))}
            </ul>
          )}
          <p className="field-hint">保存はステップ2で作ります。いまはページを再読み込みすると入力が消えます。</p>
        </section>
      </div>
    </div>
  );
}
