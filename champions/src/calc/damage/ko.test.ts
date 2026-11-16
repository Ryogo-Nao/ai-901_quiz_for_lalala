// 確定数のテスト。

import { describe, expect, it } from 'vitest';
import { calcKo, formatKo } from './ko.ts';

/** 16通りすべてが同じダメージ */
const flat = (damage: number) => Array.from({ length: 16 }, () => damage);

describe('calcKo', () => {
  it('最小ダメージでも倒せるなら「確定1発」', () => {
    expect(calcKo(flat(100), 100)).toEqual({ hits: 1, chance: 1, isGuaranteed: true });
  });

  it('16通りのうち6通りで倒せるなら「乱数1発(37.5%)」', () => {
    // ガブリアスのじしん → メタグロス(HP 155)の実際の値。155 以上は 156, 156, 158, 158, 162, 164 の6通り
    const rolls = [138, 140, 140, 144, 144, 146, 150, 150, 152, 152, 156, 156, 158, 158, 162, 164];
    const ko = calcKo(rolls, 155);
    expect(ko?.hits).toBe(1);
    expect(ko?.isGuaranteed).toBe(false);
    expect(ko?.chance).toBeCloseTo(6 / 16);
    expect(formatKo(ko)).toBe('乱数1発(37.5%)');
  });

  it('2発の合計で考える: 50 が16通りなら HP 100 は確定2発', () => {
    expect(calcKo(flat(50), 100)).toEqual({ hits: 2, chance: 1, isGuaranteed: true });
  });

  it('2発の組み合わせの確率: ダメージが 40 と 60 の半々で HP 100 なら、2発で倒せるのは 4通り中 3通り', () => {
    // 40+40=80 (倒せない)、40+60、60+40、60+60 (倒せる) → 75%
    const rolls = [...Array.from({ length: 8 }, () => 40), ...Array.from({ length: 8 }, () => 60)];
    const ko = calcKo(rolls, 100);
    expect(ko?.hits).toBe(2);
    expect(ko?.chance).toBeCloseTo(0.75);
    expect(formatKo(ko)).toBe('乱数2発(75.0%)');
  });

  it('ダメージが 0 なら null', () => {
    expect(calcKo(flat(0), 100)).toBeNull();
  });

  it('10発でも倒せないなら null', () => {
    expect(calcKo(flat(1), 100)).toBeNull();
    expect(formatKo(null)).toBe('10発では倒せない');
  });

  it('ちょうど10発で倒せる', () => {
    expect(calcKo(flat(10), 100)?.hits).toBe(10);
  });
});

describe('formatKo', () => {
  it('確定', () => {
    expect(formatKo({ hits: 3, chance: 1, isGuaranteed: true })).toBe('確定3発');
  });
  it('とても低い確率でも 0.0% とは出さない', () => {
    expect(formatKo({ hits: 2, chance: 0.0001, isGuaranteed: false })).toBe('乱数2発(0.1%)');
  });
  it('とても高い確率でも 100.0% とは出さない(確定ではないため)', () => {
    expect(formatKo({ hits: 2, chance: 0.9999, isGuaranteed: false })).toBe('乱数2発(99.9%)');
  });
});
