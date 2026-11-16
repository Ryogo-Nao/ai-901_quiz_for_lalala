// 「チーム」のデータの形と、チームを変えるときの決まり。
//
// チームは個体の「写し」ではなく、個体の id だけを持つ。
// だから個体を編集すれば、その個体が入っているすべてのチームに反映される。
//
// どの関数も、元のチームを書き換えずに「新しいチーム」を返す(純粋関数)。

import { MAX_TEAM_MEMBERS } from './limits.ts';

/** チーム名の長さの上限(このアプリの決まり) */
export const MAX_TEAM_NAME_LENGTH = 30;

export interface Team {
  /** このチームだけの番号(自動で作る) */
  id: string;
  name: string;
  /** 個体の id を最大6つ。この配列の順番が、そのまま並び順 */
  memberIds: string[];
  /** チーム一覧での並び順(小さいほど上) */
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** 新しいチームを作る */
export function createTeam(name: string, order: number): Team {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, memberIds: [], order, createdAt: now, updatedAt: now };
}

/** 保存されていたデータを、いまのチームの形に整える(足りない項目を補う) */
export function normalizeTeam(raw: Partial<Team> & Pick<Team, 'id'>): Team {
  const now = new Date().toISOString();
  return {
    ...raw,
    name: raw.name ?? '',
    memberIds: raw.memberIds ?? [],
    order: raw.order ?? 0,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

/** チーム名を変える。前後の空白は取り、長すぎる分は切り捨てる */
export function renameTeam(team: Team, name: string): Team {
  return { ...team, name: [...name.trim()].slice(0, MAX_TEAM_NAME_LENGTH).join('') };
}

/** これ以上メンバーを足せないか */
export function isTeamFull(team: Team): boolean {
  return team.memberIds.length >= MAX_TEAM_MEMBERS;
}

/** メンバーを足す。満員のとき、すでに入っている個体のときは、何も変えない */
export function addMember(team: Team, individualId: string): Team {
  if (isTeamFull(team) || team.memberIds.includes(individualId)) return team;
  return { ...team, memberIds: [...team.memberIds, individualId] };
}

/** メンバーを外す */
export function removeMember(team: Team, individualId: string): Team {
  if (!team.memberIds.includes(individualId)) return team;
  return { ...team, memberIds: team.memberIds.filter((id) => id !== individualId) };
}

/**
 * 配列の中で、1つの要素を別の位置へ動かした新しい配列を返す。
 * チームのメンバーの並べ替えと、チーム一覧の並べ替えの両方で使う。
 */
export function moveItem<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  const inRange = (index: number) => Number.isInteger(index) && index >= 0 && index < list.length;
  if (!inRange(fromIndex) || !inRange(toIndex)) return [...list];
  const result = [...list];
  const [item] = result.splice(fromIndex, 1); // 取り出して
  result.splice(toIndex, 0, item); // 差し込む
  return result;
}

/** メンバーの並び順を変える */
export function moveMember(team: Team, fromIndex: number, toIndex: number): Team {
  return { ...team, memberIds: moveItem(team.memberIds, fromIndex, toIndex) };
}

/** チームの複製を作る。メンバーの id の並びを写す(個体そのものは増やさない) */
export function duplicateTeam(source: Team, order: number): Team {
  const copy = createTeam(renameTeam(source, `${source.name} のコピー`).name, order);
  return { ...copy, memberIds: [...source.memberIds] };
}

/** その個体が入っているチームだけを取り出す */
export function teamsContaining(teams: readonly Team[], individualId: string): Team[] {
  return teams.filter((team) => team.memberIds.includes(individualId));
}
