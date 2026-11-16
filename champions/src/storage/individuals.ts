// 個体の読み書き。画面は IndexedDB を直接さわらず、ここの関数を呼ぶ。

import { duplicateIndividual, normalizeIndividual, type Individual } from '../domain/individual.ts';
import { MAX_INDIVIDUALS } from '../domain/limits.ts';
import { getDb } from './db.ts';

/** 保存できる数の上限に達したときのエラー */
export class LimitReachedError extends Error {
  constructor() {
    super(`個体は${MAX_INDIVIDUALS}体まで保存できます。使わない個体を削除してから、もう一度保存してください。`);
    this.name = 'LimitReachedError';
  }
}

/** 保存されている個体をすべて読む。更新が新しい順に並べる */
export async function listIndividuals(): Promise<Individual[]> {
  const db = await getDb();
  const all = await db.getAll('individuals');
  return all.map(normalizeIndividual).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 個体を保存する。同じ id の個体があれば上書き、無ければ新しく追加する。
 * 新しく追加するときに上限に達していたら、LimitReachedError を出して何も保存しない。
 * @returns 保存した個体(更新日時が新しくなっている)
 */
export async function saveIndividual(individual: Individual): Promise<Individual> {
  const db = await getDb();
  const saved: Individual = { ...individual, updatedAt: new Date().toISOString() };

  // 「数を数える」と「保存する」を1つのトランザクションで行う。
  // 別々に行うと、その間に別のタブで追加されて上限を超えるおそれがある
  const tx = db.transaction('individuals', 'readwrite');
  const isNew = (await tx.store.getKey(saved.id)) === undefined;
  if (isNew && (await tx.store.count()) >= MAX_INDIVIDUALS) {
    tx.abort();
    await tx.done.catch(() => {}); // 中止したことによるエラーは無視する
    throw new LimitReachedError();
  }
  await tx.store.put(saved);
  await tx.done;
  return saved;
}

/** 個体を複製して保存する。上限に達していたら LimitReachedError */
export async function saveDuplicate(source: Individual): Promise<Individual> {
  return saveIndividual(duplicateIndividual(source));
}

/** 個体を削除する */
export async function deleteIndividual(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('individuals', id);
}
