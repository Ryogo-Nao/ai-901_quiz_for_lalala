// チームの読み書き。

import { MAX_TEAMS } from '../domain/limits.ts';
import { createTeam, duplicateTeam, normalizeTeam, type Team } from '../domain/team.ts';
import { getDb } from './db.ts';
import { LimitReachedError } from './errors.ts';

/** 保存されているチームをすべて読む。並び順(order)の小さい順 */
export async function listTeams(): Promise<Team[]> {
  const db = await getDb();
  return (await db.getAll('teams')).map(normalizeTeam).sort((a, b) => a.order - b.order);
}

/**
 * 新しいチームを追加する(共通の処理)。
 * 「数を数える」「並び順を決める」「保存する」を1つのトランザクションで行う。
 * @param build 一覧の最後に置くための並び順と、いまのチーム数を受け取って、チームを作る関数
 */
async function addTeam(build: (order: number, count: number) => Team): Promise<Team> {
  const db = await getDb();
  const tx = db.transaction('teams', 'readwrite');
  const existing = (await tx.store.getAll()).map(normalizeTeam);
  if (existing.length >= MAX_TEAMS) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new LimitReachedError(
      `チームは${MAX_TEAMS}個まで保存できます。使わないチームを削除してから、もう一度お試しください。`,
    );
  }
  const nextOrder = existing.reduce((max, team) => Math.max(max, team.order), -1) + 1;
  const team = build(nextOrder, existing.length);
  await tx.store.put(team);
  await tx.done;
  return team;
}

/** 空のチームを新しく作って保存する。名前は「チーム3」のように自動で付ける */
export function createAndSaveTeam(): Promise<Team> {
  return addTeam((order, count) => createTeam(`チーム${count + 1}`, order));
}

/** チームを複製して保存する */
export function saveTeamDuplicate(source: Team): Promise<Team> {
  return addTeam((order) => duplicateTeam(source, order));
}

/** チームの変更を保存する(上書き) */
export async function saveTeam(team: Team): Promise<Team> {
  const db = await getDb();
  const saved = { ...team, updatedAt: new Date().toISOString() };
  await db.put('teams', saved);
  return saved;
}

/** チームを削除する(メンバーの個体は消えない) */
export async function deleteTeam(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('teams', id);
}

/**
 * チーム一覧の並び順を保存する。
 * @param orderedIds 並べたい順の、チームの id
 */
export async function saveTeamOrder(orderedIds: readonly string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('teams', 'readwrite');
  for (const [index, id] of orderedIds.entries()) {
    const team = await tx.store.get(id);
    if (team) await tx.store.put({ ...team, order: index });
  }
  await tx.done;
}
