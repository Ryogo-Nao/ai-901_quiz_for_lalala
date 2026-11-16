// 書き出しと読み込みのテスト。

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createIndividual } from '../domain/individual.ts';
import { addMember, createTeam } from '../domain/team.ts';
import { closeDbForTest } from './db.ts';
import { LimitReachedError } from './errors.ts';
import { ImportError, buildExport, exportAll, importAll, parseImport, planImport, type DataSet } from './exportImport.ts';
import { listIndividuals, saveIndividual } from './individuals.ts';
import { CURRENT_SCHEMA_VERSION } from './migrations.ts';
import { createAndSaveTeam, listTeams, saveTeam } from './teams.ts';

beforeEach(async () => {
  await closeDbForTest();
  globalThis.indexedDB = new IDBFactory();
});

const garchomp = () => ({ ...createIndividual('garchomp', 'roughskin'), nickname: 'ガブ' });
const fileOf = (data: DataSet) => JSON.stringify(buildExport(data));

describe('parseImport: ファイルの中身を調べる', () => {
  it('書き出したものは、そのまま読み込める', () => {
    const individual = garchomp();
    const team = addMember(createTeam('雨パ', 0), individual.id);
    expect(parseImport(fileOf({ individuals: [individual], teams: [team] }))).toEqual({ individuals: [individual], teams: [team] });
  });
  it('JSON でない文字は読み込めない', () => {
    expect(() => parseImport('これはJSONではありません')).toThrow(ImportError);
  });
  it('ほかのアプリのファイルは読み込めない', () => {
    expect(() => parseImport(JSON.stringify({ app: 'other', schemaVersion: 1, individuals: [], teams: [] }))).toThrow(
      'このアプリで書き出したファイルではありません',
    );
  });
  it('必要な項目が無いファイルは読み込めない', () => {
    expect(() => parseImport(JSON.stringify({ app: 'champions-tool', schemaVersion: 1 }))).toThrow('壊れています');
    const broken = { app: 'champions-tool', schemaVersion: 1, individuals: [{ nickname: 'id が無い' }], teams: [] };
    expect(() => parseImport(JSON.stringify(broken))).toThrow('1番目の個体');
  });
  it('新しすぎる形式のファイルは読み込めない', () => {
    const newer = { app: 'champions-tool', schemaVersion: CURRENT_SCHEMA_VERSION + 1, individuals: [], teams: [] };
    expect(() => parseImport(JSON.stringify(newer))).toThrow('アプリを更新してください');
  });
  it('項目が足りない古い個体は、初期値で補って読み込む', () => {
    const old = { app: 'champions-tool', schemaVersion: 1, individuals: [{ id: 'x', speciesId: 'garchomp' }], teams: [] };
    const [individual] = parseImport(JSON.stringify(old)).individuals;
    expect(individual.gimmicks).toEqual({});
    expect(individual.moveIds).toEqual([null, null, null, null]);
  });
});

describe('planImport: いまのデータとの合わせ方', () => {
  const a = garchomp();
  const b = { ...createIndividual('pikachu', 'static'), nickname: 'ピカ' };

  it('置き換える: 読み込んだデータだけになる', () => {
    const result = planImport({ individuals: [a], teams: [] }, { individuals: [b], teams: [] }, 'replace');
    expect(result.individuals.map((i) => i.nickname)).toEqual(['ピカ']);
  });
  it('追加する: 両方が残る', () => {
    const result = planImport({ individuals: [a], teams: [] }, { individuals: [b], teams: [] }, 'merge');
    expect(result.individuals.map((i) => i.nickname)).toEqual(['ガブ', 'ピカ']);
  });
  it('追加する: 同じ id は、読み込んだほうで上書きされる(2体に増えない)', () => {
    const result = planImport({ individuals: [a], teams: [] }, { individuals: [{ ...a, nickname: '新' }], teams: [] }, 'merge');
    expect(result.individuals.map((i) => i.nickname)).toEqual(['新']);
  });
  it('チームのメンバーのうち、個体が無いものは外れる', () => {
    const team = { ...createTeam('チーム', 0), memberIds: [a.id, 'もう無い個体'] };
    const result = planImport({ individuals: [], teams: [] }, { individuals: [a], teams: [team] }, 'replace');
    expect(result.teams[0].memberIds).toEqual([a.id]);
  });
  it('個体が上限の500体を超えるなら、読み込まない', () => {
    const many = Array.from({ length: 500 }, () => garchomp());
    expect(() => planImport({ individuals: many, teams: [] }, { individuals: [b], teams: [] }, 'merge')).toThrow(LimitReachedError);
    expect(planImport({ individuals: many, teams: [] }, { individuals: [b], teams: [] }, 'replace').individuals.length).toBe(1);
  });
  it('チームが上限の10個を超えるなら、読み込まない', () => {
    const teams = (count: number) => Array.from({ length: count }, (_, index) => createTeam(`チーム${index}`, index));
    expect(() => planImport({ individuals: [], teams: teams(6) }, { individuals: [], teams: teams(5) }, 'merge')).toThrow(
      LimitReachedError,
    );
  });
});

describe('書き出す → 消す → 読み込む で、元に戻る', () => {
  it('個体・チーム・メンバー・並び順が戻る', async () => {
    const saved = await saveIndividual({ ...garchomp(), statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } });
    await saveTeam(addMember({ ...(await createAndSaveTeam()), name: 'メガ軸' }, saved.id));
    const text = await exportAll();

    // データを全部消す(別の端末に移したのと同じ状態)
    await closeDbForTest();
    globalThis.indexedDB = new IDBFactory();
    expect(await listIndividuals()).toEqual([]);

    expect(await importAll(text, 'replace')).toEqual({ individuals: 1, teams: 1 });
    const [individual] = await listIndividuals();
    const [team] = await listTeams();
    expect(individual.nickname).toBe('ガブ');
    expect(individual.statPoints.atk).toBe(32);
    expect(team.name).toBe('メガ軸');
    expect(team.memberIds).toEqual([saved.id]);
  });

  it('読み込めないファイルのときは、いまのデータを変えない', async () => {
    await saveIndividual(garchomp());
    await expect(importAll('壊れたファイル', 'replace')).rejects.toBeInstanceOf(ImportError);
    expect((await listIndividuals()).length).toBe(1);
  });
});
