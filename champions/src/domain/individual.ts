// 「個体」(自分で育てた1体)のデータの形。
// ここに書いた形のまま、あとのステップでブラウザに保存する。

import { MOVE_SLOT_COUNT } from './limits.ts';
import { filledStatTable, type StatTable } from './stats.ts';

/**
 * 使うギミックとその設定。
 *
 * 「ギミック名 → 設定」の入れ物にしてある。`?` は「無くてもよい」の印。
 *   - メガシンカしない個体は `{}`(空)になる
 *   - 将来ギミックを足すときは、ここに1行足す(例: tera?: { teraType: string })
 *     古い保存データにはその項目が無いだけなので、「未設定」として読める
 */
export interface GimmickSettings {
  /** メガシンカ。formId はメガシンカ後の姿の ID(例: "garchompmega") */
  mega?: { formId: string };
}

/** ギミックの名前。GimmickSettings に書いた項目名のどれか */
export type GimmickId = keyof GimmickSettings;

/** 個体 */
export interface Individual {
  /** この個体だけの番号(自動で作る) */
  id: string;
  /** ポケモンの ID(例: "garchomp")。日本語名ではなく ID で持つ */
  speciesId: string;
  nickname: string;
  /** 性格の ID(例: "jolly") */
  natureId: string;
  /** 特性の ID */
  abilityId: string;
  /** 持ち物の ID。持ち物なしは null */
  itemId: string | null;
  /** 技の ID を4つ。空欄は null */
  moveIds: (string | null)[];
  /** 能力ポイント。各0〜32、合計66まで */
  statPoints: StatTable;
  /** 使うギミックとその設定 */
  gimmicks: GimmickSettings;
  /** 作成日時・更新日時(世界共通の書き方の文字列。例: "2026-11-16T12:00:00.000Z") */
  createdAt: string;
  updatedAt: string;
}

/**
 * まっさらな個体を作る。
 * @param speciesId ポケモンの ID
 * @param abilityId 最初に選んでおく特性の ID
 */
export function createIndividual(speciesId: string, abilityId: string): Individual {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), // ブラウザが用意している「重複しない文字列を作る」機能
    speciesId,
    nickname: '',
    natureId: 'hardy', // がんばりや(補正なし)
    abilityId,
    itemId: null,
    moveIds: Array.from({ length: MOVE_SLOT_COUNT }, () => null),
    statPoints: filledStatTable(0),
    gimmicks: {},
    createdAt: now,
    updatedAt: now,
  };
}
