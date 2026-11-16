// 個体の形に関するテスト(足りない項目を補う、複製する)。

import { describe, expect, it } from 'vitest';
import { createIndividual, duplicateIndividual, normalizeIndividual } from './individual.ts';

describe('normalizeIndividual: 古いデータの足りない項目を補う', () => {
  it('項目がそろっていれば、何も変わらない', () => {
    const individual = createIndividual('garchomp', 'roughskin');
    expect(normalizeIndividual(individual)).toEqual(individual);
  });

  it('足りない項目は初期値になる', () => {
    const result = normalizeIndividual({ id: 'x', speciesId: 'garchomp' });
    expect(result.nickname).toBe('');
    expect(result.itemId).toBeNull();
    expect(result.moveIds).toEqual([null, null, null, null]);
    expect(result.statPoints).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    expect(result.gimmicks).toEqual({});
  });

  it('gimmicks が無い古いデータは「ギミックの設定なし」として読める', () => {
    const { gimmicks: _removed, ...old } = createIndividual('garchomp', 'roughskin');
    expect(normalizeIndividual(old).gimmicks).toEqual({});
  });

  it('知らない項目は捨てない', () => {
    const withExtra = { ...createIndividual('garchomp', 'roughskin'), memo: 'メモ' };
    expect(normalizeIndividual(withExtra)).toMatchObject({ memo: 'メモ' });
  });
});

describe('duplicateIndividual', () => {
  it('中身は同じで id が別。複製を変えても元は変わらない', () => {
    const original = { ...createIndividual('garchomp', 'roughskin'), nickname: 'ガブ' };
    const copy = duplicateIndividual(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.nickname).toBe('ガブ');
    copy.moveIds[0] = 'earthquake';
    expect(original.moveIds[0]).toBeNull();
  });
});
