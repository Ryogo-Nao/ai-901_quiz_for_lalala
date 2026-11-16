// 能力ポイントの入力欄と、実数値の表示。
//
// この部品は「表示」と「入力の受け取り」だけを担当する。
// 上限の決まりは calc/statPoints.ts、実数値の式は calc/stats.ts にあり、ここには書かない。

import type { CSSProperties } from 'react';
import { type NatureModifier, natureEffectOn } from '../../calc/stats.ts';
import { maxStatPointsFor, remainingStatPoints, setStatPoint, totalStatPoints } from '../../calc/statPoints.ts';
import { MAX_STAT_POINTS_PER_STAT, MAX_TOTAL_STAT_POINTS } from '../../domain/limits.ts';
import { STAT_KEYS, STAT_LABELS, filledStatTable, type StatTable } from '../../domain/stats.ts';

/** 実数値の列1つ分(「実数値」「メガシンカ後」など) */
export interface StatColumn {
  /** 列の見出し */
  label: string;
  /** その姿の種族値 */
  baseStats: StatTable;
  /** その姿の実数値 */
  stats: StatTable;
}

interface Props {
  statPoints: StatTable;
  nature: NatureModifier;
  /** 表示する実数値の列。1つ目がふだんの姿 */
  columns: StatColumn[];
  /** 能力ポイントが変わったとき、変更後の表を渡して呼ぶ関数 */
  onChange: (next: StatTable) => void;
}

const NATURE_MARKS = { up: '↑', down: '↓', neutral: '' } as const;

export default function StatPointsEditor({ statPoints, nature, columns, onChange }: Props) {
  const used = totalStatPoints(statPoints);
  const remaining = remainingStatPoints(statPoints);

  return (
    <section className="card">
      <div className="card-heading">
        <h2>能力ポイント</h2>
        <button type="button" className="button-quiet" disabled={used === 0} onClick={() => onChange(filledStatTable(0))}>
          すべて0に戻す
        </button>
      </div>

      {/* 残りポイント。aria-live を付けると、値が変わったとき読み上げソフトが読んでくれる */}
      <div className="points-summary" aria-live="polite">
        <span className="points-remaining">
          残り <strong>{remaining}</strong>
        </span>
        <span className="points-used">
          {used} / {MAX_TOTAL_STAT_POINTS} 使用
        </span>
        <progress className="points-bar" value={used} max={MAX_TOTAL_STAT_POINTS} />
      </div>

      {/* 実数値の列の数を CSS に伝える(列の数に合わせて幅を決めるため) */}
      <div className="stat-table" style={{ '--value-columns': columns.length } as CSSProperties}>
        <div className="stat-row stat-row-header">
          <span>能力・種族値</span>
          <span className="stat-points-header">ポイント</span>
          {columns.map((column) => (
            <span key={column.label} className="stat-value-header">
              {column.label}
            </span>
          ))}
        </div>

        {STAT_KEYS.map((key) => {
          const effect = natureEffectOn(nature, key);
          const max = maxStatPointsFor(statPoints, key);
          const value = statPoints[key];
          // 決まりは setStatPoint が守る。ここでは「希望の値」を渡すだけ
          const change = (requested: number) => onChange(setStatPoint(statPoints, key, requested));
          const baseStats = columns.map((column) => column.baseStats[key]);
          const baseText = baseStats.every((base) => base === baseStats[0]) ? `${baseStats[0]}` : baseStats.join(' → ');

          return (
            <div className="stat-row" key={key} data-nature={effect}>
              <div className="stat-name">
                <span className="stat-label">
                  {STAT_LABELS[key]}
                  {effect !== 'neutral' && (
                    <span className="stat-nature-mark" title={effect === 'up' ? '性格で上がる' : '性格で下がる'}>
                      {NATURE_MARKS[effect]}
                    </span>
                  )}
                </span>
                <span className="stat-base">{baseText}</span>
              </div>

              <div className="stat-stepper">
                <button
                  type="button"
                  className="stepper-button"
                  aria-label={`${STAT_LABELS[key]}を1減らす`}
                  disabled={value <= 0}
                  onClick={() => change(value - 1)}
                >
                  −
                </button>
                <input
                  className="stepper-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={max}
                  aria-label={`${STAT_LABELS[key]}の能力ポイント`}
                  value={value}
                  onChange={(event) => change(Number(event.target.value))}
                  onFocus={(event) => event.target.select()}
                />
                <button
                  type="button"
                  className="stepper-button"
                  aria-label={`${STAT_LABELS[key]}を1増やす`}
                  disabled={value >= max}
                  onClick={() => change(value + 1)}
                >
                  +
                </button>
              </div>

              {columns.map((column, index) => (
                <output key={column.label} className={index === 0 ? 'stat-value' : 'stat-value stat-value-alt'}>
                  {column.stats[key]}
                </output>
              ))}

              <input
                className="stat-slider"
                type="range"
                min={0}
                max={MAX_STAT_POINTS_PER_STAT}
                aria-label={`${STAT_LABELS[key]}の能力ポイント(スライダー)`}
                value={value}
                onChange={(event) => change(Number(event.target.value))}
              />
            </div>
          );
        })}
      </div>

      <p className="field-hint">
        1つの能力に{MAX_STAT_POINTS_PER_STAT}まで、合計{MAX_TOTAL_STAT_POINTS}まで。上限を超える値は入りません。
      </p>
    </section>
  );
}
