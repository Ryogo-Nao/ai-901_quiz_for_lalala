// 手本の計算機(@smogon/calc)との突き合わせ。
//
// サンプルのポケモンどうしの総当たりで、覚える技すべてについて、
// このアプリの16通りのダメージが手本と1つ残らず同じになることを確かめる。
// 手本は開発のときだけ使う(devDependencies)。アプリ本体には入らない。

import { Field, Generations, Move, Pokemon, calculate } from '@smogon/calc';
import { describe, expect, it } from 'vitest';
import { masterData } from '../../data/index.ts';
import { changeItem, changeNature } from '../../domain/editIndividual.ts';
import { createIndividual, type Individual } from '../../domain/individual.ts';
import type { StatTable } from '../../domain/stats.ts';
import { DEFAULT_CONDITIONS, makeCombatant, type DamageConditions, type Ranks } from './context.ts';
import { calcDamage } from './pipeline.ts';
import { isUnsupportedMove } from './unsupportedMoves.ts';

const gen = Generations.get(0); // 手本の中での「チャンピオンズ」の番号

// 特性の効果は次のステップで作るので、ここでは両方とも「ダメージに関係しない特性」にそろえる
const NEUTRAL_ABILITY = 'Run Away';

interface Setup {
  speciesId: string;
  natureId: string;
  points: Partial<StatTable>;
  megaItemId?: string;
}

function build(setup: Setup): Individual {
  const species = masterData.pokemon.get(setup.speciesId)!;
  let individual = changeNature(createIndividual(species.id, species.abilities[0]), setup.natureId, masterData);
  individual = { ...individual, statPoints: { ...individual.statPoints, ...setup.points } };
  return setup.megaItemId ? changeItem(individual, setup.megaItemId, masterData) : individual;
}

/** 手本の側の、同じポケモンを作る */
function reference(setup: Setup, ranks: Partial<Ranks>, isBurned: boolean): Pokemon {
  const species = masterData.pokemon.get(setup.speciesId)!;
  const megaForm = species.megaForms.find((form) => form.requiredItem === setup.megaItemId);
  return new Pokemon(gen, megaForm?.nameEn ?? species.nameEn, {
    nature: masterData.natures.get(setup.natureId)!.nameEn,
    evs: setup.points, // 手本のチャンピオンズでは、この欄が能力ポイント
    ability: NEUTRAL_ABILITY,
    boosts: ranks,
    status: isBurned ? 'brn' : '',
  });
}

/** 手本の結果を「16通りの配列」にそろえる */
function toRolls(damage: unknown): number[] {
  if (typeof damage === 'number') return Array.from({ length: 16 }, () => damage); // こうかなし などは数値1つ
  const list = damage as number[] | number[][];
  // 連続技は「1回ごとの16通り」が入れ子で返ってくる。このアプリは1回ぶんを計算するので、1回目と比べる
  return Array.isArray(list[0]) ? (list[0] as number[]) : (list as number[]);
}

const EXPLICIT_SETUPS: Setup[] = [
  { speciesId: 'garchomp', natureId: 'jolly', points: { hp: 2, atk: 32, spe: 32 } },
  { speciesId: 'garchomp', natureId: 'adamant', points: { hp: 2, atk: 32, spe: 32 }, megaItemId: 'garchompite' },
  { speciesId: 'charizard', natureId: 'timid', points: { spa: 32, spe: 32, hp: 2 }, megaItemId: 'charizarditey' },
  { speciesId: 'charizard', natureId: 'adamant', points: { atk: 32, spe: 32 }, megaItemId: 'charizarditex' },
  { speciesId: 'gardevoir', natureId: 'modest', points: { hp: 32, spa: 32, spd: 2 } },
  { speciesId: 'metagross', natureId: 'adamant', points: { hp: 32, atk: 32, def: 2 }, megaItemId: 'metagrossite' },
  { speciesId: 'dragonite', natureId: 'adamant', points: { hp: 20, atk: 32, spe: 14 } },
  { speciesId: 'tyranitar', natureId: 'careful', points: { hp: 32, spd: 32, atk: 2 } },
  { speciesId: 'incineroar', natureId: 'impish', points: { hp: 32, def: 20, spd: 14 } },
  { speciesId: 'rotomwash', natureId: 'bold', points: { hp: 32, def: 32, spa: 2 } },
  { speciesId: 'azumarill', natureId: 'adamant', points: { hp: 32, atk: 32, def: 2 } },
  { speciesId: 'pikachu', natureId: 'hasty', points: { atk: 16, spa: 16, spe: 32 } },
];

// 上に書いていないポケモン(あとからデータに足したもの)も、自動で対象に入れる。
// こうしておくと、ポケモンを足して npm test を実行するだけで、
// そのポケモンの技に「特別な決まりを持つ技」が混ざっていないかが分かる。
const SETUPS: Setup[] = [
  ...EXPLICIT_SETUPS,
  ...[...masterData.pokemon.keys()]
    .filter((id) => !EXPLICIT_SETUPS.some((setup) => setup.speciesId === id))
    .map((id) => ({ speciesId: id, natureId: 'hardy', points: { atk: 16, spa: 16 } })),
];

interface Scenario {
  name: string;
  conditions: DamageConditions;
  attackerRanks: Partial<Ranks>;
  defenderRanks: Partial<Ranks>;
  isBurned: boolean;
}

const SCENARIOS: Scenario[] = [
  { name: '条件なし', conditions: DEFAULT_CONDITIONS, attackerRanks: {}, defenderRanks: {}, isBurned: false },
  { name: '急所', conditions: { isCritical: true, isSpread: false }, attackerRanks: {}, defenderRanks: {}, isBurned: false },
  { name: 'やけど', conditions: DEFAULT_CONDITIONS, attackerRanks: {}, defenderRanks: {}, isBurned: true },
  {
    name: 'ランク(攻撃側 +2 / 防御側 -1)',
    conditions: DEFAULT_CONDITIONS,
    attackerRanks: { atk: 2, spa: 2 },
    defenderRanks: { def: -1, spd: -1 },
    isBurned: false,
  },
  {
    name: 'ランク(攻撃側 -1 / 防御側 +3)',
    conditions: DEFAULT_CONDITIONS,
    attackerRanks: { atk: -1, spa: -1 },
    defenderRanks: { def: 3, spd: 3 },
    isBurned: false,
  },
  {
    name: '急所 + ランク(攻撃側 -2 / 防御側 +2) … 急所は不利なランクを無視する',
    conditions: { isCritical: true, isSpread: false },
    attackerRanks: { atk: -2, spa: -2 },
    defenderRanks: { def: 2, spd: 2 },
    isBurned: false,
  },
  {
    name: '急所 + ランク(攻撃側 +1 / 防御側 -1) … 有利なランクは無視しない',
    conditions: { isCritical: true, isSpread: false },
    attackerRanks: { atk: 1, spa: 1 },
    defenderRanks: { def: -1, spd: -1 },
    isBurned: false,
  },
  { name: 'やけど + 急所', conditions: { isCritical: true, isSpread: false }, attackerRanks: {}, defenderRanks: {}, isBurned: true },
];

describe('手本(@smogon/calc)と、16通りのダメージがすべて一致する', () => {
  for (const scenario of SCENARIOS) {
    it(scenario.name, () => {
      let compared = 0;
      for (const attackerSetup of SETUPS) {
        const attackerIndividual = build(attackerSetup);
        const attackerSpecies = masterData.pokemon.get(attackerSetup.speciesId)!;
        const gimmick = attackerSetup.megaItemId ? 'mega' : null;
        const attacker = makeCombatant(attackerIndividual, gimmick, masterData, {
          ranks: scenario.attackerRanks,
          isBurned: scenario.isBurned,
        });

        for (const defenderSetup of SETUPS) {
          const defender = makeCombatant(build(defenderSetup), defenderSetup.megaItemId ? 'mega' : null, masterData, {
            ranks: scenario.defenderRanks,
          });

          for (const moveId of attackerSpecies.learnset) {
            const move = masterData.moves.get(moveId)!;
            if (move.category === 'status' || move.power === 0 || isUnsupportedMove(move)) continue;

            const ours = calcDamage({ attacker, defender, move, conditions: scenario.conditions, data: masterData });
            const theirs = calculate(
              gen,
              reference(attackerSetup, scenario.attackerRanks, scenario.isBurned),
              reference(defenderSetup, scenario.defenderRanks, false),
              new Move(gen, move.nameEn, { isCrit: scenario.conditions.isCritical }),
              new Field({ gameType: 'Singles' }),
            ).damage;
            const expected = toRolls(theirs);

            expect(ours.rolls, `${attackerSetup.speciesId} の ${move.name} → ${defenderSetup.speciesId}`).toEqual(expected);
            compared++;
          }
        }
      }
      expect(compared).toBeGreaterThan(1000); // 比べた件数が十分あること
    });
  }

  it('範囲技(ダブルバトルで複数に当たる技)', () => {
    let compared = 0;
    for (const attackerSetup of SETUPS) {
      const attacker = makeCombatant(build(attackerSetup), attackerSetup.megaItemId ? 'mega' : null, masterData);
      const attackerSpecies = masterData.pokemon.get(attackerSetup.speciesId)!;
      for (const defenderSetup of SETUPS) {
        const defender = makeCombatant(build(defenderSetup), defenderSetup.megaItemId ? 'mega' : null, masterData);
        for (const moveId of attackerSpecies.learnset) {
          const move = masterData.moves.get(moveId)!;
          const hitsSeveral = move.target === 'allAdjacent' || move.target === 'allAdjacentFoes';
          if (!hitsSeveral || move.power === 0 || isUnsupportedMove(move)) continue;
          const ours = calcDamage({
            attacker,
            defender,
            move,
            conditions: { isCritical: false, isSpread: true },
            data: masterData,
          });
          const theirs = calculate(
            gen,
            reference(attackerSetup, {}, false),
            reference(defenderSetup, {}, false),
            new Move(gen, move.nameEn),
            new Field({ gameType: 'Doubles' }),
          ).damage;
          expect(ours.rolls, `${attackerSetup.speciesId} の ${move.name} → ${defenderSetup.speciesId}`).toEqual(
            toRolls(theirs),
          );
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(100);
  });
});
