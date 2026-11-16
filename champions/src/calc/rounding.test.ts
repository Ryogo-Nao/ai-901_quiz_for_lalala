// 丸めと補正のテスト。

import { describe, expect, it } from 'vitest';
import { applyMod, applyRank, chainMods } from './rounding.ts';

describe('applyMod: 補正を掛けて五捨五超入する', () => {
  it('小数部分が 0.5 ちょうどは切り捨て: 101 × 1.5 = 151.5 → 151', () => {
    expect(applyMod(101, 6144)).toBe(151);
  });
  it('小数部分が 0.5 より大きければ切り上げ: 10 × 5325/4096 = 13.0005 → 13、7 × 0.75 = 5.25 → 5、11 × 0.75 = 8.25 → 8', () => {
    expect(applyMod(10, 5325)).toBe(13);
    expect(applyMod(7, 3072)).toBe(5);
    expect(applyMod(11, 3072)).toBe(8);
  });
  it('0.75 より大きい端数は切り上げ: 3 × 0.75 = 2.25 → 2、5 × 0.75 = 3.75 → 4', () => {
    expect(applyMod(3, 3072)).toBe(2);
    expect(applyMod(5, 3072)).toBe(4);
  });
  it('1.0 倍なら変わらない', () => {
    expect(applyMod(123, 4096)).toBe(123);
  });
  it('小数で計算した五捨五超入と、広い範囲で一致する', () => {
    const reference = (x: number) => (x % 1 > 0.5 ? Math.ceil(x) : Math.floor(x));
    for (const mod of [2048, 2732, 3072, 4915, 5324, 5325, 6144, 8192]) {
      for (let value = 0; value <= 2000; value++) {
        expect(applyMod(value, mod), `${value} × ${mod}`).toBe(reference((value * mod) / 4096));
      }
    }
  });
});

describe('chainMods: 補正を1つにまとめる', () => {
  it('補正が無ければ 4096(1.0倍)', () => {
    expect(chainMods([])).toBe(4096);
  });
  it('1.5 倍 × 1.5 倍 = 2.25 倍(9216)', () => {
    expect(chainMods([6144, 6144])).toBe(9216);
  });
  it('単純な掛け算と違う結果になる例: 5325 × 5325 → 6923(単純に掛けると 6922.9…)', () => {
    expect(chainMods([5325, 5325])).toBe(6923);
  });
  it('0.5 倍 × 1.3 倍', () => {
    expect(chainMods([2048, 5325])).toBe(2663); // (2048 × 5325 + 2048) ÷ 4096 = 2663.0 → 2663
  });
});

describe('applyRank: ランク補正', () => {
  it('0 なら変わらない', () => {
    expect(applyRank(182, 0)).toBe(182);
  });
  it('+1 は 1.5 倍、+2 は 2 倍、+6 は 4 倍', () => {
    expect(applyRank(182, 1)).toBe(273);
    expect(applyRank(182, 2)).toBe(364);
    expect(applyRank(182, 6)).toBe(728);
  });
  it('-1 は 2/3 倍(切り捨て)、-2 は 1/2 倍、-6 は 1/4 倍', () => {
    expect(applyRank(182, -1)).toBe(121); // 121.33…
    expect(applyRank(182, -2)).toBe(91);
    expect(applyRank(182, -6)).toBe(45); // 45.5
  });
  it('範囲の外は -6〜+6 に収める', () => {
    expect(applyRank(100, 9)).toBe(400);
    expect(applyRank(100, -9)).toBe(25);
  });
});
