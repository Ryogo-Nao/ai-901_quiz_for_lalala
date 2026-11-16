// IndexedDB(ブラウザに組み込まれたデータベース)を開く。
//
// IndexedDB の用語
//   ・データベース … 入れ物全体。名前は "champions-tool"
//   ・ストア       … データベースの中の「保存場所」。表のようなもの
//   ・トランザクション … ひとまとまりの読み書き。途中で失敗したら、全部が無かったことになる
//
// 番号が2種類あることに注意
//   ・DB_VERSION            … ストアを増やすなど「保存場所の構造」を変えたときに上げる
//   ・CURRENT_SCHEMA_VERSION … 個体やチームの「中身の形」を変えたときに上げる(migrations.ts)

import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { Individual } from '../domain/individual.ts';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations.ts';

const DB_NAME = 'champions-tool';
const DB_VERSION = 1;

/** データベースの中身の形。TypeScript に「どのストアに何が入るか」を伝える */
interface AppDb extends DBSchema {
  /** 個体。見出し(キー)は個体の id */
  individuals: { key: string; value: Individual };
  /** チーム(ステップ3で使う) */
  teams: { key: string; value: { id: string } };
  /** そのほかの設定。「名前 → 値」で入れる */
  meta: { key: string; value: unknown };
}

export type AppDatabase = IDBPDatabase<AppDb>;

let dbPromise: Promise<AppDatabase> | null = null;

/** データベースを開く。2回目からは、開いてあるものを使い回す */
export function getDb(): Promise<AppDatabase> {
  dbPromise ??= open();
  return dbPromise;
}

async function open(): Promise<AppDatabase> {
  const db = await openDB<AppDb>(DB_NAME, DB_VERSION, {
    // 初めて開いたとき(または DB_VERSION を上げたとき)に呼ばれる。ここでストアを作る
    upgrade(database) {
      if (!database.objectStoreNames.contains('individuals')) database.createObjectStore('individuals', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('teams')) database.createObjectStore('teams', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
    },
  });
  await migrateStoredData(db);
  return db;
}

/**
 * 保存されているデータが古い形式なら、いまの形式に変換して保存し直す。
 * 読む → 変換する → 書く を1つのトランザクションで行うので、途中で失敗しても中途半端な状態は残らない。
 */
async function migrateStoredData(db: AppDatabase): Promise<void> {
  const tx = db.transaction(['individuals', 'teams', 'meta'], 'readwrite');
  const stored = (await tx.objectStore('meta').get('schemaVersion')) as number | undefined;

  if (stored === undefined) {
    // 初めて使う → いまの番号を書いておく
    await tx.objectStore('meta').put(CURRENT_SCHEMA_VERSION, 'schemaVersion');
  } else if (stored !== CURRENT_SCHEMA_VERSION) {
    // 新しすぎる場合は migrate がエラーを出し、何も書き換えずに終わる
    const migrated = migrate({
      schemaVersion: stored,
      individuals: await tx.objectStore('individuals').getAll(),
      teams: await tx.objectStore('teams').getAll(),
    });
    await tx.objectStore('individuals').clear();
    await tx.objectStore('teams').clear();
    for (const individual of migrated.individuals) await tx.objectStore('individuals').put(individual as Individual);
    for (const team of migrated.teams) await tx.objectStore('teams').put(team as { id: string });
    await tx.objectStore('meta').put(migrated.schemaVersion, 'schemaVersion');
  }
  await tx.done;
}

/** テスト用: 開いてあるデータベースを閉じて、次の getDb で開き直させる */
export async function closeDbForTest(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
