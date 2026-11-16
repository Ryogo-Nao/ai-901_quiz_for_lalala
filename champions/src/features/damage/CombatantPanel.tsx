// 攻撃側または防御側の1体ぶんの入力欄。
//
// 「保存した個体を呼び出す」か「この画面で自由に作る」かを選べる。
// どちらの場合も、ここでの変更は一時的なもので、保存データには影響しない。

import { useId } from 'react';
import { STATUS_LABELS, type Ranks, type StatusId } from '../../calc/damage/context.ts';
import type { Battler } from '../../calc/battler.ts';
import SelectField from '../../components/SelectField.tsx';
import TypeChips from '../../components/TypeChips.tsx';
import type { MasterData, RegulationData } from '../../data/index.ts';
import {
  changeAbility,
  changeItem,
  changeNature,
  changeSpecies,
  requireSpecies,
  selectableItems,
} from '../../domain/editIndividual.ts';
import { createIndividual, type Individual } from '../../domain/individual.ts';
import { STAT_KEYS, STAT_LABELS } from '../../domain/stats.ts';
import { gimmickRegistry, usableGimmickIds } from '../../gimmicks/registry.ts';
import { gimmickEditors } from '../gimmick-ui/gimmickEditors.ts';
import { itemGroups, natureGroups, pokemonOptions } from '../individuals/labels.ts';
import StatPointsEditor from '../individuals/StatPointsEditor.tsx';
import { makeSide, type SideState } from './state.ts';

interface Props {
  title: string;
  data: MasterData;
  regulation: RegulationData;
  side: SideState;
  /** この1体の「戦闘中の姿」(実数値の表示に使う) */
  battler: Battler;
  /** 保存してある個体(呼び出しの候補) */
  savedIndividuals: Individual[];
  /** ランクの欄に出す能力。攻撃側は こうげき・とくこう、防御側は ぼうぎょ・とくぼう を先に出す */
  mainRankKeys: (keyof Ranks)[];
  onChange: (next: SideState) => void;
}

const RANK_OPTIONS = Array.from({ length: 13 }, (_, index) => 6 - index).map((rank) => ({
  value: String(rank),
  label: rank > 0 ? `+${rank}` : String(rank),
}));

const NEW_VALUE = '__new__';

export default function CombatantPanel({ title, data, regulation, side, battler, savedIndividuals, mainRankKeys, onChange }: Props) {
  const hpId = useId();
  const { individual } = side;
  const species = requireSpecies(data, individual.speciesId);
  const nature = data.natures.get(individual.natureId) ?? { up: null, down: null };
  const gimmickIds = usableGimmickIds(regulation, species);
  // 設定済みのギミック(メガストーンを持っている、など)があれば、発動の切り替えを出す
  const activeGimmickId = gimmickIds.find((id) => individual.gimmicks[id] !== undefined);

  // 個体を変えたとき: 写しを差し替える。ギミックの設定が無くなったら、発動も解除する
  const setIndividual = (next: Individual) => {
    const stillHasGimmick = usableGimmickIds(regulation, requireSpecies(data, next.speciesId)).some(
      (id) => next.gimmicks[id] !== undefined,
    );
    // ポケモンそのものを変えたら、もう「呼び出した個体」ではないので、呼び出し元の表示を外す
    const sourceId = next.speciesId === individual.speciesId ? side.sourceId : null;
    onChange({ ...side, individual: next, sourceId, gimmickOn: side.gimmickOn && stillHasGimmick });
  };

  const displayName = (saved: Individual) => {
    const name = data.pokemon.get(saved.speciesId)?.name ?? '不明なポケモン';
    return saved.nickname ? `${saved.nickname}(${name})` : name;
  };
  // データにあるポケモンの個体だけを、呼び出しの候補にする
  const loadable = savedIndividuals.filter((saved) => data.pokemon.has(saved.speciesId));
  const otherRankKeys = (['atk', 'def', 'spa', 'spd', 'spe'] as const).filter((key) => !mainRankKeys.includes(key));
  const maxHp = battler.stats.hp;
  const currentHp = Math.max(1, Math.floor((maxHp * side.hpPercent) / 100));

  const rankField = (key: keyof Ranks) => (
    <SelectField
      key={key}
      label={`${STAT_LABELS[key]}ランク`}
      value={String(side.ranks[key])}
      options={RANK_OPTIONS}
      onChange={(value) => onChange({ ...side, ranks: { ...side.ranks, [key]: Number(value) } })}
    />
  );

  return (
    <section className="card combatant">
      <h2>{title}</h2>

      <SelectField
        label="呼び出す個体"
        value={side.sourceId ?? NEW_VALUE}
        options={[{ value: NEW_VALUE, label: 'この画面で作る' }]}
        groups={loadable.length > 0 ? [{ label: '保存した個体', options: loadable.map((saved) => ({ value: saved.id, label: displayName(saved) })) }] : []}
        onChange={(value) => {
          if (value === NEW_VALUE) {
            // いまのポケモンのまま、まっさらな個体にする
            onChange(makeSide(createIndividual(species.id, species.abilities[0]), null));
            return;
          }
          const saved = loadable.find((candidate) => candidate.id === value);
          if (saved) onChange(makeSide(saved, saved.id));
        }}
        hint={side.sourceId ? 'ここで変えても、保存した個体は変わりません。' : undefined}
      />

      <div className="summary">
        <div className="summary-head">
          <span className="summary-name">{battler.form.name}</span>
          <TypeChips typeIds={battler.form.types} data={data} />
        </div>
        <p className="summary-sub">特性: {data.abilities.get(battler.form.abilityId)?.name ?? battler.form.abilityId}</p>
        <p className="summary-stats" aria-label="実数値">
          {STAT_KEYS.map((key) => battler.stats[key]).join(' - ')}
        </p>
      </div>

      {activeGimmickId && (
        <label className="check">
          <input
            type="checkbox"
            checked={side.gimmickOn}
            onChange={(event) => onChange({ ...side, gimmickOn: event.target.checked })}
          />
          {gimmickRegistry[activeGimmickId].label}した姿で計算する
        </label>
      )}

      <div className="field-grid">
        {mainRankKeys.map(rankField)}
        <SelectField
          label="状態異常"
          value={side.status ?? ''}
          options={[
            { value: '', label: 'なし' },
            ...(Object.keys(STATUS_LABELS) as StatusId[]).map((id) => ({ value: id, label: STATUS_LABELS[id] })),
          ]}
          onChange={(value) => onChange({ ...side, status: value === '' ? null : (value as StatusId) })}
        />
        <div className="field">
          <label className="field-label" htmlFor={hpId}>
            いまのHP(%)
          </label>
          <input
            id={hpId}
            className="field-control"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={side.hpPercent}
            onChange={(event) => {
              const value = Math.trunc(Number(event.target.value));
              onChange({ ...side, hpPercent: Number.isFinite(value) ? Math.max(1, Math.min(100, value)) : 100 });
            }}
          />
          <p className="field-hint">
            {currentHp} / {maxHp}
          </p>
        </div>
      </div>

      {/* details は、タップで開いたり閉じたりできる部品。細かい設定をたたんでおく */}
      <details className="fold">
        <summary>ポケモン・性格・特性・持ち物・能力ポイントを変える</summary>
        <div className="fold-body">
          <SelectField
            label="ポケモン"
            value={individual.speciesId}
            options={pokemonOptions(data)}
            onChange={(value) => setIndividual(changeSpecies(individual, value, data))}
          />
          <div className="field-grid">
            <SelectField
              label="性格"
              value={individual.natureId}
              groups={natureGroups(data)}
              onChange={(value) => setIndividual(changeNature(individual, value, data))}
            />
            <SelectField
              label="特性"
              value={individual.abilityId}
              options={species.abilities.map((id) => ({ value: id, label: data.abilities.get(id)?.name ?? id }))}
              onChange={(value) => setIndividual(changeAbility(individual, value, data))}
            />
          </div>
          <SelectField
            label="持ち物"
            value={individual.itemId ?? ''}
            options={[{ value: '', label: 'なし' }]}
            groups={itemGroups(selectableItems(species, data))}
            onChange={(value) => setIndividual(changeItem(individual, value === '' ? null : value, data))}
          />
          {gimmickIds.map((id) => {
            const GimmickEditor = gimmickEditors[id];
            return <GimmickEditor key={id} individual={individual} species={species} data={data} onChange={setIndividual} />;
          })}
          <StatPointsEditor
            statPoints={individual.statPoints}
            nature={nature}
            columns={[{ label: '実数値', baseStats: battler.form.baseStats, stats: battler.stats }]}
            onChange={(statPoints) => setIndividual({ ...individual, statPoints })}
          />
          <div className="field-grid">{otherRankKeys.map(rankField)}</div>
        </div>
      </details>
    </section>
  );
}
