// 「能力」に関する基本の形。アプリ全体で、能力の名前はこの6つに統一する。

/** 能力の名前の一覧。この順番で画面にも並べる */
export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

/**
 * 能力の名前の型。'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe' のどれか。
 * (typeof STAT_KEYS)[number] は「上の配列の中身のどれか」という意味。
 * こう書くと、配列に書いた名前と型がずれない。
 */
export type StatKey = (typeof STAT_KEYS)[number];

/**
 * 6つの能力それぞれに数値を1つずつ持つ表。
 * 種族値、能力ポイント、実数値はどれもこの形で表す。
 */
export type StatTable = Record<StatKey, number>;

/** 画面に出す日本語の名前 */
export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  atk: 'こうげき',
  def: 'ぼうぎょ',
  spa: 'とくこう',
  spd: 'とくぼう',
  spe: 'すばやさ',
};

/** 6つの能力すべてが同じ値の表を作る。例: filledStatTable(0) → すべて 0 */
export function filledStatTable(value: number): StatTable {
  return { hp: value, atk: value, def: value, spa: value, spd: value, spe: value };
}
