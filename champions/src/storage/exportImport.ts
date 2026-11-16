// 全データの書き出しと読み込み(機種変更などで、データを別の端末へ移すため)。
//
// 書き出しファイルの形:
//   { "app": "champions-tool", "schemaVersion": 1, "exportedAt": "...", "individuals": [...], "teams": [...] }
//
// このファイルの前半(parseImport / planImport)は、画面にも保存にも触れない純粋関数。
// 「ファイルの中身を調べる」「いまのデータとどう合わせるかを決める」をテストできるように分けてある。

import { normalizeIndividual, type Individual } from '../domain/individual.ts';
import { MAX_INDIVIDUALS, MAX_TEAMS, MAX_TEAM_MEMBERS } from '../domain/limits.ts';
import { normalizeTeam, type Team } from '../domain/team.ts';
import { getDb } from './db.ts';
import { LimitReachedError } from './errors.ts';
import { listIndividuals } from './individuals.ts';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations.ts';
import { listTeams } from './teams.ts';

/** このアプリのファイルであることを示す目印 */
export const APP_ID = 'champions-tool';

/** 書き出しファイルの形 */
export interface ExportFile {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: string;
  individuals: Individual[];
  teams: Team[];
}

/** 個体とチームの一式 */
export interface DataSet {
  individuals: Individual[];
  teams: Team[];
}

/** 読み込めないファイルだったときのエラー。message は、利用者にそのまま見せる説明 */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/** 読み込みのしかた。replace = いまのデータを消して置き換える、merge = いまのデータに追加する */
export type ImportMode = 'replace' | 'merge';

/** 書き出しファイルの中身を作る */
export function buildExport(data: DataSet, now = new Date()): ExportFile {
  return {
    app: APP_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    individuals: data.individuals,
    teams: data.teams,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * ファイルの文字を読み取り、いまの形式の個体とチームにする。
 * 古い形式のファイルは、マイグレーションで新しい形式に変換する。
 * 読み込めない内容なら、理由つきの ImportError を出す。
 */
export function parseImport(text: string): DataSet {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('ファイルを読み取れませんでした。このアプリで書き出した JSON ファイルを選んでください。');
  }
  if (!isRecord(parsed) || parsed.app !== APP_ID) {
    throw new ImportError('このアプリで書き出したファイルではありません。');
  }
  if (typeof parsed.schemaVersion !== 'number' || !Array.isArray(parsed.individuals) || !Array.isArray(parsed.teams)) {
    throw new ImportError('ファイルの中身が壊れています(必要な項目がありません)。');
  }

  // 古い形式なら、いまの形式まで変換する(新しすぎる形式なら、ここでエラーになる)
  const migrated = migrate({
    schemaVersion: parsed.schemaVersion,
    individuals: parsed.individuals,
    teams: parsed.teams,
  });

  const individuals = migrated.individuals.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.speciesId !== 'string') {
      throw new ImportError(`ファイルの中身が壊れています(${index + 1}番目の個体)。`);
    }
    return normalizeIndividual(raw as Partial<Individual> & Pick<Individual, 'id' | 'speciesId'>);
  });
  const teams = migrated.teams.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== 'string') {
      throw new ImportError(`ファイルの中身が壊れています(${index + 1}番目のチーム)。`);
    }
    return normalizeTeam(raw as Partial<Team> & Pick<Team, 'id'>);
  });
  return { individuals: uniqueById(individuals), teams: uniqueById(teams) };
}

/** 同じ id が2つ以上あったら、あとのものを残す */
function uniqueById<T extends { id: string }>(list: T[]): T[] {
  return [...new Map(list.map((entry) => [entry.id, entry])).values()];
}

/**
 * 読み込んだあとのデータを決める。
 *   replace … 読み込んだデータだけにする
 *   merge   … いまのデータに足す。同じ id のものは、読み込んだほうで上書きする
 * 上限(個体500、チーム10)を超えるなら、何も変えずに LimitReachedError を出す。
 */
export function planImport(existing: DataSet, incoming: DataSet, mode: ImportMode): DataSet {
  const individuals = mode === 'replace' ? incoming.individuals : uniqueById([...existing.individuals, ...incoming.individuals]);
  const mergedTeams = mode === 'replace' ? incoming.teams : uniqueById([...existing.teams, ...incoming.teams]);

  if (individuals.length > MAX_INDIVIDUALS) {
    throw new LimitReachedError(
      `読み込むと個体が${individuals.length}体になり、上限の${MAX_INDIVIDUALS}体を超えます。使わない個体を削除するか、「置き換える」を選んでください。`,
    );
  }
  if (mergedTeams.length > MAX_TEAMS) {
    throw new LimitReachedError(
      `読み込むとチームが${mergedTeams.length}個になり、上限の${MAX_TEAMS}個を超えます。使わないチームを削除するか、「置き換える」を選んでください。`,
    );
  }

  // チームのメンバーは、実際にある個体だけにする(重複を除き、最大6体)。並び順は 0, 1, 2… と付け直す
  const knownIds = new Set(individuals.map((individual) => individual.id));
  const teams = [...mergedTeams]
    .sort((a, b) => a.order - b.order)
    .map((team, index) => ({
      ...team,
      order: index,
      memberIds: [...new Set(team.memberIds)].filter((id) => knownIds.has(id)).slice(0, MAX_TEAM_MEMBERS),
    }));
  return { individuals, teams };
}

// ---------------------------------------------------------------------------
// ここから下は、IndexedDB を読み書きする
// ---------------------------------------------------------------------------

/** いまの全データを、書き出しファイルの文字にする */
export async function exportAll(): Promise<string> {
  const data = { individuals: await listIndividuals(), teams: await listTeams() };
  return JSON.stringify(buildExport(data), null, 2);
}

/**
 * ファイルの文字を読み込んで、保存データに反映する。
 * 個体とチームの入れ替えを1つのトランザクションで行うので、途中で失敗しても中途半端な状態は残らない。
 * @returns 読み込んだあとの件数
 */
export async function importAll(text: string, mode: ImportMode): Promise<{ individuals: number; teams: number }> {
  const incoming = parseImport(text);
  const existing = { individuals: await listIndividuals(), teams: await listTeams() };
  const result = planImport(existing, incoming, mode);

  const db = await getDb();
  const tx = db.transaction(['individuals', 'teams'], 'readwrite');
  await tx.objectStore('individuals').clear();
  await tx.objectStore('teams').clear();
  for (const individual of result.individuals) await tx.objectStore('individuals').put(individual);
  for (const team of result.teams) await tx.objectStore('teams').put(team);
  await tx.done;
  return { individuals: result.individuals.length, teams: result.teams.length };
}
