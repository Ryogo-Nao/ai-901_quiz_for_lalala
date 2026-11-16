// 「ポケモンごとに選べるものが違う」決まりのテスト。
// 実際のマスターデータ(src/data/*.json)を使って確かめる。

import { describe, expect, it } from 'vitest';
import { masterData } from '../data/index.ts';
import {
  changeAbility,
  changeItem,
  changeMegaForm,
  changeMove,
  changeNature,
  changeNickname,
  changeSpecies,
  requireSpecies,
  selectableItems,
  selectableMoves,
} from './editIndividual.ts';
import { createIndividual } from './individual.ts';

const garchomp = () => createIndividual('garchomp', 'roughskin');
const garchompData = requireSpecies(masterData, 'garchomp');
const pikachuData = requireSpecies(masterData, 'pikachu');

describe('selectableItems: 持てる持ち物', () => {
  it('自分用のメガストーンは候補に出る', () => {
    const ids = selectableItems(garchompData, masterData).map((item) => item.id);
    expect(ids).toContain('garchompite');
    expect(ids).toContain('garchompitez');
  });
  it('ほかのポケモン用のメガストーンは候補に出ない', () => {
    const ids = selectableItems(garchompData, masterData).map((item) => item.id);
    expect(ids).not.toContain('charizarditex');
  });
  it('メガシンカできないポケモンには、メガストーンが1つも出ない', () => {
    const items = selectableItems(pikachuData, masterData);
    expect(items.some((item) => item.isMegaStone)).toBe(false);
    expect(items.map((item) => item.id)).toContain('lightball'); // でんきだま
  });
});

describe('selectableMoves / changeMove: 覚える技だけを選べる', () => {
  it('候補は、そのポケモンが覚える技だけ', () => {
    const ids = selectableMoves(garchomp(), 0, masterData).map((move) => move.id);
    expect(ids).toContain('earthquake'); // じしん
    expect(ids).not.toContain('thunderbolt'); // 10まんボルト(ガブリアスは覚えない)
    expect(ids.length).toBe(garchompData.learnset.length);
  });
  it('覚える技は選べる', () => {
    expect(changeMove(garchomp(), 0, 'earthquake', masterData).moveIds[0]).toBe('earthquake');
  });
  it('覚えない技は選べない(何も変わらない)', () => {
    expect(changeMove(garchomp(), 0, 'thunderbolt', masterData).moveIds[0]).toBeNull();
  });
  it('ほかの欄で選んだ技は、候補から消える', () => {
    const individual = changeMove(garchomp(), 0, 'earthquake', masterData);
    const idsForSlot1 = selectableMoves(individual, 1, masterData).map((move) => move.id);
    expect(idsForSlot1).not.toContain('earthquake');
    // 自分の欄(0番目)の候補には残る
    expect(selectableMoves(individual, 0, masterData).map((move) => move.id)).toContain('earthquake');
  });
  it('同じ技を2つの欄には入れられない', () => {
    const individual = changeMove(garchomp(), 0, 'earthquake', masterData);
    expect(changeMove(individual, 1, 'earthquake', masterData).moveIds[1]).toBeNull();
  });
  it('空欄に戻せる', () => {
    const individual = changeMove(garchomp(), 0, 'earthquake', masterData);
    expect(changeMove(individual, 0, null, masterData).moveIds[0]).toBeNull();
  });
  it('フォルムだけの技も選べる(ウォッシュロトムのハイドロポンプ)', () => {
    const rotom = createIndividual('rotomwash', 'levitate');
    expect(changeMove(rotom, 0, 'hydropump', masterData).moveIds[0]).toBe('hydropump');
  });
});

describe('changeAbility: 持てる特性だけを選べる', () => {
  it('持てる特性は選べる', () => {
    expect(changeAbility(garchomp(), 'sandveil', masterData).abilityId).toBe('sandveil');
  });
  it('持てない特性は選べない(何も変わらない)', () => {
    expect(changeAbility(garchomp(), 'intimidate', masterData).abilityId).toBe('roughskin');
  });
});

describe('持ち物とメガシンカの設定は、いつも合っている', () => {
  it('メガストーンを持たせると、メガシンカの設定が入る', () => {
    const individual = changeItem(garchomp(), 'garchompite', masterData);
    expect(individual.gimmicks.mega).toEqual({ formId: 'garchompmega' });
  });
  it('別のメガストーンに持ち替えると、姿も変わる', () => {
    const individual = changeItem(changeItem(garchomp(), 'garchompite', masterData), 'garchompitez', masterData);
    expect(individual.gimmicks.mega).toEqual({ formId: 'garchompmegaz' });
  });
  it('メガストーン以外に持ち替えると、メガシンカの設定が外れる', () => {
    const individual = changeItem(changeItem(garchomp(), 'garchompite', masterData), 'lifeorb', masterData);
    expect(individual.itemId).toBe('lifeorb');
    expect(individual.gimmicks.mega).toBeUndefined();
  });
  it('ほかのポケモン用のメガストーンは持たせられない', () => {
    const individual = changeItem(garchomp(), 'charizarditex', masterData);
    expect(individual.itemId).toBeNull();
    expect(individual.gimmicks.mega).toBeUndefined();
  });
  it('メガシンカ後の姿を選ぶと、対応するメガストーンを持つ', () => {
    const individual = changeMegaForm(garchomp(), 'garchompmegaz', masterData);
    expect(individual.itemId).toBe('garchompitez');
    expect(individual.gimmicks.mega).toEqual({ formId: 'garchompmegaz' });
  });
  it('「メガシンカしない」を選ぶと、メガストーンを外す', () => {
    const individual = changeMegaForm(changeMegaForm(garchomp(), 'garchompmega', masterData), null, masterData);
    expect(individual.itemId).toBeNull();
    expect(individual.gimmicks.mega).toBeUndefined();
  });
  it('「メガシンカしない」を選んでも、ふつうの持ち物は外さない', () => {
    const individual = changeMegaForm(changeItem(garchomp(), 'lifeorb', masterData), null, masterData);
    expect(individual.itemId).toBe('lifeorb');
  });
  it('そのポケモンに無い姿は選べない', () => {
    const individual = changeMegaForm(garchomp(), 'charizardmegax', masterData);
    expect(individual.itemId).toBeNull();
    expect(individual.gimmicks.mega).toBeUndefined();
  });
});

describe('changeSpecies: ポケモンを変える', () => {
  it('特性は新しいポケモンのものになり、技は空欄になる', () => {
    const before = changeMove(garchomp(), 0, 'earthquake', masterData);
    const after = changeSpecies(before, 'pikachu', masterData);
    expect(after.speciesId).toBe('pikachu');
    expect(pikachuData.abilities).toContain(after.abilityId);
    expect(after.moveIds).toEqual([null, null, null, null]);
  });
  it('前のポケモン用のメガストーンとメガシンカの設定は外れる', () => {
    const before = changeItem(garchomp(), 'garchompite', masterData);
    const after = changeSpecies(before, 'charizard', masterData);
    expect(after.itemId).toBeNull();
    expect(after.gimmicks.mega).toBeUndefined();
  });
  it('誰でも持てる持ち物・性格・能力ポイント・ニックネームは残る', () => {
    let before = changeItem(garchomp(), 'lifeorb', masterData);
    before = changeNature(before, 'jolly', masterData);
    before = changeNickname(before, 'ガブ');
    before = { ...before, statPoints: { ...before.statPoints, atk: 32 } };
    const after = changeSpecies(before, 'charizard', masterData);
    expect(after.itemId).toBe('lifeorb');
    expect(after.natureId).toBe('jolly');
    expect(after.nickname).toBe('ガブ');
    expect(after.statPoints.atk).toBe(32);
  });
});

describe('changeNature / changeNickname', () => {
  it('データに無い性格は選べない', () => {
    expect(changeNature(garchomp(), 'unknown', masterData).natureId).toBe('hardy');
  });
  it('ニックネームは20文字まで', () => {
    expect(changeNickname(garchomp(), 'あ'.repeat(30)).nickname).toBe('あ'.repeat(20));
  });
});
