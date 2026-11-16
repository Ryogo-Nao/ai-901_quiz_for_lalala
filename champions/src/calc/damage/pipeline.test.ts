// ダメージ計算の本体のテスト。手で計算した値と比べる。
// (手本の計算機との大量の突き合わせは crossCheck.test.ts)

import { describe, expect, it } from 'vitest';
import { masterData } from '../../data/index.ts';
import { changeNature } from '../../domain/editIndividual.ts';
import { createIndividual, type Individual } from '../../domain/individual.ts';
import { typeEffectiveness } from '../typeChart.ts';
import { DEFAULT_CONDITIONS, makeCombatant, type DamageContext } from './context.ts';
import { formatKo } from './ko.ts';
import { calcDamage } from './pipeline.ts';

/** ガブリアス / ようき / HP 2・こうげき 32・すばやさ 32 → こうげき 182 */
function garchomp(): Individual {
  const individual = changeNature(createIndividual('garchomp', 'roughskin'), 'jolly', masterData);
  return { ...individual, statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
}
/** メタグロス / がんばりや / ポイントなし → HP 155、ぼうぎょ 150 */
const metagross = () => createIndividual('metagross', 'clearbody');

function context(moveId: string, overrides: Partial<DamageContext> = {}): DamageContext {
  return {
    attacker: makeCombatant(garchomp(), null, masterData),
    defender: makeCombatant(metagross(), null, masterData),
    move: masterData.moves.get(moveId)!,
    conditions: DEFAULT_CONDITIONS,
    data: masterData,
    ...overrides,
  };
}

describe('例1: ガブリアスの じしん → メタグロス', () => {
  // 威力 100、こうげき 182、ぼうぎょ 150
  // 基礎ダメージ = floor(floor(22 × 100 × 182 ÷ 150) ÷ 50) + 2 = floor(2669 ÷ 50) + 2 = 53 + 2 = 55
  // 乱数 85 のとき:  floor(55 × 85 ÷ 100) = 46 → タイプ一致 46 × 1.5 = 69 → ばつぐん 69 × 2 = 138
  // 乱数 100 のとき: 55 → タイプ一致 55 × 1.5 = 82.5 → 82(五捨五超入) → ばつぐん 82 × 2 = 164
  const result = calcDamage(context('earthquake'));

  it('途中の値', () => {
    expect(result.detail.power).toBe(100);
    expect(result.detail.attack).toBe(182);
    expect(result.detail.defense).toBe(150);
    expect(result.detail.baseDamage).toBe(55);
    expect(result.effectiveness).toBe(2);
    expect(result.detail.modifiers.map((modifier) => modifier.label)).toEqual(['タイプ一致']);
  });

  it('16通りのダメージ', () => {
    expect(result.rolls).toEqual([138, 140, 140, 144, 144, 146, 150, 150, 152, 152, 156, 156, 158, 158, 162, 164]);
    expect(result.min).toBe(138);
    expect(result.max).toBe(164);
  });

  it('HPに対する割合: 138 ÷ 155 = 89.0%、164 ÷ 155 = 105.8%', () => {
    expect(result.minPercent).toBeCloseTo(89.03, 1);
    expect(result.maxPercent).toBeCloseTo(105.81, 1);
  });

  it('確定数: 乱数1発(37.5%)', () => {
    expect(formatKo(result.ko)).toBe('乱数1発(37.5%)');
  });
});

describe('条件による変化(同じ ガブリアスの じしん → メタグロス)', () => {
  it('急所: 基礎ダメージ 55 × 1.5 = 82.5 → 82。最大は 82 × 1.5 = 123 → × 2 = 246', () => {
    const result = calcDamage(context('earthquake', { conditions: { isCritical: true, isSpread: false } }));
    expect(result.max).toBe(246);
    expect(result.min).toBe(206); // floor(82 × 0.85) = 69 → 103.5 → 103 → 206
  });

  it('範囲技: 基礎ダメージ 55 × 0.75 = 41.25 → 41。最大は 41 × 1.5 = 61.5 → 61 → × 2 = 122', () => {
    const result = calcDamage(context('earthquake', { conditions: { isCritical: false, isSpread: true } }));
    expect(result.max).toBe(122);
  });

  it('やけど: 物理技は半分。最大 164 → 82', () => {
    const attacker = makeCombatant(garchomp(), null, masterData, { isBurned: true });
    expect(calcDamage(context('earthquake', { attacker })).max).toBe(82);
  });

  it('やけどでも、特殊技は半分にならない', () => {
    const normal = calcDamage(context('flamethrower'));
    const burned = calcDamage(context('flamethrower', { attacker: makeCombatant(garchomp(), null, masterData, { isBurned: true }) }));
    expect(burned.rolls).toEqual(normal.rolls);
  });

  it('こうげきランク +2: こうげき 182 → 364', () => {
    const attacker = makeCombatant(garchomp(), null, masterData, { ranks: { atk: 2 } });
    const result = calcDamage(context('earthquake', { attacker }));
    expect(result.detail.attack).toBe(364);
    // 基礎ダメージ = floor(floor(22 × 100 × 364 ÷ 150) ÷ 50) + 2 = floor(5338 ÷ 50) + 2 = 108
    expect(result.detail.baseDamage).toBe(108);
  });

  it('急所は、防御側の上がったランクを無視する', () => {
    const defender = makeCombatant(metagross(), null, masterData, { ranks: { def: 6 } });
    const conditions = { isCritical: true, isSpread: false };
    expect(calcDamage(context('earthquake', { defender, conditions })).detail.defense).toBe(150);
    expect(calcDamage(context('earthquake', { defender })).detail.defense).toBe(600);
  });

  it('急所は、攻撃側の下がったランクを無視する', () => {
    const attacker = makeCombatant(garchomp(), null, masterData, { ranks: { atk: -6 } });
    const conditions = { isCritical: true, isSpread: false };
    expect(calcDamage(context('earthquake', { attacker, conditions })).detail.attack).toBe(182);
  });
});

describe('タイプ相性', () => {
  it('2タイプは掛け合わせる', () => {
    const chart = masterData.typeEffectiveness;
    expect(typeEffectiveness(chart, 'ice', ['dragon', 'ground'])).toBe(4); // こおり → ガブリアス
    expect(typeEffectiveness(chart, 'ground', ['steel', 'psychic'])).toBe(2); // じめん → メタグロス
    expect(typeEffectiveness(chart, 'fire', ['dragon', 'ground'])).toBe(0.5);
    expect(typeEffectiveness(chart, 'electric', ['dragon', 'ground'])).toBe(0);
  });

  it('こうかなし: ダメージは 0 で、理由が分かる', () => {
    // じしん → リザードン(ほのお・ひこう)
    const defender = makeCombatant(createIndividual('charizard', 'blaze'), null, masterData);
    const result = calcDamage(context('earthquake', { defender }));
    expect(result.max).toBe(0);
    expect(result.noDamageReason).toBe('immune');
    expect(result.ko).toBeNull();
  });

  it('いまひとつでも、最低1ダメージは入る', () => {
    // ピカチュウの でんこうせっか(威力40) → メタグロス(ノーマルは はがね に いまひとつ)。ぼうぎょランク +6
    const attacker = makeCombatant(createIndividual('pikachu', 'static'), null, masterData, { ranks: { atk: -6 } });
    const defender = makeCombatant(metagross(), null, masterData, { ranks: { def: 6 } });
    const result = calcDamage(context('quickattack', { attacker, defender }));
    expect(result.min).toBe(1);
  });
});

describe('メガシンカ後の姿で計算する', () => {
  it('攻撃側がメガシンカ: メガガブリアスの こうげき(222)で計算される', () => {
    const individual = { ...garchomp(), itemId: 'garchompite', gimmicks: { mega: { formId: 'garchompmega' } } };
    const result = calcDamage(context('earthquake', { attacker: makeCombatant(individual, 'mega', masterData) }));
    expect(result.detail.attack).toBe(222);
  });

  it('防御側がメガシンカ: タイプが変わる(リザードンに でんき は ばつぐん、メガリザードンX(ほのお・ドラゴン)には いまひとつ)', () => {
    const charizard = { ...createIndividual('charizard', 'blaze'), itemId: 'charizarditex', gimmicks: { mega: { formId: 'charizardmegax' } } };
    const attacker = makeCombatant(createIndividual('pikachu', 'static'), null, masterData);
    const move = masterData.moves.get('thunderbolt')!;
    const base = { attacker, move, conditions: DEFAULT_CONDITIONS, data: masterData };
    expect(calcDamage({ ...base, defender: makeCombatant(charizard, null, masterData) }).effectiveness).toBe(2);
    expect(calcDamage({ ...base, defender: makeCombatant(charizard, 'mega', masterData) }).effectiveness).toBe(0.5);
  });
});

describe('ダメージを与えない技・未対応の技', () => {
  it('変化技', () => {
    expect(calcDamage(context('swordsdance')).noDamageReason).toBe('status');
  });
  it('特別な決まりを持つ技は、数字を出さずに「未対応」とする', () => {
    expect(calcDamage(context('facade')).noDamageReason).toBe('unsupported'); // からげんき
    expect(calcDamage(context('facade')).max).toBe(0);
  });
});
