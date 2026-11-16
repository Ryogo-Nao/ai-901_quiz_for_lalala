// 攻撃側または防御側の1体ぶんの入力欄。
//
// 何も呼び出さなくても、データにあるポケモンを選んでそのまま計算できる。
// 「保存した個体から呼ぶ」で、自分で作った個体を呼び出すこともできる。
// どちらの場合も、ここでの変更は一時的なもので、保存データには影響しない。
//
// 役割(role)によって、出す欄が変わる。
//   攻撃側 … 技、攻撃に使う能力、威力が上がる条件(children で受け取る)
//   防御側 … HP、受けるのに使う能力、ダメージが減る条件(children で受け取る)

import { useId, useState, type ReactNode } from 'react';
import { STATUS_LABELS, type Ranks, type StatusId } from '../../calc/damage/context.ts';
import type { Battler } from '../../calc/battler.ts';
import { maxStatPointsFor, remainingStatPoints, setStatPoint } from '../../calc/statPoints.ts';
import { natureEffectOn, type NatureEffect } from '../../calc/stats.ts';
import PokemonPicker from '../../components/PokemonPicker.tsx';
import Segmented from '../../components/Segmented.tsx';
import SelectField from '../../components/SelectField.tsx';
import Stepper from '../../components/Stepper.tsx';
import TypeChips from '../../components/TypeChips.tsx';
import type { MasterData, RegulationData } from '../../data/index.ts';
import { changeAbility, changeItem, changeNature, changeSpecies, requireSpecies, selectableItems } from '../../domain/editIndividual.ts';
import type { Individual } from '../../domain/individual.ts';
import { natureForEffect } from '../../domain/nature.ts';
import { STAT_KEYS, STAT_LABELS, type StatKey } from '../../domain/stats.ts';
import { gimmickRegistry, usableGimmickIds } from '../../gimmicks/registry.ts';
import { gimmickEditors } from '../gimmick-ui/gimmickEditors.ts';
import { itemGroups } from '../individuals/labels.ts';
import StatPointsEditor from '../individuals/StatPointsEditor.tsx';
import { makeSide, type SideState } from './state.ts';

interface Props {
  role: 'attacker' | 'defender';
  data: MasterData;
  regulation: RegulationData;
  side: SideState;
  /** この1体の「戦闘中の姿」(実数値の表示に使う) */
  battler: Battler;
  /** 保存してある個体(呼び出しの候補) */
  savedIndividuals: Individual[];
  /** いまの技で、計算に使う能力(攻撃側なら こうげき か とくこう、防御側なら ぼうぎょ か とくぼう) */
  statKey: Exclude<StatKey, 'hp'>;
  onChange: (next: SideState) => void;
  /** ポケモンの欄のすぐ下に出すもの(攻撃側の「技」) */
  afterPokemon?: ReactNode;
  /** 条件の欄(攻撃側は威力が上がる条件、防御側はダメージが減る条件) */
  children?: ReactNode;
}

const NATURE_OPTIONS = [
  { value: 'down', label: '0.9' },
  { value: 'neutral', label: '1.0' },
  { value: 'up', label: '1.1' },
] as const;

const formatRank = (rank: number) => (rank > 0 ? `+${rank}` : rank === 0 ? '±0' : String(rank));
const NONE = '__none__';

export default function CombatantPanel({ role, data, regulation, side, battler, savedIndividuals, statKey, onChange, afterPokemon, children }: Props) {
  const hpId = useId();
  const { individual } = side;
  const species = requireSpecies(data, individual.speciesId);
  const nature = data.natures.get(individual.natureId) ?? { id: '', name: '', nameEn: '', up: null, down: null };
  const gimmickIds = usableGimmickIds(regulation, species);
  const hasGimmick = (target: Individual) =>
    usableGimmickIds(regulation, requireSpecies(data, target.speciesId)).some((id) => target.gimmicks[id] !== undefined);
  const activeGimmickId = gimmickIds.find((id) => individual.gimmicks[id] !== undefined);
  const title = role === 'attacker' ? '攻撃側' : '防御側';

  /** 個体(写し)を差し替える */
  const setIndividual = (next: Individual) => {
    // ギミックの設定が新しく入ったら、その姿で計算する。設定が無くなったら、発動も解除する
    const gimmickOn = hasGimmick(next) ? side.gimmickOn || !hasGimmick(individual) : false;
    // ポケモンそのものを変えたら、もう「呼び出した個体」ではないので、呼び出し元の表示を外す
    const sourceId = next.speciesId === individual.speciesId ? side.sourceId : null;
    // ポケモンを変えたら、手で変えたタイプは元に戻す
    const typeOverride = next.speciesId === individual.speciesId ? side.typeOverride : null;
    onChange({ ...side, individual: next, sourceId, gimmickOn, typeOverride });
  };

  // ----- タイプの変更 -----
  const [isEditingTypes, setIsEditingTypes] = useState(false);
  const typeOptions = [...data.types.values()].map((type) => ({ value: type.id, label: type.name }));
  const [type1, type2 = ''] = battler.form.types;
  /** タイプを手で指定する。2つ目は「なし」にもできる。同じタイプを2つ選んだら1つにまとめる */
  const setTypes = (first: string, second: string) =>
    onChange({ ...side, typeOverride: second === '' || second === first ? [first] : [first, second] });

  const setPoints = (key: StatKey, value: number) => setIndividual({ ...individual, statPoints: setStatPoint(individual.statPoints, key, value) });
  const setRank = (key: keyof Ranks, value: number) => onChange({ ...side, ranks: { ...side.ranks, [key]: value } });

  const displayName = (saved: Individual) => {
    const name = data.pokemon.get(saved.speciesId)?.name ?? '不明なポケモン';
    return saved.nickname ? `${saved.nickname}(${name})` : name;
  };
  // データにあるポケモンの個体だけを、呼び出しの候補にする
  const loadable = savedIndividuals.filter((saved) => data.pokemon.has(saved.speciesId));
  const maxHp = battler.stats.hp;
  const currentHp = Math.max(1, Math.floor((maxHp * side.hpPercent) / 100));

  /** 能力1つぶんの行: 名前、実数値、能力ポイントの増減 */
  const statRow = (key: StatKey) => (
    <div className="calc-row" key={key}>
      <span className="calc-label">{STAT_LABELS[key]}</span>
      <output className="calc-value">{battler.stats[key]}</output>
      <span className="calc-sub">能力P</span>
      <Stepper
        label={`${title}の${STAT_LABELS[key]}の能力ポイント`}
        value={individual.statPoints[key]}
        min={0}
        max={maxStatPointsFor(individual.statPoints, key)}
        onChange={(value) => setPoints(key, value)}
      />
    </div>
  );

  return (
    <section className="card combatant" data-role={role}>
      <div className="card-heading">
        <h2>{title}</h2>
        {loadable.length > 0 && (
          <select
            className="field-control combatant-load"
            aria-label={`${title}に、保存した個体を呼び出す`}
            value={side.sourceId ?? NONE}
            onChange={(event) => {
              const saved = loadable.find((candidate) => candidate.id === event.target.value);
              if (saved) onChange({ ...makeSide(saved, saved.id), gimmickOn: hasGimmick(saved) });
            }}
          >
            <option value={NONE} disabled>
              保存した個体から呼ぶ
            </option>
            {loadable.map((saved) => (
              <option key={saved.id} value={saved.id}>
                {displayName(saved)}
              </option>
            ))}
          </select>
        )}
      </div>
      {side.sourceId && <p className="field-hint">呼び出した個体をここで変えても、保存した個体は変わりません。</p>}

      <PokemonPicker label="ポケモン" data={data} value={individual.speciesId} onChange={(id) => setIndividual(changeSpecies(individual, id, data))} />

      <div className="summary">
        <div className="summary-head">
          <span className="summary-name">{battler.form.name}</span>
          {/* タイプの表示をタップすると、タイプを変える欄が開く */}
          <button
            type="button"
            className="type-button"
            aria-expanded={isEditingTypes}
            aria-label={`${title}のタイプを変える`}
            onClick={() => setIsEditingTypes(!isEditingTypes)}
          >
            <TypeChips typeIds={battler.form.types} data={data} />
            <span className="type-button-hint">{side.typeOverride ? '変更中' : '変更'}</span>
          </button>
        </div>
        {isEditingTypes && (
          <div className="type-editor">
            <div className="field-grid">
              <SelectField label="タイプ1" value={type1} options={typeOptions} onChange={(value) => setTypes(value, type2)} />
              <SelectField
                label="タイプ2"
                value={type2}
                options={[{ value: '', label: 'なし' }, ...typeOptions]}
                onChange={(value) => setTypes(type1, value)}
              />
            </div>
            <p className="field-hint">
              特性や技でタイプが変わった場面を計算できます。受けるときの相性と、タイプ一致の両方に使います。
            </p>
            <div className="row-actions">
              <button type="button" className="button-quiet" disabled={!side.typeOverride} onClick={() => onChange({ ...side, typeOverride: null })}>
                元のタイプに戻す
              </button>
              <button type="button" className="button-quiet" onClick={() => setIsEditingTypes(false)}>
                閉じる
              </button>
            </div>
          </div>
        )}
        <p className="summary-sub" aria-label="種族値">
          種族値 {STAT_KEYS.map((key) => battler.form.baseStats[key]).join(' - ')}
        </p>
      </div>

      {gimmickIds.map((id) => {
        const GimmickEditor = gimmickEditors[id];
        return <GimmickEditor key={id} individual={individual} species={species} data={data} onChange={setIndividual} />;
      })}
      {activeGimmickId && (
        <label className="check">
          <input type="checkbox" checked={side.gimmickOn} onChange={(event) => onChange({ ...side, gimmickOn: event.target.checked })} />
          {gimmickRegistry[activeGimmickId].label}した姿で計算する
        </label>
      )}

      {afterPokemon}

      {/* 計算に使う能力だけを出す。防御側は HP も使う */}
      <div className="calc-rows">
        {role === 'defender' && statRow('hp')}
        {statRow(statKey)}
        <div className="calc-row">
          <span className="calc-label">性格補正</span>
          <Segmented
            label={`${title}の${STAT_LABELS[statKey]}の性格補正`}
            value={natureEffectOn(nature, statKey)}
            options={NATURE_OPTIONS}
            onChange={(effect: NatureEffect) => {
              const next = natureForEffect([...data.natures.values()], nature, statKey, effect);
              if (next) setIndividual(changeNature(individual, next.id, data));
            }}
          />
          <span className="calc-sub calc-nature">{nature.name}</span>
        </div>
        <div className="calc-row">
          <span className="calc-label">ランク補正</span>
          <Stepper
            label={`${title}の${STAT_LABELS[statKey]}のランク補正`}
            value={side.ranks[statKey]}
            min={-6}
            max={6}
            format={formatRank}
            onChange={(value) => setRank(statKey, value)}
          />
          <span className="calc-sub">能力Pの残り {remainingStatPoints(individual.statPoints)}</span>
        </div>
      </div>

      <div className="field-grid">
        <SelectField
          label="特性"
          value={individual.abilityId}
          options={species.abilities.map((id) => ({ value: id, label: data.abilities.get(id)?.name ?? id }))}
          onChange={(value) => setIndividual(changeAbility(individual, value, data))}
          hint={battler.form.abilityId !== individual.abilityId ? `いまの姿では「${data.abilities.get(battler.form.abilityId)?.name ?? battler.form.abilityId}」` : undefined}
        />
        <SelectField
          label="持ち物"
          value={individual.itemId ?? ''}
          options={[{ value: '', label: 'なし' }]}
          groups={itemGroups(selectableItems(species, data))}
          onChange={(value) => setIndividual(changeItem(individual, value === '' ? null : value, data))}
        />
      </div>

      <div className="conditions">
        <p className="conditions-title">{role === 'attacker' ? '威力が上がる・下がる条件' : 'ダメージが減る・増える条件'}</p>
        <div className="check-grid">{children}</div>
        <div className="field-grid">
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
      </div>

      {/* details は、タップで開いたり閉じたりできる部品。ふだん使わない設定をたたんでおく */}
      <details className="fold">
        <summary>すべての能力ポイントとランクを変える</summary>
        <div className="fold-body">
          <StatPointsEditor
            statPoints={individual.statPoints}
            nature={nature}
            columns={[{ label: '実数値', baseStats: battler.form.baseStats, stats: battler.stats }]}
            onChange={(statPoints) => setIndividual({ ...individual, statPoints })}
          />
          <div className="calc-rows">
            {(['atk', 'def', 'spa', 'spd', 'spe'] as const).map((key) => (
              <div className="calc-row" key={key}>
                <span className="calc-label">{STAT_LABELS[key]}</span>
                <span className="calc-sub">ランク</span>
                <Stepper
                  label={`${title}の${STAT_LABELS[key]}のランク`}
                  value={side.ranks[key]}
                  min={-6}
                  max={6}
                  format={formatRank}
                  onChange={(value) => setRank(key, value)}
                />
              </div>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}
