// ダメージ計算の本体のテスト。手で計算した値と比べる。
// (手本の計算機との大量の突き合わせは crossCheck.test.ts)

import { describe, expect, it } from 'vitest';
import { masterData } from '../../data/index.ts';
import { changeNature } from '../../domain/editIndividual.ts';
import { createIndividual, type Individual } from '../../domain/individual.ts';
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
    const result = calcDamage(context('earthquake', { conditions: { ...DEFAULT_CONDITIONS, isCritical: true } }));
    expect(result.max).toBe(246);
    expect(result.min).toBe(206); // floor(82 × 0.85) = 69 → 103.5 → 103 → 206
  });

  it('範囲技: 基礎ダメージ 55 × 0.75 = 41.25 → 41。最大は 41 × 1.5 = 61.5 → 61 → × 2 = 122', () => {
    const result = calcDamage(context('earthquake', { conditions: { ...DEFAULT_CONDITIONS, isDoubles: true, isSpread: true } }));
    expect(result.max).toBe(122);
  });

  it('やけど: 物理技は半分。最大 164 → 82', () => {
    const attacker = makeCombatant(garchomp(), null, masterData, { status: 'brn' });
    expect(calcDamage(context('earthquake', { attacker })).max).toBe(82);
  });

  it('やけどでも、特殊技は半分にならない', () => {
    const normal = calcDamage(context('flamethrower'));
    const burned = calcDamage(context('flamethrower', { attacker: makeCombatant(garchomp(), null, masterData, { status: 'brn' }) }));
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
    const conditions = { ...DEFAULT_CONDITIONS, isCritical: true };
    expect(calcDamage(context('earthquake', { defender, conditions })).detail.defense).toBe(150);
    expect(calcDamage(context('earthquake', { defender })).detail.defense).toBe(600);
  });

  it('急所は、攻撃側の下がったランクを無視する', () => {
    const attacker = makeCombatant(garchomp(), null, masterData, { ranks: { atk: -6 } });
    const conditions = { ...DEFAULT_CONDITIONS, isCritical: true };
    expect(calcDamage(context('earthquake', { attacker, conditions })).detail.attack).toBe(182);
  });
});

describe('タイプ相性', () => {
  it('2タイプは掛け合わせる', () => {
    const versus = (moveId: string, speciesId: string, abilityId: string) =>
      calcDamage(context(moveId, { defender: makeCombatant(createIndividual(speciesId, abilityId), null, masterData) })).effectiveness;
    expect(versus('icebeam', 'garchomp', 'roughskin')).toBe(4); // こおり → ドラゴン・じめん
    expect(versus('earthquake', 'metagross', 'clearbody')).toBe(2); // じめん → はがね・エスパー
    expect(versus('flamethrower', 'garchomp', 'roughskin')).toBe(0.5);
    expect(versus('thunderbolt', 'garchomp', 'roughskin')).toBe(0);
  });

  it('こうかなし: ダメージは 0 で、理由が分かる', () => {
    // じしん → リザードン(ほのお・ひこう)
    const defender = makeCombatant(createIndividual('charizard', 'blaze'), null, masterData);
    const result = calcDamage(context('earthquake', { defender }));
    expect(result.max).toBe(0);
    expect(result.stop?.kind).toBe('immune');
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
    expect(calcDamage(context('swordsdance')).stop?.kind).toBe('status');
  });
  it('受けたダメージで決まる技は、数字を出さずに理由を伝える', () => {
    const result = calcDamage(context('counter', { attacker: makeCombatant(createIndividual('metagross', 'clearbody'), null, masterData) }));
    expect(result.stop?.kind).toBe('unsupported');
    expect(result.max).toBe(0);
  });
});

describe('特別な決まりを持つ技', () => {
  const tyranitar = () => createIndividual('tyranitar', 'sandstream');

  it('イカサマ: 相手の こうげき で計算する', () => {
    // バンギラスの イカサマ → ガブリアス(こうげき 182)
    const result = calcDamage(
      context('foulplay', { attacker: makeCombatant(tyranitar(), null, masterData), defender: makeCombatant(garchomp(), null, masterData) }),
    );
    expect(result.detail.attack).toBe(182);
  });

  it('ボディプレス: 自分の ぼうぎょ で攻撃する', () => {
    const attacker = makeCombatant(metagross(), null, masterData); // ぼうぎょ 150
    expect(calcDamage(context('bodypress', { attacker })).detail.attack).toBe(150);
  });

  it('サイコショック: 特殊技だが、相手の ぼうぎょ で受ける', () => {
    const attacker = makeCombatant(createIndividual('gardevoir', 'trace'), null, masterData);
    expect(calcDamage(context('psyshock', { attacker })).detail.defense).toBe(150); // メタグロスの ぼうぎょ
    expect(calcDamage(context('psychic', { attacker })).detail.defense).toBe(110); // メタグロスの とくぼう
  });

  it('からげんき: 状態異常のとき威力2倍。やけどの半減も受けない', () => {
    const healthy = calcDamage(context('facade'));
    const burned = calcDamage(context('facade', { attacker: makeCombatant(garchomp(), null, masterData, { status: 'brn' }) }));
    expect(healthy.detail.power).toBe(70);
    expect(burned.detail.power).toBe(140);
    expect(burned.detail.modifiers.some((modifier) => modifier.stage === 'burn')).toBe(false);
  });

  it('はたきおとす: 相手が持ち物を持っていると 1.5 倍。自分用のメガストーンは対象外', () => {
    const attacker = makeCombatant(tyranitar(), null, masterData);
    const holding = (itemId: string | null) => makeCombatant({ ...garchomp(), itemId }, null, masterData);
    expect(calcDamage(context('knockoff', { attacker, defender: holding(null) })).detail.power).toBe(65);
    expect(calcDamage(context('knockoff', { attacker, defender: holding('lifeorb') })).detail.power).toBe(97); // 65 × 1.5 = 97.5 → 五捨五超入で 97
    expect(calcDamage(context('knockoff', { attacker, defender: holding('garchompite') })).detail.power).toBe(65);
  });

  it('けたぐり: 相手の重さで威力が決まる(メタグロス 550kg → 120)', () => {
    const attacker = makeCombatant(tyranitar(), null, masterData);
    expect(calcDamage(context('lowkick', { attacker })).detail.power).toBe(120);
  });

  it('ナイトヘッド: レベルと同じ 50 ダメージ', () => {
    const attacker = makeCombatant(createIndividual('gardevoir', 'trace'), null, masterData);
    const result = calcDamage(context('nightshade', { attacker, defender: makeCombatant(garchomp(), null, masterData) }));
    expect(result.rolls.every((damage) => damage === 50)).toBe(true);
  });
});

describe('天気・フィールド・壁・持ち物・特性', () => {
  const charizard = () => createIndividual('charizard', 'blaze');
  const fire = (overrides: Partial<DamageContext> = {}) =>
    calcDamage(context('flamethrower', { attacker: makeCombatant(charizard(), null, masterData), ...overrides }));
  const labels = (result: ReturnType<typeof calcDamage>) => result.detail.modifiers.map((modifier) => modifier.label);

  it('はれ: ほのお技が 1.5 倍、あめ: 0.5 倍', () => {
    const base = fire().detail.baseDamage;
    expect(labels(fire({ conditions: { ...DEFAULT_CONDITIONS, weather: 'sun' } }))).toContain('はれ');
    const sunny = fire({ conditions: { ...DEFAULT_CONDITIONS, weather: 'sun' } });
    const rainy = fire({ conditions: { ...DEFAULT_CONDITIONS, weather: 'rain' } });
    expect(sunny.detail.baseDamage).toBe(base); // 基礎ダメージは変わらず、そのあとの段階で掛かる
    expect(sunny.max).toBeGreaterThan(fire().max);
    expect(rainy.max).toBeLessThan(fire().max);
  });

  it('リフレクター: 物理技が半分。急所には効かない', () => {
    const normal = calcDamage(context('earthquake')).max;
    const reflect = { ...DEFAULT_CONDITIONS, reflect: true };
    expect(calcDamage(context('earthquake', { conditions: reflect })).max).toBe(82);
    expect(normal).toBe(164);
    const critical = calcDamage(context('earthquake', { conditions: { ...reflect, isCritical: true } }));
    expect(labels(critical)).not.toContain('リフレクター');
  });

  it('いのちのたま: 1.3 倍(5324/4096)。164 × 5324 ÷ 4096 = 213.2 → 213', () => {
    const attacker = makeCombatant({ ...garchomp(), itemId: 'lifeorb' }, null, masterData);
    expect(calcDamage(context('earthquake', { attacker })).max).toBe(213);
  });

  it('ちからもち: 物理技の こうげき が2倍', () => {
    const azumarill = makeCombatant(createIndividual('azumarill', 'hugepower'), null, masterData);
    const plain = makeCombatant(createIndividual('azumarill', 'thickfat'), null, masterData);
    const strong = calcDamage(context('playrough', { attacker: azumarill, defender: makeCombatant(garchomp(), null, masterData) }));
    const weak = calcDamage(context('playrough', { attacker: plain, defender: makeCombatant(garchomp(), null, masterData) }));
    expect(strong.detail.attack).toBe(weak.detail.attack * 2);
  });

  it('マルチスケイル: HP が満タンのときだけ半分', () => {
    const dragonite = createIndividual('dragonite', 'multiscale');
    const full = makeCombatant(dragonite, null, masterData);
    const damaged = makeCombatant(dragonite, null, masterData, { currentHp: full.battler.stats.hp - 1 });
    expect(labels(calcDamage(context('dragonclaw', { defender: full })))).toContain('相手のマルチスケイル');
    expect(labels(calcDamage(context('dragonclaw', { defender: damaged })))).not.toContain('相手のマルチスケイル');
  });

  it('ふゆう: じめん技が効かない(理由が分かる)', () => {
    const rotom = makeCombatant(createIndividual('rotomwash', 'levitate'), null, masterData);
    const result = calcDamage(context('earthquake', { defender: rotom }));
    expect(result.stop).toEqual({ kind: 'immune', label: '相手の特性「ふゆう」で、効果がありません' });
  });

  it('確定数は、いまのHPで数える', () => {
    const defender = makeCombatant(metagross(), null, masterData, { currentHp: 100 });
    expect(formatKo(calcDamage(context('earthquake', { defender })).ko)).toBe('確定1発');
  });
});
