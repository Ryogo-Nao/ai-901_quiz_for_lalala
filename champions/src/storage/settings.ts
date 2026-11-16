// アプリの設定の読み書き(選んでいるレギュレーションなど)。保存場所は meta ストア。

import { getDb } from './db.ts';

const REGULATION_KEY = 'regulationId';

/** 選んでいるレギュレーションの ID。まだ選んでいなければ null */
export async function loadRegulationId(): Promise<string | null> {
  const db = await getDb();
  const value = await db.get('meta', REGULATION_KEY);
  return typeof value === 'string' ? value : null;
}

export async function saveRegulationId(id: string): Promise<void> {
  const db = await getDb();
  await db.put('meta', id, REGULATION_KEY);
}
