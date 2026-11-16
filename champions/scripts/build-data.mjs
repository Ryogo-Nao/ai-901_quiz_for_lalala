// マスターデータ(src/data/*.json)を、公開データから作るプログラム。
//
//   使い方:  npm run data:build
//
// やっていること
//   1. scripts/data-config.json を読む(入れたいポケモンの一覧と、データの取得元)
//   2. 取得元からファイルをダウンロードする(2回目以降は .data-cache/ に残したものを使う)
//   3. 必要な値だけを取り出して、アプリが読みやすい形の JSON にして書き出す
//
// 数値や名前を手で写さないので、写し間違いが起きません。
// 取得元に無い値は「空のまま」にして警告を出します(推測で埋めません)。

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FUNCTION_NAMES, extractExportedObject, parseCsv, toId } from './lib/parse-ts-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, '.data-cache');
const OUT_DIR = path.join(ROOT, 'src', 'data');

const config = JSON.parse(await readFile(path.join(ROOT, 'scripts', 'data-config.json'), 'utf8'));
const overrides = JSON.parse(await readFile(path.join(ROOT, 'scripts', 'name-overrides.json'), 'utf8'));

/** 気づいたことを最後にまとめて表示するための入れ物 */
const warnings = [];
const warn = (message) => warnings.push(message);

// ---------------------------------------------------------------------------
// 1. ダウンロード
// ---------------------------------------------------------------------------

/** 取得元のファイルを文字列として読む。一度取ったものは .data-cache/ から読む */
async function fetchSource(sourceKey, filePath) {
  const source = config.sources[sourceKey];
  const cachePath = path.join(CACHE_DIR, sourceKey, source.commit, filePath);
  if (existsSync(cachePath)) return readFile(cachePath, 'utf8');

  const url = `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${filePath}`;
  console.log(`  ダウンロード: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ダウンロードに失敗しました (${response.status}): ${url}`);
  const text = await response.text();
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, text);
  return text;
}

const showdownTable = async (filePath, exportName) =>
  extractExportedObject(await fetchSource('showdown', filePath), exportName);
const pokeapiCsv = async (name) => parseCsv(await fetchSource('pokeapi', `data/v2/csv/${name}.csv`));

console.log('取得元のデータを読み込みます');

// Pokémon Showdown: 本編(第9世代)のデータ
const basePokedex = await showdownTable('data/pokedex.ts', 'Pokedex');
const baseMoves = await showdownTable('data/moves.ts', 'Moves');
const baseAbilities = await showdownTable('data/abilities.ts', 'Abilities');
const baseItems = await showdownTable('data/items.ts', 'Items');
const baseFormats = await showdownTable('data/formats-data.ts', 'FormatsData');
const natures = await showdownTable('data/natures.ts', 'Natures');
const typeChart = await showdownTable('data/typechart.ts', 'TypeChart');

// Pokémon Showdown: チャンピオンズ用の「本編との差分」
const modLearnsets = await showdownTable('data/mods/champions/learnsets.ts', 'Learnsets');
const modMoves = await showdownTable('data/mods/champions/moves.ts', 'Moves');
const modAbilities = await showdownTable('data/mods/champions/abilities.ts', 'Abilities');
const modItems = await showdownTable('data/mods/champions/items.ts', 'Items');
const modFormats = await showdownTable('data/mods/champions/formats-data.ts', 'FormatsData');

// PokéAPI: 日本語名
const csv = {
  species: await pokeapiCsv('pokemon_species'),
  speciesNames: await pokeapiCsv('pokemon_species_names'),
  forms: await pokeapiCsv('pokemon_forms'),
  formNames: await pokeapiCsv('pokemon_form_names'),
  moves: await pokeapiCsv('moves'),
  moveNames: await pokeapiCsv('move_names'),
  abilities: await pokeapiCsv('abilities'),
  abilityNames: await pokeapiCsv('ability_names'),
  items: await pokeapiCsv('items'),
  itemNames: await pokeapiCsv('item_names'),
  types: await pokeapiCsv('types'),
  typeNames: await pokeapiCsv('type_names'),
  natures: await pokeapiCsv('natures'),
  natureNames: await pokeapiCsv('nature_names'),
};

// ---------------------------------------------------------------------------
// 2. 本編のデータにチャンピオンズの差分を重ねる
// ---------------------------------------------------------------------------

/**
 * 差分の重ね方(Pokémon Showdown の決まり):
 *   差分側に `inherit: true` があれば「本編の値を引き継ぎ、書いてある項目だけ上書き」。
 *   無ければ「差分側の内容で丸ごと置き換え」。
 */
function applyMod(base, mod) {
  const result = { ...base };
  for (const [id, patch] of Object.entries(mod)) {
    if (patch.inherit) {
      const functions = [...(base[id]?.[FUNCTION_NAMES] ?? []), ...(patch[FUNCTION_NAMES] ?? [])];
      result[id] = { ...base[id], ...patch, [FUNCTION_NAMES]: functions };
    } else {
      result[id] = patch;
    }
  }
  return result;
}

const moves = applyMod(baseMoves, modMoves);
const abilities = applyMod(baseAbilities, modAbilities);
const items = applyMod(baseItems, modItems);
const formats = applyMod(baseFormats, modFormats);

/** チャンピオンズで使えるか。`isNonstandard` に "Past" などが入っていれば使えない */
const isAvailable = (entry) => entry !== undefined && (entry.isNonstandard ?? null) === null;

/** そのポケモン(フォルム)がチャンピオンズで使えるか */
function isSpeciesAvailable(id) {
  const species = basePokedex[id];
  if (!species) return false;
  const format = formats[id];
  if (format) return isAvailable(format) && format.tier !== 'Illegal';
  // 専用の情報が無いフォルムは、元のポケモンと同じ扱い
  return species.baseSpecies ? isSpeciesAvailable(toId(species.baseSpecies)) : false;
}

// ---------------------------------------------------------------------------
// 3. 日本語名を引く準備
// ---------------------------------------------------------------------------

const JA_KANA = '1'; // ひらがな・カタカナ表記
const JA_KANJI = '11'; // 漢字まじり表記
const ENGLISH = '9';

/** { 番号 → 日本語名 } の表を作る。かな表記を優先し、無ければ漢字まじり表記 */
function japaneseNamesById(nameRows, idColumn, nameColumn = 'name') {
  const result = new Map();
  for (const language of [JA_KANJI, JA_KANA]) {
    for (const row of nameRows) {
      if (row.local_language_id === language && row[nameColumn]) result.set(row[idColumn], row[nameColumn]);
    }
  }
  return result;
}

/**
 * { このアプリの ID → 日本語名 } の表を作る。
 * PokéAPI の ID("dragon-claw")と英語名("Dragon Claw")の両方から、このアプリの ID("dragonclaw")を作って対応させる。
 */
function japaneseNamesByAppId(entityRows, nameRows, idColumn) {
  const japanese = japaneseNamesById(nameRows, idColumn);
  const result = new Map();
  for (const row of nameRows) {
    if (row.local_language_id === ENGLISH && japanese.has(row[idColumn])) {
      result.set(toId(row.name), japanese.get(row[idColumn]));
    }
  }
  for (const row of entityRows) {
    if (japanese.has(row.id)) result.set(toId(row.identifier), japanese.get(row.id));
  }
  return result;
}

const jaSpecies = japaneseNamesByAppId(csv.species, csv.speciesNames, 'pokemon_species_id');
const jaMoves = japaneseNamesByAppId(csv.moves, csv.moveNames, 'move_id');
const jaAbilities = japaneseNamesByAppId(csv.abilities, csv.abilityNames, 'ability_id');
const jaItems = japaneseNamesByAppId(csv.items, csv.itemNames, 'item_id');
const jaTypes = japaneseNamesByAppId(csv.types, csv.typeNames, 'type_id');
const jaNatures = japaneseNamesByAppId(csv.natures, csv.natureNames, 'nature_id');
const jaFormNames = japaneseNamesById(csv.formNames, 'pokemon_form_id', 'form_name');
const formRowByAppId = new Map(csv.forms.map((row) => [toId(row.identifier), row]));

/** 日本語名を返す。優先順位: 手で書いた上書き → 取得元 → (無ければ)英語名のまま + 警告 */
function japaneseName(kind, lookup, id, englishName) {
  const override = overrides[kind]?.[id];
  if (override) return override;
  const found = lookup.get(id);
  if (found) return found;
  warn(`日本語名が取得元にありません: ${kind} "${id}" (${englishName})。英語名のまま入れました`);
  return englishName;
}

/** ポケモン(フォルムを含む)の日本語名 */
function japaneseSpeciesName(id) {
  const species = basePokedex[id];
  if (overrides.pokemon?.[id]) return overrides.pokemon[id];

  // フォルムではない、ふつうのポケモン
  if (!species.baseSpecies) return japaneseName('pokemon', jaSpecies, id, species.name);

  // フォルム違い(メガシンカ、リージョンフォームなど)
  const baseName = jaSpecies.get(toId(species.baseSpecies));
  const formRow = formRowByAppId.get(toId(config.formAliases[id] ?? id));
  const formName = formRow ? jaFormNames.get(formRow.id) : undefined;
  if (!baseName || !formName) {
    warn(`フォルムの日本語名が取得元にありません: pokemon "${id}" (${species.name})。英語名のまま入れました`);
    return species.name;
  }
  // 取得元のフォルム名には2通りある。
  //   「メガガブリアス」「ウォッシュロトム」… それだけで名前として通じる → そのまま使う
  //   「アローラのすがた」               … 説明だけ → 「ライチュウ(アローラのすがた)」の形にする
  return formName.includes(baseName) ? formName : `${baseName}(${formName})`;
}

// ---------------------------------------------------------------------------
// 4. アプリ用の形に組み立てる
// ---------------------------------------------------------------------------

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** 持ち物から「どのポケモンが、どの姿にメガシンカするか」を引ける表を作る */
const megaStonesBySpeciesName = new Map();
for (const [itemId, item] of Object.entries(items)) {
  if (!isAvailable(item) || !item.megaStone) continue;
  for (const [fromName, megaName] of Object.entries(item.megaStone)) {
    const list = megaStonesBySpeciesName.get(fromName) ?? [];
    list.push({ itemId, megaId: toId(megaName) });
    megaStonesBySpeciesName.set(fromName, list);
  }
}

/**
 * そのポケモンが覚える技の ID の一覧。
 * チャンピオンズでは、進化前のポケモンの技は引き継がない(取得元の決まりに合わせている)。
 */
function learnsetOf(id, seen = new Set()) {
  if (seen.has(id)) return [];
  seen.add(id);
  const species = basePokedex[id];
  const own = modLearnsets[id]?.learnset;
  const parentName = species.changesFrom || species.baseSpecies;

  if (own === undefined) {
    // 専用の技一覧を持たないフォルムは、元の姿と同じ技を覚える
    return parentName && parentName !== species.name ? learnsetOf(toId(parentName), seen) : [];
  }
  const result = new Set(Object.keys(own));
  // ロトムのように「元の姿の技 + そのフォルムだけの技」を覚えるもの
  if (!species.prevo && species.changesFrom && species.baseSpecies !== 'Kyurem') {
    for (const moveId of learnsetOf(toId(species.changesFrom), seen)) result.add(moveId);
  }
  return [...result];
}

function buildBaseStats(species) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, species.baseStats[key]]));
}

function buildPokemon(id) {
  const species = basePokedex[id];

  // 特性: 通常特性(0, 1)と隠れ特性(H)。配布限定の特別な特性(S)は入れない
  const abilityIds = [...new Set(['0', '1', 'H'].map((slot) => species.abilities[slot]).filter(Boolean).map(toId))];
  if (species.abilities.S) {
    warn(`${id}: 特別な特性 "${species.abilities.S}" は入れていません(使える場合は確認のうえ追加してください)`);
  }

  const learnset = learnsetOf(id)
    .filter((moveId) => isAvailable(moves[moveId]))
    .sort();
  if (learnset.length === 0) warn(`${id}: 覚える技が1つも見つかりませんでした`);

  const megaForms = (megaStonesBySpeciesName.get(species.name) ?? [])
    .filter(({ megaId }) => isSpeciesAvailable(megaId))
    .map(({ itemId, megaId }) => {
      const mega = basePokedex[megaId];
      return {
        id: megaId,
        name: japaneseSpeciesName(megaId),
        nameEn: mega.name,
        requiredItem: itemId,
        types: mega.types.map(toId),
        baseStats: buildBaseStats(mega),
        ability: toId(mega.abilities['0']),
        weightKg: mega.weightkg,
      };
    });

  return {
    id,
    name: japaneseSpeciesName(id),
    nameEn: species.name,
    types: species.types.map(toId),
    baseStats: buildBaseStats(species),
    abilities: abilityIds,
    weightKg: species.weightkg,
    learnset,
    megaForms,
  };
}

function buildMove(id) {
  const move = moves[id];
  const functions = move[FUNCTION_NAMES] ?? [];
  const result = {
    id,
    name: japaneseName('moves', jaMoves, id, move.name),
    nameEn: move.name,
    type: toId(move.type),
    category: move.category.toLowerCase(), // "physical" | "special" | "status"
    power: move.basePower,
    accuracy: move.accuracy === true ? null : move.accuracy, // null = 必ず当たる
    priority: move.priority,
    target: move.target,
    flags: Object.keys(move.flags ?? {}).sort(),
  };
  if (move.multihit !== undefined) result.multihit = move.multihit;
  // ここから下は、ふつうと違う計算をする技の目印(取得元の表記のまま)
  if (move.overrideOffensiveStat) result.overrideOffensiveStat = move.overrideOffensiveStat; // 攻撃に使う能力(ボディプレス)
  if (move.overrideOffensivePokemon) result.overrideOffensivePokemon = move.overrideOffensivePokemon; // 誰の能力で攻撃するか(イカサマ)
  if (move.overrideDefensiveStat) result.overrideDefensiveStat = move.overrideDefensiveStat; // 受けるときの能力(サイコショック)
  if (move.ignoreDefensive) result.ignoreDefensive = true; // 相手の防御ランクを無視する(DDラリアット)
  if (move.willCrit) result.alwaysCritical = true; // 必ず急所に当たる
  if (move.recoil || move.hasCrashDamage || move.mindBlownRecoil) result.hasRecoil = true; // 反動がある(すてみ)
  if (move.secondary || (Array.isArray(move.secondaries) && move.secondaries.length > 0)) result.hasSecondary = true; // 追加効果がある(ちからずく)
  // 威力が状況で変わる技(けたぐり など)。表の数値だけでは威力が決まらないという目印
  if (functions.includes('basePowerCallback')) result.variablePower = true;
  return result;
}

function buildAbility(id) {
  const ability = abilities[id];
  return { id, name: japaneseName('abilities', jaAbilities, id, ability.name), nameEn: ability.name };
}

function buildItem(id) {
  const item = items[id];
  const result = { id, name: japaneseName('items', jaItems, id, item.name), nameEn: item.name };
  if (item.megaStone) result.isMegaStone = true;
  if (item.fling?.basePower) result.flingPower = item.fling.basePower; // 「なげつける」で投げたときの威力
  return result;
}

console.log('アプリ用のデータを組み立てます');

// --- ポケモン ---
const pokemon = [];
for (const id of config.pokemon) {
  const species = basePokedex[id];
  if (!species) throw new Error(`data-config.json の "${id}" は取得元に存在しない ID です`);
  if (species.battleOnly || megaStonesIncludes(id)) {
    throw new Error(`"${id}" は戦闘中だけの姿です。元のポケモンの ID を書いてください`);
  }
  if (!isSpeciesAvailable(id)) throw new Error(`"${id}" は取得元のデータではチャンピオンズで使えないポケモンです`);
  pokemon.push(buildPokemon(id));
}

function megaStonesIncludes(id) {
  for (const list of megaStonesBySpeciesName.values()) {
    if (list.some((entry) => entry.megaId === id)) return true;
  }
  return false;
}

// --- 技・特性: 上のポケモンが使うものだけ ---
const moveIds = [...new Set(pokemon.flatMap((p) => p.learnset))].sort();
const abilityIds = [
  ...new Set(pokemon.flatMap((p) => [...p.abilities, ...p.megaForms.map((form) => form.ability)])),
].sort();
for (const id of abilityIds) {
  if (!isAvailable(abilities[id])) warn(`特性 "${id}" は取得元のデータではチャンピオンズで使えない扱いです`);
}

// --- 持ち物: 誰でも持てる持ち物すべて + 上のポケモンのメガストーン ---
const megaStoneIds = new Set(pokemon.flatMap((p) => p.megaForms.map((form) => form.requiredItem)));
const itemIds = Object.keys(items)
  .filter((id) => isAvailable(items[id]) && (!items[id].megaStone || megaStoneIds.has(id)))
  .sort();

// --- 性格 ---
const natureList = Object.entries(natures).map(([id, nature]) => ({
  id,
  name: japaneseName('natures', jaNatures, id, nature.name),
  nameEn: nature.name,
  up: nature.plus ?? null, // 上がる能力。補正なしの性格は null
  down: nature.minus ?? null, // 下がる能力
}));

// --- タイプと相性表 ---
// 取得元は「受ける側から見た表」で、記号は 0=等倍 1=ばつぐん 2=いまひとつ 3=こうかなし。
// アプリでは「攻撃する技のタイプ → 受ける側のタイプ → 倍率」で引ける形に直す。
const DAMAGE_TAKEN_TO_MULTIPLIER = { 0: 1, 1: 2, 2: 0.5, 3: 0 };
// 並び順はゲーム内部の順番(ノーマル、かくとう、ひこう…)。PokéAPI のタイプ番号の順に合わせる
const typeOrder = new Map(csv.types.map((row) => [toId(row.identifier), Number(row.id)]));
const typeIds = Object.keys(typeChart)
  .filter((id) => isAvailable(typeChart[id]) && id !== 'stellar')
  .sort((a, b) => (typeOrder.get(a) ?? 999) - (typeOrder.get(b) ?? 999));
const typeNameEn = Object.fromEntries(
  typeIds.map((id) => [id, Object.keys(typeChart[id].damageTaken).find((name) => toId(name) === id)]),
);
const effectiveness = {};
for (const attackId of typeIds) {
  effectiveness[attackId] = {};
  for (const defendId of typeIds) {
    const code = typeChart[defendId].damageTaken[typeNameEn[attackId]];
    effectiveness[attackId][defendId] = DAMAGE_TAKEN_TO_MULTIPLIER[code];
  }
}
const types = {
  types: typeIds.map((id) => ({ id, name: japaneseName('types', jaTypes, id, typeNameEn[id]), nameEn: typeNameEn[id] })),
  effectiveness,
};

// ---------------------------------------------------------------------------
// 5. 書き出す
// ---------------------------------------------------------------------------

const output = {
  'pokemon.json': pokemon,
  'moves.json': moveIds.map(buildMove),
  'abilities.json': abilityIds.map(buildAbility),
  'items.json': itemIds.map(buildItem),
  'natures.json': natureList,
  'types.json': types,
};
output['sources.json'] = {
  _readme: 'このフォルダの JSON の出典。npm run data:build が自動で書き出します。手で編集しないでください。',
  generatedOn: new Date().toISOString().slice(0, 10),
  sources: Object.entries(config.sources).map(([id, source]) => ({
    id,
    name: source.name,
    url: `https://github.com/${source.repo}`,
    commit: source.commit,
    license: source.license,
    copyright: source.copyright,
    usedFor: source.usedFor,
  })),
  counts: {
    pokemon: pokemon.length,
    megaForms: pokemon.reduce((sum, p) => sum + p.megaForms.length, 0),
    moves: moveIds.length,
    abilities: abilityIds.length,
    items: itemIds.length,
  },
  warnings,
};

await mkdir(OUT_DIR, { recursive: true });
for (const [fileName, data] of Object.entries(output)) {
  await writeFile(path.join(OUT_DIR, fileName), stringify(data) + '\n');
}

/**
 * 読みやすい JSON にする。
 * ふつうに整形すると「技を1つ覚えるごとに1行」になって縦に長くなりすぎるので、
 * 数値や文字だけが並ぶ短い配列・小さなオブジェクトは1行にまとめる。
 */
function stringify(value, indent = '') {
  const oneLine = JSON.stringify(value);
  const isFlat = (v) => typeof v !== 'object' || v === null;
  if (isFlat(value)) return oneLine;
  const children = Array.isArray(value) ? value : Object.values(value);
  if (children.every(isFlat) && oneLine.length <= 100) {
    return oneLine.replace(/([,:])/g, '$1 ').replace(/^\{(.+)\}$/, '{ $1 }');
  }
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    if (children.every(isFlat)) return wrapFlatArray(value, inner, indent);
    return `[\n${value.map((v) => inner + stringify(v, inner)).join(',\n')}\n${indent}]`;
  }
  const lines = Object.entries(value).map(([key, v]) => `${inner}${JSON.stringify(key)}: ${stringify(v, inner)}`);
  return `{\n${lines.join(',\n')}\n${indent}}`;
}

/** 長い配列(覚える技の一覧など)を、1行100文字くらいで折り返す */
function wrapFlatArray(array, inner, indent) {
  const lines = [];
  let line = '';
  for (const item of array) {
    const text = JSON.stringify(item);
    if (line && (inner + line + ', ' + text).length > 100) {
      lines.push(line + ',');
      line = text;
    } else {
      line = line ? `${line}, ${text}` : text;
    }
  }
  lines.push(line);
  return `[\n${lines.map((l) => inner + l).join('\n')}\n${indent}]`;
}

// ---------------------------------------------------------------------------
// 6. 結果を表示する
// ---------------------------------------------------------------------------

console.log('\n書き出しました → src/data/');
console.table(output['sources.json'].counts);
for (const p of pokemon) {
  const megaNames = p.megaForms.map((form) => form.name).join('、') || 'なし';
  console.log(`  ${p.name}: 特性 ${p.abilities.length} / 技 ${p.learnset.length} / メガシンカ ${megaNames}`);
}
if (warnings.length > 0) {
  console.log(`\n確認が必要なこと (${warnings.length}件)`);
  for (const message of warnings) console.log(`  - ${message}`);
} else {
  console.log('\n確認が必要なことはありません');
}
