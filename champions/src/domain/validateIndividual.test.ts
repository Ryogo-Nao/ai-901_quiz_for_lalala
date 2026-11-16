// 個体のデータの検査のテスト。
// 画面を通らずに作られた「決まりに合わないデータ」を、きちんと見つけられるかを確かめる。

import { describe, expect, it } from 'vitest';
import { masterData } from '../data/index.ts';
import { changeItem, changeMove } from './editIndividual.ts';
import { createIndividual, type Individual } from './individual.ts';
import { validateIndividual } from './validateIndividual.ts';

const garchomp = () => createIndividual('garchomp', 'roughskin');
const fieldsOf = (individual: Individual) => validateIndividual(individual, masterData).map((p) => p.field);

describe('validateIndividual', () => {
  it('作ったばかりの個体には問題が無い', () => {
    expect(validateIndividual(garchomp(), masterData)).toEqual([]);
  });

  it('画面の決まりを通して作った個体には問題が無い', () => {
    let individual = changeItem(garchomp(), 'garchompite', masterData);
    individual = changeMove(individual, 0, 'earthquake', masterData);
    individual = { ...individual, statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
    expect(validateIndividual(individual, masterData)).toEqual([]);
  });

  it('データに無いポケモン', () => {
    expect(fieldsOf({ ...garchomp(), speciesId: 'missingno' })).toEqual(['species']);
  });

  it('持てない特性', () => {
    expect(fieldsOf({ ...garchomp(), abilityId: 'intimidate' })).toEqual(['ability']);
  });

  it('覚えない技', () => {
    const individual = { ...garchomp(), moveIds: ['thunderbolt', null, null, null] };
    const problems = validateIndividual(individual, masterData);
    expect(problems.map((p) => p.field)).toEqual(['moves']);
    expect(problems[0].message).toBe('ガブリアスは技「１０まんボルト」を覚えません');
  });

  it('同じ技が2つ', () => {
    const individual = { ...garchomp(), moveIds: ['earthquake', 'earthquake', null, null] };
    expect(fieldsOf(individual)).toEqual(['moves']);
  });

  it('ほかのポケモン用のメガストーン', () => {
    expect(fieldsOf({ ...garchomp(), itemId: 'charizarditex' })).toEqual(['item']);
  });

  it('能力ポイントの上限超え', () => {
    const tooMany = { hp: 0, atk: 33, def: 0, spa: 0, spd: 0, spe: 0 };
    expect(fieldsOf({ ...garchomp(), statPoints: tooMany })).toEqual(['statPoints']);
    const tooManyInTotal = { hp: 3, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 };
    expect(fieldsOf({ ...garchomp(), statPoints: tooManyInTotal })).toEqual(['statPoints']);
  });

  it('メガストーンを持っていないのに、メガシンカの設定がある', () => {
    const individual = { ...garchomp(), gimmicks: { mega: { formId: 'garchompmega' } } };
    expect(fieldsOf(individual)).toEqual(['gimmicks']);
  });

  it('メガストーンと、メガシンカ後の姿が合っていない', () => {
    const individual = { ...garchomp(), itemId: 'garchompite', gimmicks: { mega: { formId: 'garchompmegaz' } } };
    expect(fieldsOf(individual)).toEqual(['gimmicks']);
  });

  it('メガシンカできないポケモンに、メガシンカの設定がある', () => {
    const pikachu = { ...createIndividual('pikachu', 'static'), gimmicks: { mega: { formId: 'garchompmega' } } };
    expect(fieldsOf(pikachu)).toEqual(['gimmicks']);
  });
});
