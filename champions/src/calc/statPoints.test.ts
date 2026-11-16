// 能力ポイントの決まり(合計66まで、1つの能力に32まで)のテスト。

import { describe, expect, it } from 'vitest';
import { filledStatTable } from '../domain/stats.ts';
import {
  isValidStatPoints,
  maxStatPointsFor,
  remainingStatPoints,
  setStatPoint,
  totalStatPoints,
} from './statPoints.ts';

const EMPTY = filledStatTable(0);

describe('合計と残り', () => {
  it('何も振っていなければ、合計 0・残り 66', () => {
    expect(totalStatPoints(EMPTY)).toBe(0);
    expect(remainingStatPoints(EMPTY)).toBe(66);
  });
  it('HP 2・こうげき 32・すばやさ 32 なら、合計 66・残り 0', () => {
    const points = { ...EMPTY, hp: 2, atk: 32, spe: 32 };
    expect(totalStatPoints(points)).toBe(66);
    expect(remainingStatPoints(points)).toBe(0);
  });
});

describe('maxStatPointsFor: その能力に最大いくつまで振れるか', () => {
  it('残りが十分あれば 32', () => {
    expect(maxStatPointsFor(EMPTY, 'atk')).toBe(32);
  });
  it('残りが少なければ、いまの値 + 残り まで', () => {
    // 合計 60 → 残り 6。ぼうぎょ(いま 0)は 6 まで、こうげき(いま 30)は 32 まで
    const points = { ...EMPTY, atk: 30, spe: 30 };
    expect(maxStatPointsFor(points, 'def')).toBe(6);
    expect(maxStatPointsFor(points, 'atk')).toBe(32);
  });
  it('残りが 0 なら、いまの値より増やせない', () => {
    const points = { ...EMPTY, hp: 2, atk: 32, spe: 32 };
    expect(maxStatPointsFor(points, 'def')).toBe(0);
    expect(maxStatPointsFor(points, 'hp')).toBe(2);
  });
});

describe('setStatPoint: 上限を超える値は入らない', () => {
  it('ふつうの値はそのまま入る', () => {
    expect(setStatPoint(EMPTY, 'atk', 20).atk).toBe(20);
  });
  it('33 を入れようとしても 32 になる(1つの能力に32まで)', () => {
    expect(setStatPoint(EMPTY, 'atk', 33).atk).toBe(32);
  });
  it('合計が 66 を超える分は入らない', () => {
    const points = { ...EMPTY, atk: 32, spe: 32 }; // 合計 64 → 残り 2
    const changed = setStatPoint(points, 'hp', 10);
    expect(changed.hp).toBe(2);
    expect(totalStatPoints(changed)).toBe(66);
  });
  it('合計がちょうど 66 のとき、ほかの能力は増やせない', () => {
    const points = { ...EMPTY, hp: 2, atk: 32, spe: 32 };
    expect(setStatPoint(points, 'def', 1).def).toBe(0);
  });
  it('減らすことはいつでもできる', () => {
    const points = { ...EMPTY, hp: 2, atk: 32, spe: 32 };
    expect(setStatPoint(points, 'atk', 10).atk).toBe(10);
  });
  it('0 未満は 0、小数は切り捨て、数値でないものは 0', () => {
    expect(setStatPoint(EMPTY, 'atk', -5).atk).toBe(0);
    expect(setStatPoint(EMPTY, 'atk', 7.9).atk).toBe(7);
    expect(setStatPoint(EMPTY, 'atk', Number.NaN).atk).toBe(0);
  });
  it('元の表は書き換えない(新しい表を返す)', () => {
    const before = { ...EMPTY };
    setStatPoint(before, 'atk', 20);
    expect(before.atk).toBe(0);
  });
});

describe('isValidStatPoints: 決まりを守っているか', () => {
  it('合計 66 ちょうどは OK', () => {
    expect(isValidStatPoints({ ...EMPTY, hp: 2, atk: 32, spe: 32 })).toBe(true);
  });
  it('1つの能力が 33 は NG', () => {
    expect(isValidStatPoints({ ...EMPTY, atk: 33 })).toBe(false);
  });
  it('合計 67 は NG', () => {
    expect(isValidStatPoints({ ...EMPTY, hp: 3, atk: 32, spe: 32 })).toBe(false);
  });
  it('マイナスや小数は NG', () => {
    expect(isValidStatPoints({ ...EMPTY, atk: -1 })).toBe(false);
    expect(isValidStatPoints({ ...EMPTY, atk: 1.5 })).toBe(false);
  });
});
