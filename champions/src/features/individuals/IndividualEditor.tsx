// 個体編集画面。
//
// この画面が持っているデータは、ほぼ「いま編集中の個体」1つだけ(useState)。
// 実数値・選べる候補・入力チェックの結果は、その個体から毎回計算して表示する。
// だから、どの項目を変えても、画面のすべての表示がいつも最新になる。

import { useId, useState } from 'react';
import { buildBattler } from '../../calc/battler.ts';
import PokemonPicker from '../../components/PokemonPicker.tsx';
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
import type { Individual } from '../../domain/individual.ts';
import { MAX_NICKNAME_LENGTH } from '../../domain/limits.ts';
import { validateIndividual } from '../../domain/validateIndividual.ts';
import { gimmickRegistry, usableGimmickIds } from '../../gimmicks/registry.ts';
import { gimmickEditors } from '../gimmick-ui/gimmickEditors.ts';
import './IndividualEditor.css';
import { categoryLabel, itemGroups, natureGroups, powerLabel } from './labels.ts';
import StatPointsEditor, { type StatColumn } from './StatPointsEditor.tsx';

interface Props {
  data: MasterData;
  /** 選択中のレギュレーション(使えるギミックを決める) */
  regulation: RegulationData;
  /** 編集を始めるときの個体(保存済みのもの、または新しく作ったもの) */
  initial: Individual;
  /** まだ保存されていない新しい個体か */
  isNew: boolean;
  /** 保存するとき、編集後の個体を渡して呼ぶ関数。失敗したら説明つきのエラーを出す */
  onSave: (individual: Individual) => Promise<void>;
  /** 一覧に戻るときに呼ぶ関数 */
  onBack: () => void;
}

export default function IndividualEditor({ data, regulation, initial, isNew, onSave, onBack }: Props) {
  // 編集中の個体。setIndividual に新しい個体を渡すと、画面が描き直される。
  // ここで変えても、保存ボタンを押すまで保存データは変わらない
  const [individual, setIndividual] = useState(initial);
  // 最後に保存した(または開いた)ときの個体。これと違えば「未保存の変更あり」
  const [savedSnapshot, setSavedSnapshot] = useState(initial);
  // 一度でも保存されたか(新しい個体は、何も変えていなくても「未保存」)
  const [savedOnce, setSavedOnce] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingBack, setConfirmingBack] = useState(false);
  const nicknameId = useId();

  // 保存が必要か: 最後に保存した内容と違う、または一度も保存していない
  const isDirty = !savedOnce || JSON.stringify(individual) !== JSON.stringify(savedSnapshot);

  // 上の帯に出す状態の文
  const statusKind = saveError ? 'error' : isDirty ? 'dirty' : 'saved';
  const statusText = saveError ?? (isDirty ? '未保存' : '保存済み');

  async function save() {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(individual);
      setSavedSnapshot(individual);
      setSavedOnce(true);
    } catch (error) {
      // 上限に達した、などの理由をそのまま見せる
      setSaveError(error instanceof Error ? error.message : '保存できませんでした');
    } finally {
      setIsSaving(false);
    }
  }

  function back() {
    // 保存していない変更があるときは、すぐ戻らずに確かめる
    if (isDirty) setConfirmingBack(true);
    else onBack();
  }

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
    <div className="editor-page">
      <div className="page-bar">
        <button type="button" className="button-quiet" onClick={back}>
          ← 一覧
        </button>
        <span className="page-bar-status" aria-live="polite" data-kind={statusKind}>
          {statusText}
        </span>
        <button
          type="button"
          className="button-primary"
          disabled={isSaving || problems.length > 0 || !isDirty}
          onClick={save}
        >
          {isSaving ? '保存中…' : '保存'}
        </button>
      </div>

      {confirmingBack && (
        <div className="notice notice-warn" role="alertdialog" aria-label="未保存の変更があります">
          <p>保存していない変更があります。保存せずに一覧へ戻りますか?</p>
          <div className="notice-actions">
            <button type="button" className="button-quiet" onClick={() => setConfirmingBack(false)}>
              編集を続ける
            </button>
            <button type="button" className="button-danger" onClick={onBack}>
              保存せずに戻る
            </button>
          </div>
        </div>
      )}

    <div className="editor">
      <div className="editor-column">
        <section className="card">
          <h2>{isNew ? '個体の作成' : '個体の編集'}</h2>

          <PokemonPicker
            label="ポケモン"
            data={data}
            value={individual.speciesId}
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
          {individual.moveIds.map((moveId, slotIndex) => {
            const move = moveId === null ? undefined : data.moves.get(moveId);
            return (
              <div className="move-slot" key={slotIndex}>
                {/* 選ぶときは技の名前だけを並べる */}
                <SelectField
                  label={`技${slotIndex + 1}`}
                  value={moveId ?? ''}
                  options={[
                    { value: '', label: 'なし' },
                    ...selectableMoves(individual, slotIndex, data).map((candidate) => ({
                      value: candidate.id,
                      label: candidate.name,
                    })),
                  ]}
                  onChange={(value) =>
                    setIndividual(changeMove(individual, slotIndex, value === '' ? null : value, data))
                  }
                />
                {/* 選んだ技のタイプ・分類・威力を、欄の下に表示する */}
                {move && (
                  <p className="move-detail">
                    <TypeChips typeIds={[move.type]} data={data} />
                    <span>{categoryLabel(move)}</span>
                    <span>
                      威力 <strong>{powerLabel(move)}</strong>
                    </span>
                  </p>
                )}
              </div>
            );
          })}
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
          <p className="field-hint">問題があるあいだは保存できません。</p>
        </section>
      </div>
    </div>
    </div>
  );
}
