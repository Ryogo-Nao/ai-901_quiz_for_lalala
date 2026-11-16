// 場に出たときのダメージ(ステルスロック、まきびし)のテスト。

import { describe, expect, it } from 'vitest';
import { masterData } from '../data/index.ts';
import { calcHazardDamage, type HazardTarget } from './hazards.ts';

const chart = masterData.typeEffectiveness;
const target = (overrides: Partial<HazardTarget>): HazardTarget => ({ maxHp: 183, types: ['ground'], abilityId: 'sandstream', itemId: null, ...overrides });
const rock = (overrides: Partial<HazardTarget>) => calcHazardDamage(target(overrides), { stealthRock: true, spikes: 0 }, chart).stealthRock;
const spikes = (layers: number, overrides: Partial<HazardTarget> = {}) =>
  calcHazardDamage(target(overrides), { stealthRock: false, spikes: layers }, chart).spikes;

describe('ステルスロック: 最大HP × いわの相性 ÷ 8', () => {
  it('等倍(ドラゴン): 183 ÷ 8 = 22.875 → 22', () => {
    expect(rock({ types: ['dragon'] })).toBe(22);
  });
  it('いまひとつ(じめん): 183 ÷ 16 = 11.4 → 11', () => {
    expect(rock({ types: ['ground'] })).toBe(11);
  });
  it('ばつぐん(ほのお): 183 ÷ 4 = 45.75 → 45', () => {
    expect(rock({ types: ['fire'] })).toBe(45);
  });
  it('4倍(ほのお・ひこう): 153 ÷ 2 = 76.5 → 76', () => {
    expect(rock({ maxHp: 153, types: ['fire', 'flying'] })).toBe(76);
  });
  it('4分の1(はがね・じめん): 183 ÷ 32 = 5.7 → 5', () => {
    expect(rock({ types: ['steel', 'ground'] })).toBe(5);
  });
  it('ふゆう や ひこうタイプ でも受ける', () => {
    expect(rock({ types: ['electric'], abilityId: 'levitate' })).toBe(22);
  });
  it('最低 1 ダメージ', () => {
    expect(rock({ maxHp: 1, types: ['normal'] })).toBe(1);
  });
});

describe('まきびし: 1回 1/8、2回 1/6、3回 1/4', () => {
  it('183 のとき、22 / 30 / 45', () => {
    expect(spikes(1)).toBe(22); // 22.875
    expect(spikes(2)).toBe(30); // 30.5
    expect(spikes(3)).toBe(45); // 45.75
  });
  it('まいていなければ 0', () => {
    expect(spikes(0)).toBe(0);
  });
  it('ひこうタイプ・ふゆう・ふうせん は受けない', () => {
    expect(spikes(3, { types: ['dragon', 'flying'] })).toBe(0);
    expect(spikes(3, { abilityId: 'levitate' })).toBe(0);
    expect(spikes(3, { itemId: 'airballoon' })).toBe(0);
  });
  it('くろいてっきゅう を持つと、ひこうタイプでも受ける', () => {
    expect(spikes(1, { types: ['dragon', 'flying'], itemId: 'ironball' })).toBe(22);
  });
  it('ぶきよう で ふうせん の効果が無いと、受ける', () => {
    expect(spikes(1, { abilityId: 'klutz', itemId: 'airballoon' })).toBe(22);
  });
});

describe('合計と例外', () => {
  it('両方あるときは合計する(カバルドン HP 183: ステルスロック 11 + まきびし3回 45 = 56)', () => {
    expect(calcHazardDamage(target({}), { stealthRock: true, spikes: 3 }, chart)).toEqual({ stealthRock: 11, spikes: 45, total: 56 });
  });
  it('マジックガード は、どちらも受けない', () => {
    expect(calcHazardDamage(target({ abilityId: 'magicguard' }), { stealthRock: true, spikes: 3 }, chart).total).toBe(0);
  });
});
