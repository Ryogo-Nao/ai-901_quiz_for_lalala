// ダメージ計算の画面。
//
// この画面は「入力を集めて、calcDamage を呼び、結果を表示する」だけ。
// 計算の決まりは src/calc/damage/ にあり、ここには書かない。

import { useEffect, useState } from 'react';
import {
  TERRAIN_LABELS,
  WEATHER_LABELS,
  makeCombatant,
  type Combatant,
  type DamageConditions,
  type TerrainId,
  type WeatherId,
} from '../../calc/damage/context.ts';
import { calcKoMultiHit, formatKo } from '../../calc/damage/ko.ts';
import { calcDamage, type DamageResult } from '../../calc/damage/pipeline.ts';
import { UNSUPPORTED_ABILITY_IDS } from '../../calc/damage/rules/index.ts';
import SelectField from '../../components/SelectField.tsx';
import TypeChips from '../../components/TypeChips.tsx';
import type { MasterData, MoveData, RegulationData } from '../../data/index.ts';
import { requireSpecies } from '../../domain/editIndividual.ts';
import type { Individual } from '../../domain/individual.ts';
import { usableGimmickIds } from '../../gimmicks/registry.ts';
import { listIndividuals } from '../../storage/individuals.ts';
import { categoryLabel, powerLabel } from '../individuals/labels.ts';
import CombatantPanel from './CombatantPanel.tsx';
import './damage.css';
import type { DamageState, SideState } from './state.ts';

interface Props {
  data: MasterData;
  regulation: RegulationData;
  /** 画面の一時データ。ほかの画面へ切り替えても消えないよう、App が持っている */
  state: DamageState;
  onChange: (next: DamageState) => void;
}

/** 技が、ダブルバトルで複数の相手に当たる技か */
const hitsSeveralTargets = (move: MoveData) => move.target === 'allAdjacent' || move.target === 'allAdjacentFoes';

/** 連続技で選べる回数。連続技でなければ [1] */
function hitCountOptions(move: MoveData): number[] {
  if (move.multihit === undefined) return [1];
  if (typeof move.multihit === 'number') return [move.multihit];
  const [min, max] = move.multihit;
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

const percent = (value: number) => `${(Math.floor(value * 10) / 10).toFixed(1)}%`;

export default function DamagePage({ data, regulation, state, onChange }: Props) {
  // 保存してある個体(呼び出しの候補)。読み込めなくても、この画面で作って計算はできる
  const [savedIndividuals, setSavedIndividuals] = useState<Individual[]>([]);
  useEffect(() => {
    let cancelled = false;
    listIndividuals()
      .then((list) => {
        if (!cancelled) setSavedIndividuals(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { attacker, defender, conditions } = state;

  /** 一時データから、計算に渡す「戦っているポケモン」を作る */
  const toCombatant = (side: SideState): Combatant => {
    const species = requireSpecies(data, side.individual.speciesId);
    const gimmickId = usableGimmickIds(regulation, species).find((id) => side.individual.gimmicks[id] !== undefined);
    const combatant = makeCombatant(side.individual, side.gimmickOn && gimmickId ? gimmickId : null, data, {
      ranks: side.ranks,
      status: side.status,
    });
    return { ...combatant, currentHp: Math.max(1, Math.floor((combatant.battler.stats.hp * side.hpPercent) / 100)) };
  };
  const attackerCombatant = toCombatant(attacker);
  const defenderCombatant = toCombatant(defender);

  // ----- 技の候補: 個体に覚えさせている技を先に、そのほかの覚える技をあとに並べる -----
  const attackerSpecies = requireSpecies(data, attacker.individual.speciesId);
  const toMoves = (ids: readonly (string | null)[]) =>
    ids.map((id) => (id ? data.moves.get(id) : undefined)).filter((move) => move !== undefined);
  const ownMoves = toMoves(attacker.individual.moveIds);
  const otherMoves = toMoves(attackerSpecies.learnset.filter((id) => !attacker.individual.moveIds.includes(id))).sort((a, b) =>
    a.name.localeCompare(b.name, 'ja'),
  );
  // 選んでいた技を、いまのポケモンが覚えないなら、1つ目の技に切り替える
  const move =
    (state.moveId && attackerSpecies.learnset.includes(state.moveId) ? data.moves.get(state.moveId) : undefined) ??
    ownMoves.find((candidate) => candidate.category !== 'status') ??
    ownMoves[0] ??
    otherMoves.find((candidate) => candidate.category !== 'status');

  // ----- 計算 -----
  const canSpread = move !== undefined && conditions.isDoubles && hitsSeveralTargets(move);
  const hitOptions = move ? hitCountOptions(move) : [1];
  const hitCount = hitOptions.includes(state.multiHitCount) ? state.multiHitCount : hitOptions[0];

  let results: DamageResult[] = [];
  let errorMessage: string | null = null;
  if (move) {
    try {
      // 連続技は、1回ずつ計算する(回数で威力が変わる技や、1回目だけ効く補正があるため)
      results = Array.from({ length: hitCount }, (_, index) =>
        calcDamage({
          attacker: attackerCombatant,
          defender: defenderCombatant,
          move,
          conditions: { ...conditions, isSpread: canSpread && state.spreadEnabled, hit: index + 1 },
          data,
        }),
      );
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '計算できませんでした';
    }
  }
  const first = results[0];
  const totalMin = results.reduce((sum, result) => sum + result.min, 0);
  const totalMax = results.reduce((sum, result) => sum + result.max, 0);
  const maxHp = defenderCombatant.battler.stats.hp;
  const ko = first && !first.stop ? calcKoMultiHit(results.map((result) => result.rolls), defenderCombatant.currentHp) : null;

  // ----- 注意書き -----
  const notes = [...(first?.notes ?? [])];
  for (const [label, combatant] of [['攻撃側', attackerCombatant], ['防御側', defenderCombatant]] as const) {
    const abilityId = combatant.battler.form.abilityId;
    if (UNSUPPORTED_ABILITY_IDS.has(abilityId)) {
      notes.push(`${label}の特性「${data.abilities.get(abilityId)?.name ?? abilityId}」の補正は、計算に入っていません`);
    }
  }

  const setConditions = (patch: Partial<DamageConditions>) => onChange({ ...state, conditions: { ...conditions, ...patch } });
  const check = (label: string, checked: boolean, onToggle: (value: boolean) => void, disabled = false) => (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onToggle(event.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="damage-page">
      <div className="damage-columns">
        <CombatantPanel
          title="攻撃側"
          data={data}
          regulation={regulation}
          side={attacker}
          battler={attackerCombatant.battler}
          savedIndividuals={savedIndividuals}
          mainRankKeys={['atk', 'spa']}
          onChange={(next) => onChange({ ...state, attacker: next })}
        />

        <div className="damage-middle">
          <section className="card">
            <div className="card-heading">
              <h2>技と条件</h2>
              <button
                type="button"
                className="button-quiet"
                onClick={() => onChange({ ...state, attacker: defender, defender: attacker, moveId: null })}
              >
                ⇅ 攻守を入れ替える
              </button>
            </div>

            <SelectField
              label="技"
              value={move?.id ?? ''}
              groups={[
                { label: 'この個体の技', options: ownMoves.map((candidate) => ({ value: candidate.id, label: candidate.name })) },
                { label: 'そのほかの覚える技', options: otherMoves.map((candidate) => ({ value: candidate.id, label: candidate.name })) },
              ].filter((group) => group.options.length > 0)}
              onChange={(value) => onChange({ ...state, moveId: value })}
            />
            {move && (
              <p className="move-detail">
                <TypeChips typeIds={[first?.detail.move.type ?? move.type]} data={data} />
                <span>{categoryLabel(move)}</span>
                <span>
                  威力 <strong>{first && first.detail.power > 0 ? first.detail.power : powerLabel(move)}</strong>
                </span>
              </p>
            )}
            {hitOptions.length > 1 && (
              <SelectField
                label="当たる回数"
                value={String(hitCount)}
                options={hitOptions.map((count) => ({ value: String(count), label: `${count}回` }))}
                onChange={(value) => onChange({ ...state, multiHitCount: Number(value) })}
              />
            )}

            <div className="check-grid">
              {check('急所', conditions.isCritical, (value) => setConditions({ isCritical: value }))}
              {check('ダブルバトル', conditions.isDoubles, (value) => setConditions({ isDoubles: value }))}
              {check('範囲技として当てる(0.75倍)', canSpread && state.spreadEnabled, (value) => onChange({ ...state, spreadEnabled: value }), !canSpread)}
              {check('てだすけ', conditions.helpingHand, (value) => setConditions({ helpingHand: value }))}
              {check('リフレクター', conditions.reflect, (value) => setConditions({ reflect: value }))}
              {check('ひかりのかべ', conditions.lightScreen, (value) => setConditions({ lightScreen: value }))}
              {check('オーロラベール', conditions.auroraVeil, (value) => setConditions({ auroraVeil: value }))}
            </div>

            <div className="field-grid">
              <SelectField
                label="天気"
                value={conditions.weather ?? ''}
                options={[
                  { value: '', label: 'なし' },
                  ...(Object.keys(WEATHER_LABELS) as WeatherId[]).map((id) => ({ value: id, label: WEATHER_LABELS[id] })),
                ]}
                onChange={(value) => setConditions({ weather: value === '' ? null : (value as WeatherId) })}
              />
              <SelectField
                label="フィールド"
                value={conditions.terrain ?? ''}
                options={[
                  { value: '', label: 'なし' },
                  ...(Object.keys(TERRAIN_LABELS) as TerrainId[]).map((id) => ({ value: id, label: TERRAIN_LABELS[id] })),
                ]}
                onChange={(value) => setConditions({ terrain: value === '' ? null : (value as TerrainId) })}
              />
            </div>
          </section>
        </div>

        <CombatantPanel
          title="防御側"
          data={data}
          regulation={regulation}
          side={defender}
          battler={defenderCombatant.battler}
          savedIndividuals={savedIndividuals}
          mainRankKeys={['def', 'spd']}
          onChange={(next) => onChange({ ...state, defender: next })}
        />
      </div>

      {/* 結果。スマホでは画面の下に固定して、入力を変えながら常に見えるようにする */}
      <section className="result" aria-live="polite">
        {errorMessage ? (
          <p className="result-stop">{errorMessage}</p>
        ) : !move || !first ? (
          <p className="result-stop">技を選んでください</p>
        ) : first.stop ? (
          <p className="result-stop">{first.stop.label}</p>
        ) : (
          <>
            <p className="result-main">
              <span className="result-damage">
                {totalMin} 〜 {totalMax}
              </span>
              <span className="result-percent">
                {percent((totalMin / maxHp) * 100)} 〜 {percent((totalMax / maxHp) * 100)}
              </span>
              <span className="result-ko">{formatKo(ko)}</span>
            </p>
            <details className="result-details">
              <summary>
                {move.name}
                {hitCount > 1 ? `(${hitCount}回)` : ''} → {defenderCombatant.battler.form.name} の内訳
              </summary>
              <div className="result-body">
                {first.effectiveness !== 1 && <p>タイプ相性: × {first.effectiveness}</p>}
                {results.map((result, index) => (
                  <div key={index} className="result-hit">
                    {hitCount > 1 && <p className="result-hit-title">{index + 1}回目</p>}
                    <p>
                      威力 {result.detail.power} / 攻撃 {result.detail.attack} / 防御 {result.detail.defense}
                    </p>
                    <p className="result-rolls">{result.rolls.join(', ')}</p>
                    {result.detail.modifiers.length > 0 && (
                      <p>補正: {result.detail.modifiers.map((modifier) => modifier.label).join('、')}</p>
                    )}
                  </div>
                ))}
                <p>
                  相手のHP: {defenderCombatant.currentHp} / {maxHp}(割合は最大HPに対する値、確定数はいまのHPで計算)
                </p>
              </div>
            </details>
          </>
        )}
        {notes.length > 0 && (
          <ul className="result-notes">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
