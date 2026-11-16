// 保存形式のバージョン番号と、マイグレーション(古い形式 → 新しい形式への変換)。
//
// 決まり
//   ・省略できる項目を足すだけ → 番号は上げない。読むときに初期値を補う(normalizeIndividual)
//   ・名前や構造や意味を変える → 番号を1つ上げて、下の migrations に変換の関数を1つ足す

/** いまの保存形式のバージョン番号 */
export const CURRENT_SCHEMA_VERSION = 1;

/** 保存データ一式(IndexedDB の中身や、書き出しファイルの中身) */
export interface StoredData {
  schemaVersion: number;
  individuals: unknown[];
  teams: unknown[];
}

/**
 * 「バージョン N のデータを N+1 に変換する関数」を、N を見出しにして並べる。
 * いまはバージョン1しか無いので空。形式を変えたら、ここに足す。
 *
 * 例:
 *   1: (v1) => ({ ...v1, schemaVersion: 2, individuals: v1.individuals.map(v1の個体をv2の形に直す) }),
 */
const migrations: Record<number, (old: StoredData) => StoredData> = {};

/** 新しすぎるデータを読もうとしたときのエラー */
export class NewerSchemaError extends Error {
  constructor(version: number) {
    super(`このデータは新しいバージョンのアプリで作られています(形式 ${version})。アプリを更新してください。`);
    this.name = 'NewerSchemaError';
  }
}

/**
 * データを、いまの形式になるまで1段ずつ変換する。
 * 1段ずつ上げるので、どれだけ古いデータでも順番に通せば最新になる。
 */
export function migrate(data: StoredData, steps = migrations, target = CURRENT_SCHEMA_VERSION): StoredData {
  if (data.schemaVersion > target) throw new NewerSchemaError(data.schemaVersion);
  let current = data;
  while (current.schemaVersion < target) {
    const step = steps[current.schemaVersion];
    if (!step) throw new Error(`形式 ${current.schemaVersion} からの変換方法がありません`);
    current = step(current);
  }
  return current;
}
