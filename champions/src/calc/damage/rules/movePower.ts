// 威力が状況で決まる技の、威力の決め方。
// 手本: @smogon/calc 0.12.0 の calculateBasePowerChampions。

import type { Situation } from '../situation.ts';

interface PowerResult {
  /** 威力。0 は「計算できない」 */
  power: number;
  /** 計算できないときの説明 */
  reason?: string;
  /** 利用者に伝えたい注意 */
  note?: string;
}

type Input = Omit<Situation, 'basePower' | 'fixedDamage' | 'stop'>;

/** 重さ(kg)。「ヘヴィメタル」は2倍、「ライトメタル」は半分 */
function weightOf(weightKg: number, ability: string): number {
  const factor = ability === 'heavymetal' ? 2 : ability === 'lightmetal' ? 0.5 : 1;
  if (factor === 1) return weightKg;
  return Math.max(Math.trunc(weightKg * 10 * factor), 1) / 10;
}

/** 上がっているランクの合計(下がっている分は数えない) */
function countPositiveRanks(ranks: Record<string, number>): number {
  return Object.values(ranks).reduce((sum, rank) => sum + Math.max(0, rank), 0);
}

/** 「前のターンの出来事」で威力が上がる技。上がらない場合の威力で計算し、注意を出す */
const CONDITIONAL_NOTES: Record<string, string> = {
  assurance: '相手がそのターンにすでにダメージを受けていると、威力が2倍になります(ここでは2倍にしていません)',
  avalanche: '相手から先にダメージを受けていると、威力が2倍になります(ここでは2倍にしていません)',
  revenge: '相手から先にダメージを受けていると、威力が2倍になります(ここでは2倍にしていません)',
  round: '同じターンに味方が先に使っていると、威力が2倍になります(ここでは2倍にしていません)',
  stompingtantrum: '前のターンに技が失敗していると、威力が2倍になります(ここでは2倍にしていません)',
  temperflare: '前のターンに技が失敗していると、威力が2倍になります(ここでは2倍にしていません)',
  fishiousrend: '相手より先に攻撃すると、威力が2倍になります(ここでは2倍にしていません)',
  boltbeak: '相手より先に攻撃すると、威力が2倍になります(ここでは2倍にしていません)',
  lashout: 'そのターンに能力を下げられていると、威力が2倍になります(ここでは2倍にしていません)',
  ragefist: '攻撃を受けた回数で威力が上がります(ここでは上げていません)',
  lastrespects: '倒された味方の数で威力が上がります(ここでは上げていません)',
};

/** 補正を掛ける前の威力を決める */
export function resolveBasePower(s: Input): PowerResult {
  const { move, attacker, defender, conditions } = s;
  const base = move.power;

  switch (move.id) {
    case 'payback': // しっぺがえし: 相手より後に動くと2倍(すばやさで判定)
      return { power: base * (s.attackerSpeed > s.defenderSpeed ? 1 : 2), note: 'すばやさが相手以下なら「後に動く」として威力2倍で計算しています' };
    case 'electroball': {
      // エレキボール: 自分のすばやさが相手の何倍かで決まる
      if (s.defenderSpeed === 0) return { power: 40 };
      const ratio = Math.floor(s.attackerSpeed / s.defenderSpeed);
      return { power: ratio >= 4 ? 150 : ratio >= 3 ? 120 : ratio >= 2 ? 80 : ratio >= 1 ? 60 : 40 };
    }
    case 'gyroball': // ジャイロボール: 相手より遅いほど強い
      if (s.attackerSpeed === 0) return { power: 1 };
      return { power: Math.min(150, Math.floor((25 * s.defenderSpeed) / s.attackerSpeed) + 1) };
    case 'lowkick':
    case 'grassknot': {
      // けたぐり・くさむすび: 相手が重いほど強い
      const weight = weightOf(defender.battler.form.weightKg, s.defenderAbility);
      return { power: weight >= 200 ? 120 : weight >= 100 ? 100 : weight >= 50 ? 80 : weight >= 25 ? 60 : weight >= 10 ? 40 : 20 };
    }
    case 'heavyslam':
    case 'heatcrash': {
      // ヘビーボンバー・ヒートスタンプ: 自分が相手の何倍重いかで決まる
      const ratio = weightOf(attacker.battler.form.weightKg, s.attackerAbility) / weightOf(defender.battler.form.weightKg, s.defenderAbility);
      return { power: ratio >= 5 ? 120 : ratio >= 4 ? 100 : ratio >= 3 ? 80 : ratio >= 2 ? 60 : 40 };
    }
    case 'hex':
    case 'infernalparade': // たたりめ: 相手が状態異常なら2倍
      return { power: base * (defender.status ? 2 : 1) };
    case 'barbbarrage':
      return { power: base * (defender.status === 'psn' || defender.status === 'tox' ? 2 : 1) };
    case 'smellingsalts':
      return { power: base * (defender.status === 'par' ? 2 : 1) };
    case 'storedpower':
    case 'powertrip': // アシストパワー・つけあがる: 上がっているランク1つにつき +20
      return { power: 20 + 20 * countPositiveRanks({ ...s.attackerRanks }) };
    case 'punishment':
      return { power: Math.min(200, 60 + 20 * countPositiveRanks({ ...s.defenderRanks })) };
    case 'acrobatics': // アクロバット: 持ち物が無いと2倍
      return { power: base * (s.attackerItem === null ? 2 : 1) };
    case 'weatherball': // ウェザーボール: 天気があると2倍
      return { power: base * (s.weather || s.attackerAbility === 'megasol' ? 2 : 1) };
    case 'terrainpulse':
      return { power: base * (s.attackerGrounded && conditions.terrain ? 2 : 1) };
    case 'risingvoltage': // ライジングボルト: エレキフィールドで、相手が地面にいると2倍
      return { power: base * (s.defenderGrounded && conditions.terrain === 'electric' ? 2 : 1) };
    case 'fling': {
      // なげつける: 持ち物で威力が決まる
      const power = s.attackerItem ? (s.data.items.get(s.attackerItem)?.flingPower ?? 0) : 0;
      return power > 0 ? { power } : { power: 0, reason: '投げられる持ち物を持っていないと失敗する技です' };
    }
    case 'eruption':
    case 'waterspout': // ふんか・しおふき: 自分のHPが多いほど強い
      return { power: Math.max(1, Math.floor((150 * attacker.currentHp) / attacker.battler.stats.hp)) };
    case 'flail':
    case 'reversal': {
      // じたばた・きしかいせい: 自分のHPが少ないほど強い
      const p = Math.floor((48 * attacker.currentHp) / attacker.battler.stats.hp);
      return { power: p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20 };
    }
    case 'hardpress': {
      // ハードプレス: 相手のHPが多いほど強い(最大100)
      const ratio = 100 * Math.floor((defender.currentHp * 4096) / defender.battler.stats.hp);
      return { power: Math.floor(Math.floor((100 * ratio + 2048 - 1) / 4096) / 100) || 1 };
    }
    case 'tripleaxel': // トリプルアクセル: 1回目 20、2回目 40、3回目 60
      return { power: 20 * conditions.hit };
    case 'triplekick':
      return { power: 10 * conditions.hit };
    case 'counter':
    case 'mirrorcoat':
    case 'metalburst':
    case 'comeuppance':
      return { power: 0, reason: '受けたダメージで決まる技なので、計算できません' };
    case 'endeavor':
      return { power: 0, reason: '相手のHPを自分と同じにする技なので、ダメージ計算の対象外です' };
    case 'beatup':
      return { power: 0, reason: '味方それぞれの こうげき で威力が決まる技なので、計算できません' };
    default:
      if (base === 0) return { power: 0, reason: 'この技のダメージは、まだ計算できません' };
      return { power: base, note: CONDITIONAL_NOTES[move.id] };
  }
}
