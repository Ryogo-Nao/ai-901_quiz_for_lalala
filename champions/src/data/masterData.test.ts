// マスターデータ(JSON)の検査。
//
// JSON はプログラムの外にあるので、TypeScript は中身の間違いに気づけない。
// 「形が正しいか」「存在しない ID を指していないか」を、ここでまとめて確かめる。
// データを足したあとに `npm test` を実行すれば、間違いがあるとここで失敗する。

import { describe, expect, it } from 'vitest';
import { STAT_KEYS } from '../domain/stats.ts';
import { GIMMICK_IDS } from '../gimmicks/registry.ts';
import { masterData } from './index.ts';
import pokemonJson from './pokemon.json';

const { pokemon, moves, abilities, items, natures, types, typeEffectiveness, regulations } = masterData;

/** 種族値: 6つの能力がそろっていて、どれも 1〜255 の整数であること */
function expectValidBaseStats(baseStats: Record<string, number>, label: string) {
  expect(Object.keys(baseStats).sort(), label).toEqual([...STAT_KEYS].sort());
  for (const key of STAT_KEYS) {
    expect(Number.isInteger(baseStats[key]) && baseStats[key] >= 1 && baseStats[key] <= 255, `${label} ${key}`).toBe(
      true,
    );
  }
}

/** タイプ: 1つか2つで、どれもデータにあること */
function expectValidTypes(typeIds: string[], label: string) {
  expect(typeIds.length === 1 || typeIds.length === 2, label).toBe(true);
  for (const id of typeIds) expect(types.has(id), `${label} のタイプ ${id}`).toBe(true);
}

describe('ポケモン', () => {
  it('ID が重複していない', () => {
    expect(pokemon.size).toBe(pokemonJson.length);
  });

  it('1体以上ある', () => {
    expect(pokemon.size).toBeGreaterThan(0);
  });

  for (const species of pokemon.values()) {
    describe(species.name, () => {
      it('名前・種族値・タイプが正しい形', () => {
        expect(species.name).not.toBe('');
        expectValidBaseStats(species.baseStats, species.id);
        expectValidTypes(species.types, species.id);
      });

      it('特性が1つ以上あり、すべてデータにある', () => {
        expect(species.abilities.length).toBeGreaterThan(0);
        for (const id of species.abilities) expect(abilities.has(id), `特性 ${id}`).toBe(true);
      });

      it('覚える技が1つ以上あり、すべてデータにあり、重複していない', () => {
        expect(species.learnset.length).toBeGreaterThan(0);
        for (const id of species.learnset) expect(moves.has(id), `技 ${id}`).toBe(true);
        expect(new Set(species.learnset).size).toBe(species.learnset.length);
      });

      it('メガシンカ後の姿が正しい形で、必要な持ち物がメガストーンとしてデータにある', () => {
        for (const form of species.megaForms) {
          expect(form.name).not.toBe('');
          expectValidBaseStats(form.baseStats, form.id);
          expectValidTypes(form.types, form.id);
          expect(abilities.has(form.ability), `特性 ${form.ability}`).toBe(true);
          expect(items.get(form.requiredItem)?.isMegaStone, `持ち物 ${form.requiredItem}`).toBe(true);
          // メガシンカしても HP の種族値は変わらない
          expect(form.baseStats.hp).toBe(species.baseStats.hp);
        }
      });
    });
  }
});

describe('技', () => {
  it('分類・タイプ・威力・命中率が正しい形', () => {
    for (const move of moves.values()) {
      expect(move.name, move.id).not.toBe('');
      expect(['physical', 'special', 'status'], move.id).toContain(move.category);
      expect(types.has(move.type), `${move.id} のタイプ ${move.type}`).toBe(true);
      expect(Number.isInteger(move.power) && move.power >= 0, `${move.id} の威力`).toBe(true);
      expect(move.accuracy === null || (move.accuracy >= 1 && move.accuracy <= 100), `${move.id} の命中率`).toBe(true);
      // 変化技の威力は 0
      if (move.category === 'status') expect(move.power, move.id).toBe(0);
    }
  });
});

describe('持ち物', () => {
  it('メガストーンは、どれかのポケモンのメガシンカに対応している', () => {
    const requiredItems = new Set([...pokemon.values()].flatMap((p) => p.megaForms.map((form) => form.requiredItem)));
    for (const item of items.values()) {
      if (item.isMegaStone) expect(requiredItems.has(item.id), item.id).toBe(true);
    }
  });
});

describe('性格', () => {
  it('25種類ある', () => {
    expect(natures.size).toBe(25);
  });

  it('上がる能力と下がる能力は、HP 以外の能力か、どちらも無し', () => {
    const nonHp = STAT_KEYS.filter((key) => key !== 'hp');
    for (const nature of natures.values()) {
      if (nature.up === null || nature.down === null) {
        expect(nature.up, nature.id).toBeNull();
        expect(nature.down, nature.id).toBeNull();
      } else {
        expect(nonHp, nature.id).toContain(nature.up);
        expect(nonHp, nature.id).toContain(nature.down);
        expect(nature.up, nature.id).not.toBe(nature.down);
      }
    }
  });

  it('補正なしが5種類、補正ありが20種類', () => {
    const neutral = [...natures.values()].filter((nature) => nature.up === null);
    expect(neutral.length).toBe(5);
  });
});

describe('タイプ', () => {
  it('18種類ある', () => {
    expect(types.size).toBe(18);
  });

  it('相性表が 18 × 18 すべて埋まっていて、倍率は 0 / 0.5 / 1 / 2 のどれか', () => {
    for (const attack of types.keys()) {
      for (const defend of types.keys()) {
        expect([0, 0.5, 1, 2], `${attack} → ${defend}`).toContain(typeEffectiveness[attack]?.[defend]);
      }
    }
  });

  it('よく知られた相性と合っている', () => {
    expect(typeEffectiveness.fire.grass).toBe(2); // ほのお → くさ: ばつぐん
    expect(typeEffectiveness.water.grass).toBe(0.5); // みず → くさ: いまひとつ
    expect(typeEffectiveness.ground.flying).toBe(0); // じめん → ひこう: こうかなし
    expect(typeEffectiveness.dragon.fairy).toBe(0); // ドラゴン → フェアリー: こうかなし
    expect(typeEffectiveness.normal.normal).toBe(1); // 等倍
  });
});

describe('レギュレーション', () => {
  it('1つ以上あり、ID が重複していない', () => {
    expect(regulations.length).toBeGreaterThan(0);
    expect(new Set(regulations.map((regulation) => regulation.id)).size).toBe(regulations.length);
  });

  it('使えるギミックは、登録簿にあるものだけ', () => {
    for (const regulation of regulations) {
      for (const id of regulation.gimmicks) expect(GIMMICK_IDS, regulation.id).toContain(id);
    }
  });
});
