// 手本の計算機(@smogon/calc)との突き合わせ。
//
// データにあるすべてのポケモン(メガシンカ後を含む)の総当たりで、覚える技すべてについて、
// このアプリの16通りのダメージが、手本と1つ残らず同じになることを確かめる。
// 特性・持ち物・天気・フィールド・壁・状態異常・HP・ランクを、いろいろな組み合わせで試す。
//
// 手本は開発のときだけ使う(devDependencies)。アプリ本体には入らない。
//
// ポケモンをデータに足したあとに npm test を実行すると、足したポケモンも自動で対象に入る。
// 手本と合わない技や特性があれば、ここで失敗して、どの組み合わせかが表示される。

import { Field, Generations, Move, Pokemon, calculate } from '@smogon/calc';
import { describe, expect, it } from 'vitest';
import { masterData, type PokemonData } from '../../data/index.ts';
import { changeItem } from '../../domain/editIndividual.ts';
import { createIndividual, type Individual } from '../../domain/individual.ts';
import type { StatTable } from '../../domain/stats.ts';
import {
  DEFAULT_CONDITIONS,
  makeCombatant,
  type DamageConditions,
  type Ranks,
  type StatusId,
  type TerrainId,
  type WeatherId,
} from './context.ts';
import { calcDamage } from './pipeline.ts';

const gen = Generations.get(0); // 手本の中での「チャンピオンズ」の番号

// ---------------------------------------------------------------------------
// 試すポケモン: データにある全ポケモン × 持てる特性すべて、さらにメガシンカ後の姿
// ---------------------------------------------------------------------------

interface Setup {
  label: string;
  species: PokemonData;
  abilityId: string;
  megaItemId: string | null;
  natureId: string;
  points: Partial<StatTable>;
}

const NATURES = ['adamant', 'modest', 'jolly', 'bold', 'careful', 'hardy'];
const SPREADS: Partial<StatTable>[] = [
  { hp: 2, atk: 32, spe: 32 },
  { hp: 32, spa: 32, spd: 2 },
  { hp: 32, def: 20, spd: 14 },
  { atk: 16, spa: 16, spe: 32 },
];

const SETUPS: Setup[] = [];
for (const species of masterData.pokemon.values()) {
  const variants = [
    ...species.abilities.map((abilityId) => ({ abilityId, megaItemId: null as string | null, name: species.name })),
    ...species.megaForms.map((form) => ({ abilityId: species.abilities[0], megaItemId: form.requiredItem, name: form.name })),
  ];
  for (const variant of variants) {
    const index = SETUPS.length;
    SETUPS.push({
      label: `${variant.name}(${masterData.abilities.get(variant.megaItemId ? species.megaForms.find((f) => f.requiredItem === variant.megaItemId)!.ability : variant.abilityId)?.name})`,
      species,
      abilityId: variant.abilityId,
      megaItemId: variant.megaItemId,
      natureId: NATURES[index % NATURES.length],
      points: SPREADS[index % SPREADS.length],
    });
  }
}

// ---------------------------------------------------------------------------
// 試す条件
// ---------------------------------------------------------------------------

interface SideOptions {
  itemId?: string;
  status?: StatusId;
  ranks?: Partial<Ranks>;
  /** いまのHPの割合(1 = 満タン) */
  hpRatio?: number;
}

interface Scenario {
  name: string;
  conditions?: Partial<DamageConditions>;
  attacker?: SideOptions;
  defender?: SideOptions;
}

const SCENARIOS: Scenario[] = [
  { name: '条件なし' },
  { name: '急所', conditions: { isCritical: true } },
  { name: 'やけど', attacker: { status: 'brn' } },
  { name: 'どく(攻撃側) / まひ(防御側)', attacker: { status: 'psn' }, defender: { status: 'par' } },
  { name: 'ランク(攻撃側 +2 / 防御側 -1)', attacker: { ranks: { atk: 2, spa: 2, spe: 1 } }, defender: { ranks: { def: -1, spd: -1 } } },
  { name: 'ランク(攻撃側 -1 / 防御側 +3)', attacker: { ranks: { atk: -1, spa: -1, def: 2 } }, defender: { ranks: { def: 3, spd: 3, atk: 2, spe: -2 } } },
  { name: '急所 + 不利なランク', conditions: { isCritical: true }, attacker: { ranks: { atk: -2, spa: -2 } }, defender: { ranks: { def: 2, spd: 2 } } },
  { name: '急所 + 有利なランク', conditions: { isCritical: true }, attacker: { ranks: { atk: 1, spa: 1 } }, defender: { ranks: { def: -1, spd: -1 } } },
  { name: 'はれ', conditions: { weather: 'sun' } },
  { name: 'あめ', conditions: { weather: 'rain' } },
  { name: 'すなあらし', conditions: { weather: 'sand' } },
  { name: 'ゆき', conditions: { weather: 'snow' } },
  { name: 'エレキフィールド', conditions: { terrain: 'electric' } },
  { name: 'グラスフィールド', conditions: { terrain: 'grassy' } },
  { name: 'ミストフィールド', conditions: { terrain: 'misty' } },
  { name: 'サイコフィールド', conditions: { terrain: 'psychic' } },
  { name: 'リフレクター + ひかりのかべ', conditions: { reflect: true, lightScreen: true } },
  { name: '壁 + 急所(急所には壁が効かない)', conditions: { reflect: true, lightScreen: true, isCritical: true } },
  { name: 'ダブル: 壁', conditions: { isDoubles: true, reflect: true, lightScreen: true } },
  { name: 'ダブル: オーロラベール + てだすけ', conditions: { isDoubles: true, auroraVeil: true, helpingHand: true } },
  { name: 'HP が少ない(攻撃側 1/4、防御側 1/2)', attacker: { hpRatio: 0.25 }, defender: { hpRatio: 0.5 } },
  { name: 'いのちのたま / ゴツゴツメット', attacker: { itemId: 'lifeorb' }, defender: { itemId: 'rockyhelmet' } },
  { name: 'たつじんのおび / ふうせん', attacker: { itemId: 'expertbelt' }, defender: { itemId: 'airballoon' } },
  { name: 'こだわりスカーフ / くろいてっきゅう', attacker: { itemId: 'choicescarf' }, defender: { itemId: 'ironball' } },
  { name: 'くろいてっきゅう / こだわりスカーフ', attacker: { itemId: 'ironball' }, defender: { itemId: 'choicescarf' } },
  { name: 'ちからのハチマキ / ヨプのみ', attacker: { itemId: 'muscleband' }, defender: { itemId: 'chopleberry' } },
  { name: 'ものしりメガネ / ヤチェのみ', attacker: { itemId: 'wiseglasses' }, defender: { itemId: 'yacheberry' } },
  { name: 'でんきだま / シュカのみ', attacker: { itemId: 'lightball' }, defender: { itemId: 'shucaberry' } },
  { name: 'ノーマルジュエル / ホズのみ', attacker: { itemId: 'normalgem' }, defender: { itemId: 'chilanberry' } },
  { name: 'もくたん / オッカのみ', attacker: { itemId: 'charcoal' }, defender: { itemId: 'occaberry' } },
  { name: 'やわらかいすな / ロゼルのみ', attacker: { itemId: 'softsand' }, defender: { itemId: 'roseliberry' } },
  { name: 'りゅうのキバ / ハバンのみ', attacker: { itemId: 'dragonfang' }, defender: { itemId: 'habanberry' } },
  { name: 'じしゃく / ソクノのみ + はれ', conditions: { weather: 'sun' }, attacker: { itemId: 'magnet' }, defender: { itemId: 'wacanberry' } },
  { name: 'しんぴのしずく / イトケのみ + あめ', conditions: { weather: 'rain' }, attacker: { itemId: 'mysticwater' }, defender: { itemId: 'passhoberry' } },
  { name: 'シード + エレキフィールド', conditions: { terrain: 'electric' }, attacker: { itemId: 'electricseed' }, defender: { itemId: 'electricseed' } },
  { name: 'シード + ミストフィールド', conditions: { terrain: 'misty' }, attacker: { itemId: 'mistyseed' }, defender: { itemId: 'mistyseed' } },
  { name: 'やけど + 急所 + すなあらし + 壁', conditions: { isCritical: true, weather: 'sand', reflect: true }, attacker: { status: 'brn' } },
];

// ---------------------------------------------------------------------------
// このアプリの入力と、手本の入力を、同じ条件から作る
// ---------------------------------------------------------------------------

const WEATHER_NAMES: Record<WeatherId, string> = { sun: 'Sun', rain: 'Rain', sand: 'Sand', snow: 'Snow' };
const TERRAIN_NAMES: Record<TerrainId, string> = { electric: 'Electric', grassy: 'Grassy', misty: 'Misty', psychic: 'Psychic' };

function itemIdOf(setup: Setup, options: SideOptions): string | null {
  return setup.megaItemId ?? options.itemId ?? null; // メガシンカする個体は、メガストーンを持っている
}

function buildOurs(setup: Setup, options: SideOptions) {
  let individual: Individual = {
    ...createIndividual(setup.species.id, setup.abilityId),
    natureId: setup.natureId,
  };
  individual = { ...individual, statPoints: { ...individual.statPoints, ...setup.points } };
  const itemId = itemIdOf(setup, options);
  if (itemId) individual = changeItem(individual, itemId, masterData);
  const combatant = makeCombatant(individual, setup.megaItemId ? 'mega' : null, masterData, {
    ranks: options.ranks,
    status: options.status,
  });
  const hp = Math.max(1, Math.floor(combatant.battler.stats.hp * (options.hpRatio ?? 1)));
  return { ...combatant, currentHp: hp };
}

function buildTheirs(setup: Setup, options: SideOptions, currentHp: number): Pokemon {
  const megaForm = setup.species.megaForms.find((form) => form.requiredItem === setup.megaItemId);
  const abilityId = megaForm?.ability ?? setup.abilityId;
  const itemId = itemIdOf(setup, options);
  return new Pokemon(gen, megaForm?.nameEn ?? setup.species.nameEn, {
    nature: masterData.natures.get(setup.natureId)!.nameEn,
    evs: setup.points, // 手本のチャンピオンズでは、この欄が能力ポイント
    ability: masterData.abilities.get(abilityId)!.nameEn,
    abilityOn: false, // 「いかく」などを、手本が自動で発動させないようにする(このアプリではランクを自分で指定する)
    item: itemId ? masterData.items.get(itemId)!.nameEn : undefined,
    boosts: options.ranks,
    status: options.status ?? '',
    curHP: currentHp,
  });
}

/** 手本の結果を「16通りの配列」にそろえる */
function toRolls(damage: unknown): number[] {
  if (typeof damage === 'number') return Array.from({ length: 16 }, () => damage); // 効果なし、決まったダメージは数値1つ
  const list = damage as number[] | number[][];
  // 連続技は「1回ごとの16通り」が入れ子で返ってくる。このアプリは1回ぶんを計算するので、1回目と比べる
  return Array.isArray(list[0]) ? (list[0] as number[]) : (list as number[]);
}

// ---------------------------------------------------------------------------
// 手本と違ってよい組み合わせ(理由つき)
// ---------------------------------------------------------------------------

/** このアプリが「計算できません」と答える技。手本と比べない */
const NOT_CALCULATED = new Set(['counter', 'endeavor', 'beatup']);

describe('手本(@smogon/calc)と、16通りのダメージがすべて一致する', () => {
  SCENARIOS.forEach((scenario, scenarioIndex) => {
    it(scenario.name, () => {
      const conditions: DamageConditions = { ...DEFAULT_CONDITIONS, ...scenario.conditions };
      const mismatches: string[] = [];
      let compared = 0;

      SETUPS.forEach((attackerSetup, attackerIndex) => {
        SETUPS.forEach((defenderSetup, defenderIndex) => {
          // 時間を抑えるため、組み合わせの一部だけを試す(条件ごとに、試す組み合わせをずらす)。
          // VITE_CROSS_CHECK=full npm test とすると、すべての組み合わせを試す(1分ほどかかる)
          const every = import.meta.env.VITE_CROSS_CHECK === 'full' ? 1 : scenarioIndex === 0 ? 4 : 16;
          if ((attackerIndex * 7 + defenderIndex * 3 + scenarioIndex) % every !== 0) return;

          const attacker = buildOurs(attackerSetup, scenario.attacker ?? {});
          const defender = buildOurs(defenderSetup, scenario.defender ?? {});

          for (const moveId of attackerSetup.species.learnset) {
            const move = masterData.moves.get(moveId)!;
            if (move.category === 'status' || NOT_CALCULATED.has(moveId)) continue;
            const isSpread = conditions.isDoubles && (move.target === 'allAdjacent' || move.target === 'allAdjacentFoes');

            const ours = calcDamage({ attacker, defender, move, conditions: { ...conditions, isSpread }, data: masterData });
            const theirs = calculate(
              gen,
              buildTheirs(attackerSetup, scenario.attacker ?? {}, attacker.currentHp),
              buildTheirs(defenderSetup, scenario.defender ?? {}, defender.currentHp),
              new Move(gen, move.nameEn, { isCrit: conditions.isCritical }),
              new Field({
                gameType: conditions.isDoubles ? 'Doubles' : 'Singles',
                weather: conditions.weather ? (WEATHER_NAMES[conditions.weather] as 'Sun') : undefined,
                terrain: conditions.terrain ? (TERRAIN_NAMES[conditions.terrain] as 'Electric') : undefined,
                attackerSide: { isHelpingHand: conditions.helpingHand },
                defenderSide: {
                  isReflect: conditions.reflect,
                  isLightScreen: conditions.lightScreen,
                  isAuroraVeil: conditions.auroraVeil,
                },
              }),
            ).damage;

            compared++;
            const expected = toRolls(theirs);
            if (JSON.stringify(ours.rolls) !== JSON.stringify(expected)) {
              mismatches.push(
                `${attackerSetup.label} の ${move.name}(${move.id}) → ${defenderSetup.label}: ` +
                  `このアプリ ${ours.min}〜${ours.max}${ours.stop ? `(${ours.stop.label})` : ''} / 手本 ${expected[0]}〜${expected[15]}`,
              );
            }
          }
        });
      });

      // 合わなかったものを、技ごとに1件ずつ見せる(全部並べると読めないため)
      const firstPerMove = [...new Map(mismatches.map((line) => [line.match(/\(([a-z0-9]+)\)/)?.[1], line])).values()];
      expect(firstPerMove, `${mismatches.length} 件が手本と合いません`).toEqual([]);
      expect(compared).toBeGreaterThan(300); // 比べた件数が十分あること
    }, 300_000); // 全部の組み合わせを試すときは時間がかかるので、制限時間を長くしておく
  });
});
