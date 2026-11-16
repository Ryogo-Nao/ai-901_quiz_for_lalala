// 個体の保存のテスト。
// テストはブラウザではなく Node.js で動くので、IndexedDB の代わりになる部品(fake-indexeddb)を使う。

import 'fake-indexeddb/auto'; // IndexedDB の代わりになる部品を、ブラウザと同じ名前で使えるようにする
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createIndividual } from '../domain/individual.ts';
import { MAX_INDIVIDUALS } from '../domain/limits.ts';
import { closeDbForTest, getDb } from './db.ts';
import { LimitReachedError, deleteIndividual, listIndividuals, saveDuplicate, saveIndividual } from './individuals.ts';
import { CURRENT_SCHEMA_VERSION } from './migrations.ts';

// テスト1件ごとに、空のデータベースから始める
beforeEach(async () => {
  await closeDbForTest();
  globalThis.indexedDB = new IDBFactory();
});

const garchomp = () => createIndividual('garchomp', 'roughskin');

describe('保存と読み込み', () => {
  it('最初は空', async () => {
    expect(await listIndividuals()).toEqual([]);
  });

  it('保存した個体を読み込める', async () => {
    const individual = { ...garchomp(), nickname: 'ガブ', statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
    await saveIndividual(individual);
    const [loaded] = await listIndividuals();
    expect(loaded.nickname).toBe('ガブ');
    expect(loaded.statPoints.atk).toBe(32);
  });

  it('データベースを開き直しても残っている(ページの再読み込みにあたる)', async () => {
    await saveIndividual(garchomp());
    await closeDbForTest();
    expect((await listIndividuals()).length).toBe(1);
  });

  it('同じ id で保存すると上書きになり、数は増えない', async () => {
    const individual = garchomp();
    await saveIndividual(individual);
    await saveIndividual({ ...individual, nickname: '変更後' });
    const list = await listIndividuals();
    expect(list.length).toBe(1);
    expect(list[0].nickname).toBe('変更後');
  });

  it('更新が新しい順に並ぶ', async () => {
    const older = await saveIndividual({ ...garchomp(), nickname: '先' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveIndividual({ ...garchomp(), nickname: '後' });
    expect((await listIndividuals()).map((i) => i.nickname)).toEqual(['後', '先']);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveIndividual(older); // 保存し直すと先頭に来る
    expect((await listIndividuals())[0].nickname).toBe('先');
  });
});

describe('複製と削除', () => {
  it('複製は中身が同じで、id が別', async () => {
    const original = await saveIndividual({ ...garchomp(), nickname: 'ガブ' });
    const copy = await saveDuplicate(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.nickname).toBe('ガブ');
    expect((await listIndividuals()).length).toBe(2);
  });

  it('削除すると一覧から消える', async () => {
    const saved = await saveIndividual(garchomp());
    await deleteIndividual(saved.id);
    expect(await listIndividuals()).toEqual([]);
  });
});

describe(`上限(${MAX_INDIVIDUALS}体)`, () => {
  it('上限まで保存でき、次の1体は保存できず、上書きと削除後の追加はできる', async () => {
    // 500体を、まとめて直接入れる(1体ずつ保存すると時間がかかるため)
    const db = await getDb();
    const tx = db.transaction('individuals', 'readwrite');
    const first = garchomp();
    await tx.store.put(first);
    for (let i = 1; i < MAX_INDIVIDUALS; i++) await tx.store.put(garchomp());
    await tx.done;

    await expect(saveIndividual(garchomp())).rejects.toBeInstanceOf(LimitReachedError);
    await expect(saveDuplicate(first)).rejects.toBeInstanceOf(LimitReachedError);
    expect((await listIndividuals()).length).toBe(MAX_INDIVIDUALS);

    // すでにある個体の上書きは、上限に達していてもできる
    await expect(saveIndividual({ ...first, nickname: '上書き' })).resolves.toBeDefined();

    // 1体削除すれば、また1体保存できる
    await deleteIndividual(first.id);
    await expect(saveIndividual(garchomp())).resolves.toBeDefined();
  });
});

describe('保存形式のバージョン番号', () => {
  it('初めて開いたとき、いまの番号が記録される', async () => {
    const db = await getDb();
    expect(await db.get('meta', 'schemaVersion')).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('新しすぎる形式のデータは開かない(中身も書き換えない)', async () => {
    const db = await getDb();
    await db.put('meta', CURRENT_SCHEMA_VERSION + 1, 'schemaVersion');
    await db.put('individuals', garchomp());
    await closeDbForTest();
    await expect(listIndividuals()).rejects.toThrow('アプリを更新してください');
  });
});
