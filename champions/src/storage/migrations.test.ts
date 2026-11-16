// マイグレーションの仕組みのテスト。
// まだ本物の変換は無いので、テスト用の変換を渡して「1段ずつ順番に通る」ことを確かめる。

import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, NewerSchemaError, type StoredData, migrate } from './migrations.ts';

const v1: StoredData = { schemaVersion: 1, individuals: [{ id: 'a', name: '古い形' }], teams: [] };

describe('migrate', () => {
  it('いまの形式のデータは、そのまま返す', () => {
    const data: StoredData = { schemaVersion: CURRENT_SCHEMA_VERSION, individuals: [], teams: [] };
    expect(migrate(data)).toBe(data);
  });

  it('古い形式は、1段ずつ順番に変換される', () => {
    // 例: v1→v2 で name を nickname に改名、v2→v3 で memo を足す
    const steps = {
      1: (old: StoredData): StoredData => ({
        ...old,
        schemaVersion: 2,
        individuals: old.individuals.map((i) => {
          const { name, ...rest } = i as { name: string };
          return { ...rest, nickname: name };
        }),
      }),
      2: (old: StoredData): StoredData => ({
        ...old,
        schemaVersion: 3,
        individuals: old.individuals.map((i) => ({ ...(i as object), memo: '' })),
      }),
    };
    expect(migrate(v1, steps, 3)).toEqual({
      schemaVersion: 3,
      individuals: [{ id: 'a', nickname: '古い形', memo: '' }],
      teams: [],
    });
  });

  it('新しすぎる形式はエラーになる', () => {
    expect(() => migrate({ ...v1, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(NewerSchemaError);
  });

  it('変換方法が無い番号はエラーになる', () => {
    expect(() => migrate(v1, {}, 2)).toThrow();
  });
});
