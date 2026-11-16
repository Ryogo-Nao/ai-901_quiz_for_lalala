// ダメージ計算の「補正」と「段階」の形。
//
// 特性・持ち物・天気・フィールド・壁・ギミックは、どれも Modifier(補正)を返すだけ。
// 計算の本体(pipeline.ts)は、集まった Modifier を段階ごとに決まった順番で適用する。
// 新しい補正を足すとき、本体は触らない。Modifier を返すルールを足す。

/**
 * 段階の名前と、その段階での補正のまとめ方。この並びが、適用する順番。
 *
 *   chain … 補正を1つにまとめてから(連鎖)、値に掛けて五捨五超入する
 *   each  … 補正を1つずつ、掛けて五捨五超入する
 *   add   … 4096 に足し合わせてから、値に掛けて五捨五超入する(タイプ一致だけがこの方式)
 */
export const STAGES = [
  { id: 'power', label: '威力', combine: 'chain' },
  { id: 'attackStat', label: '攻撃(能力値)', combine: 'each' },
  { id: 'attack', label: '攻撃', combine: 'chain' },
  { id: 'defenseStat', label: '防御(能力値)', combine: 'each' },
  { id: 'defense', label: '防御', combine: 'chain' },
  // ここで基礎ダメージを計算する
  { id: 'spread', label: '範囲', combine: 'each' },
  { id: 'weather', label: '天気', combine: 'each' },
  { id: 'critical', label: '急所', combine: 'each' },
  // ここで乱数(85〜100)を掛ける
  { id: 'stab', label: 'タイプ一致', combine: 'add' },
  // ここでタイプ相性を掛ける
  { id: 'burn', label: 'やけど', combine: 'each' },
  { id: 'final', label: '最終補正', combine: 'chain' },
] as const;

/** 段階の名前。'power' | 'attack' | … のどれか */
export type StageId = (typeof STAGES)[number]['id'];

/** 補正1つ */
export interface Modifier {
  /** どの段階で効くか */
  stage: StageId;
  /**
   * 補正の大きさ。4096 を 1.0 倍とした整数(1.5倍なら 6144)。
   * 'stab' の段階だけは「4096 に足す量」(1.5倍にするなら 2048)。
   */
  value: number;
  /** 画面に出す説明。例: 「こだわりハチマキ」 */
  label: string;
}

/** 補正の一覧から、指定した段階のものだけを取り出す */
export function modifiersOf(modifiers: readonly Modifier[], stage: StageId): Modifier[] {
  return modifiers.filter((modifier) => modifier.stage === stage);
}
