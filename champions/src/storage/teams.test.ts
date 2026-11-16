// チームの保存のテスト。

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createIndividual } from '../domain/individual.ts';
import { MAX_TEAMS } from '../domain/limits.ts';
import { addMember, renameTeam } from '../domain/team.ts';
import { closeDbForTest } from './db.ts';
import { LimitReachedError } from './errors.ts';
import { deleteIndividual, listIndividuals, saveIndividual } from './individuals.ts';
import { createAndSaveTeam, deleteTeam, listTeams, saveTeam, saveTeamDuplicate, saveTeamOrder } from './teams.ts';

beforeEach(async () => {
  await closeDbForTest();
  globalThis.indexedDB = new IDBFactory();
});

describe('作成・変更・削除', () => {
  it('作ると「チーム1」「チーム2」…と名前が付き、作った順に並ぶ', async () => {
    await createAndSaveTeam();
    await createAndSaveTeam();
    expect((await listTeams()).map((team) => team.name)).toEqual(['チーム1', 'チーム2']);
  });

  it('名前とメンバーの変更を保存できる', async () => {
    const team = await createAndSaveTeam();
    await saveTeam(addMember(renameTeam(team, '雨パ'), 'individual-1'));
    const [loaded] = await listTeams();
    expect(loaded.name).toBe('雨パ');
    expect(loaded.memberIds).toEqual(['individual-1']);
  });

  it('複製は一覧の最後に入り、メンバーは同じ', async () => {
    const team = await saveTeam(addMember(await createAndSaveTeam(), 'individual-1'));
    await createAndSaveTeam();
    await saveTeamDuplicate(team);
    const teams = await listTeams();
    expect(teams.map((t) => t.name)).toEqual(['チーム1', 'チーム2', 'チーム1 のコピー']);
    expect(teams[2].memberIds).toEqual(['individual-1']);
  });

  it('削除できる', async () => {
    const team = await createAndSaveTeam();
    await deleteTeam(team.id);
    expect(await listTeams()).toEqual([]);
  });

  it('並び順を保存できる', async () => {
    const a = await createAndSaveTeam();
    const b = await createAndSaveTeam();
    const c = await createAndSaveTeam();
    await saveTeamOrder([c.id, a.id, b.id]);
    expect((await listTeams()).map((team) => team.name)).toEqual(['チーム3', 'チーム1', 'チーム2']);
  });
});

describe(`上限(${MAX_TEAMS}チーム)`, () => {
  it('10個まで作れて、11個目は作成も複製もできない。削除すればまた作れる', async () => {
    const teams = [];
    for (let i = 0; i < MAX_TEAMS; i++) teams.push(await createAndSaveTeam());
    await expect(createAndSaveTeam()).rejects.toBeInstanceOf(LimitReachedError);
    await expect(saveTeamDuplicate(teams[0])).rejects.toBeInstanceOf(LimitReachedError);
    expect((await listTeams()).length).toBe(MAX_TEAMS);
    await deleteTeam(teams[0].id);
    await expect(createAndSaveTeam()).resolves.toBeDefined();
  });
});

describe('個体を削除したとき', () => {
  it('その個体は、入っていたすべてのチームから外れる。ほかのメンバーは残る', async () => {
    const garchomp = await saveIndividual(createIndividual('garchomp', 'roughskin'));
    const pikachu = await saveIndividual(createIndividual('pikachu', 'static'));
    const team1 = await createAndSaveTeam();
    const team2 = await createAndSaveTeam();
    await saveTeam(addMember(addMember(team1, garchomp.id), pikachu.id));
    await saveTeam(addMember(team2, garchomp.id));

    await deleteIndividual(garchomp.id);

    const teams = await listTeams();
    expect(teams[0].memberIds).toEqual([pikachu.id]);
    expect(teams[1].memberIds).toEqual([]);
    expect((await listIndividuals()).map((i) => i.id)).toEqual([pikachu.id]);
  });

  it('チームを削除しても、個体は消えない', async () => {
    const garchomp = await saveIndividual(createIndividual('garchomp', 'roughskin'));
    const team = await saveTeam(addMember(await createAndSaveTeam(), garchomp.id));
    await deleteTeam(team.id);
    expect((await listIndividuals()).length).toBe(1);
  });
});
