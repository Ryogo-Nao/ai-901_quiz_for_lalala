// 性格を補正から選ぶ関数のテスト。

import { describe, expect, it } from 'vitest';
import { natureEffectOn } from '../calc/stats.ts';
import { masterData } from '../data/index.ts';
import { natureForEffect } from './nature.ts';
import { STAT_KEYS } from './stats.ts';

const natures = [...masterData.natures.values()];
const get = (id: string) => masterData.natures.get(id)!;

describe('natureForEffect', () => {
  it('補正なしから こうげき を 1.1 倍に → こうげき↑ とくこう↓(いじっぱり)', () => {
    expect(natureForEffect(natures, get('hardy'), 'atk', 'up')?.id).toBe('adamant');
  });
  it('補正なしから とくこう を 1.1 倍に → とくこう↑ こうげき↓(ひかえめ)', () => {
    expect(natureForEffect(natures, get('hardy'), 'spa', 'up')?.id).toBe('modest');
  });
  it('ようき(すばやさ↑ とくこう↓)の こうげき を 1.1 倍に → 下がる能力(とくこう)はそのまま(いじっぱり)', () => {
    expect(natureForEffect(natures, get('jolly'), 'atk', 'up')?.id).toBe('adamant');
  });
  it('いじっぱり の こうげき を 1.0 倍に戻す → とくこう↓ は残る', () => {
    const result = natureForEffect(natures, get('adamant'), 'atk', 'neutral')!;
    expect(natureEffectOn(result, 'atk')).toBe('neutral');
    expect(result.down).toBe('spa');
  });
  it('すべての性格・能力・補正の組み合わせで、希望どおりの補正になる', () => {
    for (const current of natures) {
      for (const key of STAT_KEYS.filter((candidate) => candidate !== 'hp')) {
        for (const effect of ['up', 'neutral', 'down'] as const) {
          const result = natureForEffect(natures, current, key, effect);
          expect(result, `${current.id} ${key} ${effect}`).toBeDefined();
          expect(natureEffectOn(result!, key), `${current.id} ${key} ${effect}`).toBe(effect);
        }
      }
    }
  });
});
