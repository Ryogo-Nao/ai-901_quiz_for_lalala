// 計算の前の「状況の整理」。
//
// 入力(攻撃側・防御側・技・場)から、計算に使う値を1か所で決める。
//   ・特性や持ち物が、いま効いているか(かたやぶり で無視される、など)
//   ・技のタイプ(ウェザーボール、フェアリースキン など)
//   ・どの能力値とランクで計算するか(イカサマ、ボディプレス、サイコショック など)
//   ・急所になるか、相性はいくつか、そもそも当たるか(特性による無効 など)
//   ・威力(けたぐり、ジャイロボール など、状況で決まる技)
//
// 補正のルール(rules/)は、ここで整理した結果(Situation)を見て、補正を返す。
//
// 手本にした実装: @smogon/calc 0.12.0 の src/mechanics/champions.ts と util.ts。

import type { MoveData } from '../../data/index.ts';
import type { StatKey } from '../../domain/stats.ts';
import { applyMod, applyRank, chainMods } from '../rounding.ts';
import type { Combatant, DamageContext, Ranks } from './context.ts';
import { resolveBasePower } from './rules/movePower.ts';

/** 計算しない(または 0 ダメージになる)理由 */
export interface StopReason {
  /**
   * status      … 変化技
   * immune      … 効果がない(タイプ相性、特性、持ち物、フィールド)
   * failed      … 技が失敗する条件
   * unsupported … まだ正しく計算できない技
   */
  kind: 'status' | 'immune' | 'failed' | 'unsupported';
  /** 画面に出す説明 */
  label: string;
}

/** 整理した状況 */
export interface Situation extends DamageContext {
  /** いま効いている特性(無視されていれば空文字) */
  attackerAbility: string;
  defenderAbility: string;
  /** いま効いている持ち物(消費した、効果が無い場合は null) */
  attackerItem: string | null;
  defenderItem: string | null;
  /** 防御側が実際に持っている持ち物(効果が無くても持ってはいる。消費していれば null) */
  defenderHeldItem: string | null;
  /** 計算に使うランク(シード系の持ち物などを反映したあと) */
  attackerRanks: Ranks;
  defenderRanks: Ranks;
  /** 実際に効いている天気(ノーてんき などで無効になっていれば null) */
  weather: DamageContext['conditions']['weather'];
  /** 地面にいるか(フィールドの効果を受けるか) */
  attackerGrounded: boolean;
  defenderGrounded: boolean;
  /** すばやさ(ランク・持ち物・まひ を反映したもの)。すばやさで威力が決まる技に使う */
  attackerSpeed: number;
  defenderSpeed: number;
  isCritical: boolean;
  /** 特性で技のタイプが変わったか(スキン系) */
  typeChangedByAbility: boolean;
  /** タイプ相性の倍率 */
  effectiveness: number;
  /** 補正を掛ける前の威力 */
  basePower: number;
  /** 攻撃に使う能力値(ランク補正を掛けたあと)と、受けるのに使う能力値 */
  attackStat: number;
  defenseStat: number;
  /** 物理として受けるか(ぼうぎょ で受けるか) */
  hitsPhysical: boolean;
  /** 決まったダメージを与える技のダメージ。ふつうの技は null */
  fixedDamage: number | null;
  /** 計算しない理由。計算するなら null */
  stop: StopReason | null;
  /** 利用者に伝えたい注意(「条件つきで威力が上がる技です」など) */
  notes: string[];
}

const has = (value: string | null, ...candidates: string[]) => value !== null && candidates.includes(value);

/** 防御側の特性のうち、「かたやぶり」で無視されるもの */
const IGNORABLE_ABILITIES = new Set([
  'auraguard', 'armortail', 'aromaveil', 'battlearmor', 'bigpecks', 'bulletproof', 'clearbody', 'contrary',
  'damp', 'disguise', 'dryskin', 'eartheater', 'eelevate', 'filter', 'flashfire', 'flowerveil', 'fluffy',
  'friendguard', 'furcoat', 'grasspelt', 'guarddog', 'heatproof', 'heavymetal', 'hypercutter', 'illuminate',
  'immunity', 'innerfocus', 'insomnia', 'keeneye', 'leafguard', 'levitate', 'lightmetal', 'lightningrod',
  'limber', 'magicbounce', 'magmaarmor', 'marvelscale', 'mirrorarmor', 'motordrive', 'multiscale', 'oblivious',
  'overcoat', 'owntempo', 'punkrock', 'purifyingsalt', 'queenlymajesty', 'sandveil', 'sapsipper', 'shellarmor',
  'shielddust', 'snowcloak', 'solidrock', 'soundproof', 'stickyhold', 'stormdrain', 'sturdy', 'sweetveil',
  'tangledfeet', 'telepathy', 'thermalexchange', 'thickfat', 'unaware', 'vitalspirit', 'voltabsorb',
  'waterabsorb', 'waterbubble', 'waterveil', 'whitesmoke',
]);

/** シード系の持ち物: フィールドが合っていれば、持ち物を消費して ぼうぎょ か とくぼう が1段階上がる */
const SEEDS: Record<string, { terrain: string; stat: 'def' | 'spd' }> = {
  electricseed: { terrain: 'electric', stat: 'def' },
  grassyseed: { terrain: 'grassy', stat: 'def' },
  mistyseed: { terrain: 'misty', stat: 'spd' },
  psychicseed: { terrain: 'psychic', stat: 'spd' },
};

function applySeed(item: string | null, ranks: Ranks, terrain: string | null, ability: string) {
  const seed = item ? SEEDS[item] : undefined;
  if (!seed || seed.terrain !== terrain) return { item, ranks };
  const change = ability === 'contrary' ? -1 : 1; // あまのじゃく は逆に下がる
  const value = Math.max(-6, Math.min(6, ranks[seed.stat] + change));
  return { item: null, ranks: { ...ranks, [seed.stat]: value } };
}

/** 地面にいるか。ひこうタイプ・ふゆう・ふうせん は浮いている。くろいてっきゅう は必ず地面 */
function isGrounded(types: readonly string[], ability: string, item: string | null): boolean {
  if (item === 'ironball') return true;
  return !types.includes('flying') && ability !== 'levitate' && ability !== 'eelevate' && item !== 'airballoon';
}

/** すばやさ(ランク → 特性・持ち物 → まひ) */
function effectiveSpeed(combatant: Combatant, ability: string, item: string | null, situation: {
  weather: string | null;
  terrain: string | null;
}): number {
  const mods: number[] = [];
  const { weather, terrain } = situation;
  if (
    (ability === 'chlorophyll' && weather === 'sun') ||
    (ability === 'sandrush' && weather === 'sand') ||
    (ability === 'swiftswim' && weather === 'rain') ||
    (ability === 'slushrush' && weather === 'snow') ||
    (ability === 'surgesurfer' && terrain === 'electric')
  ) {
    mods.push(8192);
  } else if (ability === 'quickfeet' && combatant.status) {
    mods.push(6144);
  }
  if (item === 'choicescarf') mods.push(6144);
  else if (item === 'ironball') mods.push(2048);

  let speed = applyMod(applyRank(combatant.battler.stats.spe, combatant.ranks.spe), chainMods(mods));
  if (combatant.status === 'par' && ability !== 'quickfeet') speed = Math.floor(speed / 2);
  return speed;
}

/** 技のタイプを決める(天気・フィールド・特性で変わるもの) */
function resolveMoveType(
  move: MoveData,
  attackerAbility: string,
  weather: string | null,
  terrain: string | null,
  attackerGrounded: boolean,
  speciesId: string,
): { type: string; typeChangedByAbility: boolean } {
  if (move.id === 'weatherball') {
    const megaSol = attackerAbility === 'megasol';
    const type =
      weather === 'sun' || megaSol ? 'fire'
      : weather === 'rain' ? 'water'
      : weather === 'sand' ? 'rock'
      : weather === 'snow' ? 'ice'
      : 'normal';
    return { type, typeChangedByAbility: false };
  }
  if (move.id === 'terrainpulse') {
    const byTerrain: Record<string, string> = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };
    return { type: (attackerGrounded && terrain && byTerrain[terrain]) || 'normal', typeChangedByAbility: false };
  }
  if (move.id === 'ragingbull') {
    const byForm: Record<string, string> = {
      taurospaldeacombat: 'fighting',
      taurospaldeablaze: 'fire',
      taurospaldeaaqua: 'water',
    };
    return { type: byForm[speciesId] ?? move.type, typeChangedByAbility: false };
  }
  if (move.id === 'struggle') return { type: move.type, typeChangedByAbility: false };

  // スキン系の特性: ノーマルタイプの技のタイプを変える(威力も 1.2 倍になる)
  const skins: Record<string, string> = { aerilate: 'flying', dragonize: 'dragon', pixilate: 'fairy', refrigerate: 'ice' };
  if (move.type === 'normal' && skins[attackerAbility]) return { type: skins[attackerAbility], typeChangedByAbility: true };
  if (attackerAbility === 'liquidvoice' && move.flags.includes('sound')) return { type: 'water', typeChangedByAbility: false };
  return { type: move.type, typeChangedByAbility: false };
}

const isOneOfAbility = (ability: string, ...candidates: string[]) => candidates.includes(ability);

/** てんきや: ポワルンは、はれ で ほのお、あめ で みず、ゆき で こおり、それ以外は ノーマル タイプになる */
function applyForecast(combatant: Combatant, weather: string | null): Combatant {
  const { form } = combatant.battler;
  if (form.abilityId !== 'forecast' || !combatant.individual.speciesId.startsWith('castform')) return combatant;
  const type = weather === 'sun' ? 'fire' : weather === 'rain' ? 'water' : weather === 'snow' ? 'ice' : 'normal';
  return { ...combatant, battler: { ...combatant.battler, form: { ...form, types: [type], stabTypes: [type] } } };
}

/** 状況を整理する */
export function resolveSituation(input: DamageContext): Situation {
  const { conditions, data } = input;
  const notes: string[] = [];
  // てんきや(ポワルン): 天気に合わせてタイプが変わる。ここから先は、変わったあとの姿を使う
  const weatherInEffect = [input.attacker, input.defender].some((c) => isOneOfAbility(c.battler.form.abilityId, 'airlock', 'cloudnine'))
    ? null
    : conditions.weather;
  const attacker = applyForecast(input.attacker, weatherInEffect);
  const defender = applyForecast(input.defender, weatherInEffect);
  let context: DamageContext = { ...input, attacker, defender };

  // ----- 特性: 「かたやぶり」は、防御側の一部の特性を無視する -----
  const attackerAbility = attacker.battler.form.abilityId;
  let defenderAbility = defender.battler.form.abilityId;
  if (attackerAbility === 'moldbreaker' && IGNORABLE_ABILITIES.has(defenderAbility)) defenderAbility = '';

  // ----- 天気: 「ノーてんき」「エアロック」がいると、天気の効果が無くなる -----
  const weatherBlocked = [attackerAbility, defenderAbility].some((ability) => ability === 'airlock' || ability === 'cloudnine');
  const weather = weatherBlocked ? null : conditions.weather;
  const { terrain } = conditions;

  // ----- 持ち物: 「ぶきよう」は持ち物の効果が無い。シード系はフィールドで消費される -----
  const itemOf = (combatant: Combatant, ability: string) => (ability === 'klutz' ? null : combatant.individual.itemId);
  const attackerSeed = applySeed(itemOf(attacker, attackerAbility), attacker.ranks, terrain, attackerAbility);
  const defenderSeed = applySeed(itemOf(defender, defenderAbility), defender.ranks, terrain, defenderAbility);
  const attackerItem = attackerSeed.item;
  const defenderItem = defenderSeed.item;
  const seedConsumed = defenderSeed.item !== itemOf(defender, defenderAbility);
  const defenderHeldItem = seedConsumed ? null : defender.individual.itemId;
  let attackerRanks = attackerSeed.ranks;
  const defenderRanks = defenderSeed.ranks;

  // メテオビーム・エレクトロビーム: 攻撃の前に とくこう が1段階上がる
  if (context.move.id === 'meteorbeam' || context.move.id === 'electroshot') {
    const change = attackerAbility === 'contrary' ? -1 : 1;
    attackerRanks = { ...attackerRanks, spa: Math.max(-6, Math.min(6, attackerRanks.spa + change)) };
  }

  const attackerGrounded = isGrounded(attacker.battler.form.types, attackerAbility, attackerItem);
  const defenderGrounded = isGrounded(defender.battler.form.types, defenderAbility, defenderItem);

  // シェルアームズ: 「こうげき ÷ 相手のぼうぎょ」と「とくこう ÷ 相手のとくぼう」を比べて、大きいほうの分類になる
  if (context.move.id === 'shellsidearm') {
    const physical = applyRank(attacker.battler.stats.atk, attackerRanks.atk) / applyRank(defender.battler.stats.def, defenderRanks.def);
    const special = applyRank(attacker.battler.stats.spa, attackerRanks.spa) / applyRank(defender.battler.stats.spd, defenderRanks.spd);
    if (physical > special) {
      const flags = context.move.flags.includes('contact') ? context.move.flags : [...context.move.flags, 'contact'];
      context = { ...context, move: { ...context.move, category: 'physical', flags } };
    }
  }

  // ----- 技のタイプ -----
  const { type, typeChangedByAbility } = resolveMoveType(
    context.move, attackerAbility, weather, terrain, attackerGrounded, attacker.individual.speciesId,
  );
  const move: MoveData = type === context.move.type ? context.move : { ...context.move, type };

  // ----- 急所: 「シェルアーマー」「カブトアーマー」には当たらない -----
  const isCritical =
    (conditions.isCritical || move.alwaysCritical === true) && defenderAbility !== 'shellarmor' && defenderAbility !== 'battlearmor';

  // ----- タイプ相性 -----
  const chart = data.typeEffectiveness;
  let effectiveness = 1;
  for (const defenderType of defender.battler.form.types) {
    let value = chart[move.type]?.[defenderType] ?? 1;
    // きもったま: ノーマル・かくとう技が ゴースト に当たる
    if (attackerAbility === 'scrappy' && defenderType === 'ghost' && (move.type === 'normal' || move.type === 'fighting')) value = 1;
    // フリーズドライ: みず に ばつぐん
    if (move.id === 'freezedry' && defenderType === 'water') value = 2;
    // フライングプレス: かくとう と ひこう の両方の相性を掛ける
    if (move.id === 'flyingpress') value *= chart.flying?.[defenderType] ?? 1;
    effectiveness *= value;
  }
  // くろいてっきゅう を持った ひこうタイプ には、じめん技が等倍で当たる
  if (effectiveness === 0 && move.type === 'ground' && defenderItem === 'ironball') effectiveness = 1;

  // ----- 能力値とランク -----
  // 攻撃: ふつうは自分の こうげき/とくこう。イカサマ は相手の こうげき、ボディプレス は自分の ぼうぎょ
  const usesTargetStat = move.overrideOffensivePokemon === 'target';
  const attackSource = usesTargetStat ? defender : attacker;
  const attackSourceRanks = usesTargetStat ? defenderRanks : attackerRanks;
  const attackKey: Exclude<StatKey, 'hp'> = (move.overrideOffensiveStat as Exclude<StatKey, 'hp'> | undefined) ?? (move.category === 'special' ? 'spa' : 'atk');
  const attackRank = attackSourceRanks[attackKey];
  // 急所は下がったランクを無視する。防御側が「てんねん」ならランクをすべて無視する
  const ignoreAttackRank = (isCritical && attackRank < 0) || defenderAbility === 'unaware';
  const attackStat = applyRank(attackSource.battler.stats[attackKey], ignoreAttackRank ? 0 : attackRank);

  // 防御: ふつうは技の分類で決まる。サイコショック は特殊技だが ぼうぎょ で受ける
  const hitsPhysical = move.overrideDefensiveStat === 'def' || move.category === 'physical';
  const defenseKey = hitsPhysical ? 'def' : 'spd';
  const defenseRank = defenderRanks[defenseKey];
  const ignoreDefenseRank = (isCritical && defenseRank > 0) || move.ignoreDefensive === true || attackerAbility === 'unaware';
  const defenseStat = applyRank(defender.battler.stats[defenseKey], ignoreDefenseRank ? 0 : defenseRank);

  const base: Omit<Situation, 'basePower' | 'fixedDamage' | 'stop'> = {
    ...context,
    move,
    attackerAbility,
    defenderAbility,
    attackerItem,
    defenderItem,
    defenderHeldItem,
    attackerRanks,
    defenderRanks,
    weather,
    attackerGrounded,
    defenderGrounded,
    attackerSpeed: effectiveSpeed(attacker, attackerAbility, attackerItem, { weather, terrain }),
    defenderSpeed: effectiveSpeed(defender, defenderAbility, defenderItem, { weather, terrain }),
    isCritical,
    typeChangedByAbility,
    effectiveness,
    attackStat,
    defenseStat,
    hitsPhysical,
    notes,
  };

  // ----- 当たるかどうか・威力 -----
  const stop = findStopReason(base);
  let fixedDamage: number | null = null;
  let basePower = 0;
  let finalStop = stop;
  if (!stop) {
    if (move.id === 'nightshade' || move.id === 'seismictoss') {
      fixedDamage = 50; // レベルと同じダメージ(レベルは50固定)
    } else if (move.id === 'finalgambit') {
      fixedDamage = attacker.currentHp; // いのちがけ: 自分のいまのHPと同じダメージ
    } else {
      const resolved = resolveBasePower(base);
      basePower = resolved.power;
      if (resolved.note) notes.push(resolved.note);
      if (basePower === 0) {
        finalStop = { kind: 'unsupported', label: resolved.reason ?? 'この技のダメージは、まだ計算できません' };
      }
    }
  }
  return { ...base, basePower, fixedDamage, stop: finalStop };
}

/** 当たらない・失敗する理由を探す。無ければ null */
function findStopReason(s: Omit<Situation, 'basePower' | 'fixedDamage' | 'stop'>): StopReason | null {
  const { move, defenderAbility, defenderItem, conditions } = s;
  const abilityName = (id: string) => s.data.abilities.get(id)?.name ?? id;
  const immune = (label: string): StopReason => ({ kind: 'immune', label });

  if (move.category === 'status') return { kind: 'status', label: '変化技なので、ダメージはありません' };
  if (s.effectiveness === 0) return immune('タイプ相性で、効果がありません');

  if (move.id === 'steelroller' && !conditions.terrain) return { kind: 'failed', label: 'フィールドが無いと失敗する技です' };
  if (move.id === 'poltergeist' && !defenderItem) return { kind: 'failed', label: '相手が持ち物を持っていないと失敗する技です' };

  // 特性による無効
  const blockedByAbility =
    (move.type === 'grass' && defenderAbility === 'sapsipper') ||
    (move.type === 'fire' && defenderAbility === 'flashfire') ||
    (move.type === 'water' && has(defenderAbility, 'dryskin', 'waterabsorb', 'stormdrain')) ||
    (move.type === 'electric' && has(defenderAbility, 'lightningrod', 'motordrive', 'voltabsorb')) ||
    (move.type === 'ground' && has(defenderAbility, 'levitate', 'eelevate', 'eartheater')) ||
    (move.flags.includes('bullet') && defenderAbility === 'bulletproof') ||
    (move.flags.includes('sound') && move.id !== 'clangoroussoul' && defenderAbility === 'soundproof') ||
    (move.priority > 0 && has(defenderAbility, 'queenlymajesty', 'armortail'));
  if (blockedByAbility) return immune(`相手の特性「${abilityName(defenderAbility)}」で、効果がありません`);

  if (move.type === 'ground' && defenderItem === 'airballoon') return immune('相手の「ふうせん」で、効果がありません');
  if (move.priority > 0 && conditions.terrain === 'psychic' && s.defenderGrounded) {
    return immune('サイコフィールドで、先制技は効果がありません');
  }
  return null;
}
