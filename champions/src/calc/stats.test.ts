// 能力値の計算のテスト。
//
//   実行のしかた:  npm test
//
// describe は「テストのまとまり」、it は「テスト1件」、
// expect(実際の値).toBe(期待する値) は「同じでなければ失敗」という意味。

import { describe, expect, it } from 'vitest';
import type { StatTable } from '../domain/stats.ts';
import { calcHp, calcOtherStat, calcStats, natureEffectOn } from './stats.ts';

// ガブリアスの種族値(出典: Pokémon Showdown と PokéAPI の両方で同じ値)
const GARCHOMP: StatTable = { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 };

describe('calcHp: HP = 種族値 + 75 + 能力ポイント', () => {
  it('能力ポイント 0', () => {
    expect(calcHp(108, 0)).toBe(183);
  });
  it('能力ポイント 2', () => {
    expect(calcHp(108, 2)).toBe(185);
  });
  it('能力ポイント 32(上限)', () => {
    expect(calcHp(108, 32)).toBe(215);
  });
});

describe('calcOtherStat: HP以外 = floor((種族値 + 20 + 能力ポイント) × 性格補正)', () => {
  it('性格補正なし', () => {
    expect(calcOtherStat(130, 32, 'neutral')).toBe(182);
  });
  it('上がる性格(×1.1)。小数点以下は切り捨て: 154 × 1.1 = 169.4 → 169', () => {
    expect(calcOtherStat(102, 32, 'up')).toBe(169);
  });
  it('下がる性格(×0.9)。小数点以下は切り捨て: 122 × 0.9 = 109.8 → 109', () => {
    expect(calcOtherStat(102, 0, 'down')).toBe(109);
  });
  it('ちょうど割り切れるとき: 100 × 0.9 = 90、150 × 1.1 = 165', () => {
    expect(calcOtherStat(80, 0, 'down')).toBe(90);
    expect(calcOtherStat(130, 0, 'up')).toBe(165);
  });
});

describe('natureEffectOn: 性格がどの能力を上げ下げするか', () => {
  const jolly = { up: 'spe', down: 'spa' } as const; // ようき
  it('上がる能力・下がる能力・それ以外', () => {
    expect(natureEffectOn(jolly, 'spe')).toBe('up');
    expect(natureEffectOn(jolly, 'spa')).toBe('down');
    expect(natureEffectOn(jolly, 'atk')).toBe('neutral');
  });
  it('HP は性格の影響を受けない', () => {
    expect(natureEffectOn(jolly, 'hp')).toBe('neutral');
  });
  it('補正なしの性格は、どの能力も変えない', () => {
    expect(natureEffectOn({ up: null, down: null }, 'atk')).toBe('neutral');
  });
});

describe('calcStats: 6つの能力をまとめて計算する', () => {
  it('例1: ガブリアス / ようき / HP 2・こうげき 32・すばやさ 32', () => {
    const stats = calcStats(
      GARCHOMP,
      { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
      { up: 'spe', down: 'spa' },
    );
    expect(stats).toEqual({ hp: 185, atk: 182, def: 115, spa: 90, spd: 105, spe: 169 });
  });

  it('例2: ガブリアス / ゆうかん(こうげき↑ すばやさ↓) / 能力ポイントなし', () => {
    const stats = calcStats(
      GARCHOMP,
      { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      { up: 'atk', down: 'spe' },
    );
    expect(stats).toEqual({ hp: 183, atk: 165, def: 115, spa: 100, spd: 105, spe: 109 });
  });

  it('補正なしの性格では、HP以外は 種族値 + 20 + 能力ポイント', () => {
    const stats = calcStats(
      GARCHOMP,
      { hp: 0, atk: 10, def: 0, spa: 0, spd: 0, spe: 0 },
      { up: null, down: null },
    );
    expect(stats).toEqual({ hp: 183, atk: 160, def: 115, spa: 100, spd: 105, spe: 122 });
  });
});
