// 公開データのファイル(TypeScript で書かれた大きな表)から、値だけを取り出す道具。
//
// 元のファイルはこういう形をしています:
//
//   export const Pokedex = {
//     garchomp: { num: 445, name: "Garchomp", types: ["Dragon", "Ground"], ... },
//     ...
//   };
//
// 【大事な方針】このファイルを「プログラムとして実行」はしません。
// 外から取ってきたプログラムを実行すると、何が起きるか保証できないからです。
// 代わりに、文章を文法どおりに分解した木(構文木 = AST)を作り、
// そこから文字・数値・配列などの「値」だけを拾います。関数は読み飛ばします。

import { parse } from '@babel/parser';

/** 「値として取り出せなかった」ことを表す目印 */
const SKIP = Symbol('skip');

/** 関数として書かれていた項目の名前の一覧を入れておく場所の名前 */
export const FUNCTION_NAMES = '$functions';

/**
 * TypeScript のソースコードから、`export const 名前 = { ... }` の中身を
 * ふつうの JavaScript のオブジェクトとして取り出す。
 * @param {string} code ソースコード全体
 * @param {string} exportName 取り出したい変数の名前(例: "Pokedex")
 */
export function extractExportedObject(code, exportName) {
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] });

  for (const node of ast.program.body) {
    if (node.type !== 'ExportNamedDeclaration') continue;
    const declaration = node.declaration;
    if (!declaration || declaration.type !== 'VariableDeclaration') continue;
    for (const d of declaration.declarations) {
      if (d.id.type === 'Identifier' && d.id.name === exportName) {
        const value = toValue(d.init);
        if (value === SKIP) throw new Error(`${exportName} の中身を値として読めませんでした`);
        return value;
      }
    }
  }
  throw new Error(`export const ${exportName} が見つかりません`);
}

/** 構文木の1つの部品を、JavaScript の値に変換する */
function toValue(node) {
  if (!node) return SKIP;
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'NullLiteral':
      return null;
    case 'TemplateLiteral':
      // `文字` の形。途中に ${...} が無いものだけ値として扱う
      return node.expressions.length === 0 ? node.quasis[0].value.cooked : SKIP;
    case 'UnaryExpression': {
      // -1 のような負の数
      const inner = toValue(node.argument);
      if (node.operator === '-' && typeof inner === 'number') return -inner;
      return SKIP;
    }
    case 'ArrayExpression': {
      const result = [];
      for (const element of node.elements) {
        const value = toValue(element);
        if (value === SKIP) return SKIP;
        result.push(value);
      }
      return result;
    }
    case 'ObjectExpression': {
      const result = {};
      const functionNames = [];
      for (const property of node.properties) {
        if (property.type === 'SpreadElement' || property.computed) continue; // ...展開 は読み飛ばす
        const key = propertyKey(property.key);
        if (key === null) continue;
        if (property.type === 'ObjectMethod') {
          functionNames.push(key); // 関数は中身を読まず、名前だけ控える
          continue;
        }
        const value = toValue(property.value);
        if (value !== SKIP) result[key] = value;
        else if (isFunction(property.value)) functionNames.push(key);
      }
      // 「この項目は関数で決まる(=表の数値だけでは決まらない)」ことを後で調べられるようにする
      if (functionNames.length > 0) result[FUNCTION_NAMES] = functionNames;
      return result;
    }
    // `値 as 型` や `値 satisfies 型` は、型の部分を無視して値だけ見る
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return toValue(node.expression);
    default:
      // 関数、変数の参照、計算式などは値として取り出さない
      return SKIP;
  }
}

function isFunction(node) {
  return node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression';
}

function propertyKey(key) {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  if (key.type === 'NumericLiteral') return String(key.value);
  return null;
}

/**
 * CSV(カンマ区切りの表)を「1行=1オブジェクト」の配列にする。
 * 1行目を見出しとして使う。"..." で囲まれた項目(中にカンマや改行があってもよい)に対応。
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'; // "" は「" という1文字」の意味
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return body
    .filter((cells) => cells.length === header.length)
    .map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index]])));
}

/**
 * 英語名から ID を作る。英字と数字だけを残して小文字にする。
 * 例: "Dragon Claw" → "dragonclaw"、"Garchomp-Mega" → "garchompmega"
 * (Pokémon Showdown と同じ決まり)
 */
export function toId(text) {
  return String(text)
    .normalize('NFD') // "é" を "e" と「アクセント記号」に分ける
    .replace(/[̀-ͯ]/g, '') // アクセント記号を取り除く
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}
