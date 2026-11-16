// 個体から「戦闘中の姿」を作る処理のテスト(メガシンカを含む)。
// 実際のマスターデータ(src/data/*.json)を使って確かめる。

import { describe, expect, it } from 'vitest';
import { masterData } from '../data/index.ts';
import { changeItem, changeNature } from '../domain/editIndividual.ts';
import { createIndividual, type Individual } from '../domain/individual.ts';
import { buildBattler } from './battler.ts';

/** ガブリアス / ようき / HP 2・こうげき 32・すばやさ 32 */
function jollyGarchomp(): Individual {
  const individual = changeNature(createIndividual('garchomp', 'roughskin'), 'jolly', masterData);
  return { ...individual, statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
}

describe('ギミックを発動していないとき', () => {
  it('種族のデータどおりの姿になる', () => {
    const battler = buildBattler(jollyGarchomp(), null, masterData);
    expect(battler.form.types).toEqual(['dragon', 'ground']);
    expect(battler.form.abilityId).toBe('roughskin');
    expect(battler.stats).toEqual({ hp: 185, atk: 182, def: 115, spa: 90, spd: 105, spe: 169 });
  });

  it('メガストーンを持っていても、発動していなければ変わらない', () => {
    const individual = changeItem(jollyGarchomp(), 'garchompite', masterData);
    const battler = buildBattler(individual, null, masterData);
    expect(battler.stats.atk).toBe(182);
  });
});

describe('メガシンカ', () => {
  it('メガガブリアス: 種族値と特性が変わり、実数値が計算し直される', () => {
    // メガガブリアスの種族値は 108 / 170 / 115 / 120 / 95 / 92
    const individual = changeItem(jollyGarchomp(), 'garchompite', masterData);
    const battler = buildBattler(individual, 'mega', masterData);
    expect(battler.form.abilityId).toBe('sandforce'); // すなのちから
    expect(battler.form.types).toEqual(['dragon', 'ground']);
    expect(battler.stats).toEqual({
      hp: 185, // 108 + 75 + 2          (HP の種族値は変わらない)
      atk: 222, // 170 + 20 + 32
      def: 135, // 115 + 20
      spa: 126, // floor((120 + 20) × 0.9)
      spd: 115, // 95 + 20
      spe: 158, // floor((92 + 20 + 32) × 1.1) = floor(158.4)
    });
  });

  it('メガガブリアスZ: 持ち物が違えば、別の姿になる(タイプも変わる)', () => {
    // メガガブリアスZの種族値は 108 / 130 / 85 / 141 / 85 / 151、タイプはドラゴンのみ
    const individual = changeItem(jollyGarchomp(), 'garchompitez', masterData);
    const battler = buildBattler(individual, 'mega', masterData);
    expect(battler.form.types).toEqual(['dragon']);
    expect(battler.form.abilityId).toBe('levitate'); // ふゆう
    expect(battler.stats.spe).toBe(223); // floor((151 + 20 + 32) × 1.1) = floor(223.3)
  });

  it('メガリザードンX: タイプが ほのお・ひこう から ほのお・ドラゴン に変わる', () => {
    const individual = changeItem(createIndividual('charizard', 'blaze'), 'charizarditex', masterData);
    expect(buildBattler(individual, null, masterData).form.types).toEqual(['fire', 'flying']);
    const mega = buildBattler(individual, 'mega', masterData);
    expect(mega.form.types).toEqual(['fire', 'dragon']);
    expect(mega.form.stabTypes).toEqual(['fire', 'dragon']);
    expect(mega.form.abilityId).toBe('toughclaws'); // かたいツメ
  });

  it('メガストーンを持っていない個体は、発動を指定しても変わらない', () => {
    const battler = buildBattler(jollyGarchomp(), 'mega', masterData);
    expect(battler.form.abilityId).toBe('roughskin');
    expect(battler.stats.atk).toBe(182);
  });
});

describe('データに無いポケモン', () => {
  it('エラーになる', () => {
    const individual = { ...jollyGarchomp(), speciesId: 'missingno' };
    expect(() => buildBattler(individual, null, masterData)).toThrow();
  });
});
