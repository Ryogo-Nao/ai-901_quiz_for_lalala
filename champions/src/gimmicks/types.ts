// バトルギミック(メガシンカなど)の「共通の形」。
//
// 能力値の計算やダメージ計算の本体は、個々のギミックの名前を知らない。
// ここで決めた形(インターフェース)だけを相手にする。
// 新しいギミックは「この形を満たすファイルを1つ足す」ことで追加する。

import type { MasterData, PokemonData } from '../data/index.ts';
import type { GimmickId, GimmickSettings, Individual } from '../domain/individual.ts';
import type { StatTable } from '../domain/stats.ts';

/** ギミックが変化させる対象。戦闘中の「姿」 */
export interface BattleForm {
  /** 姿の名前(例: "ガブリアス"、"メガガブリアス") */
  name: string;
  /** 種族値 */
  baseStats: StatTable;
  /** 攻撃を「受ける」ときのタイプ */
  types: string[];
  /**
   * タイプ一致の判定に使うタイプ。
   * ふだんは types と同じ。テラスタルのように「受けるタイプだけが変わる」ギミックのために分けてある。
   */
  stabTypes: string[];
  /** 特性の ID */
  abilityId: string;
}

/** フックに渡す、まわりの情報 */
export interface GimmickContext {
  individual: Individual;
  species: PokemonData;
  data: MasterData;
}

/**
 * すべてのギミックが守る共通の形。
 *
 * <Config> は「このギミックの設定の形」を入れる場所(型の引数)。
 * メガシンカなら { formId: string }、テラスタルなら { teraType: string } のように、
 * ギミックごとに設定の形が違うので、あとから指定できるようにしてある。
 */
export interface Gimmick<Config> {
  /** 名前。保存データやレギュレーション設定でこの文字列を使う */
  id: GimmickId;
  /** 画面に出す名前 */
  label: string;
  /** 表の見出しなど、狭い場所に出す短い名前 */
  shortLabel: string;

  /** このポケモンで使えるか(使えないポケモンでは設定欄を出さない) */
  canUse(species: PokemonData): boolean;

  /**
   * 個体のほかの項目と、このギミックの設定とのつじつまを合わせる。
   * いまの個体にふさわしい設定を返す。設定なしにするなら undefined を返す。
   * (メガシンカは持ち物のメガストーンで決まるので、これを使う)
   */
  syncSettings?(individual: Individual, species: PokemonData): Config | undefined;

  // ----- ここから下が「変化」。必要なものだけ書く(? は「無くてもよい」の印) -----

  /** 種族値・タイプ・特性を変える(例: メガシンカ) */
  changeForm?(form: BattleForm, config: Config, context: GimmickContext): BattleForm;

  /** 実数値を変える(例: ダイマックスの HP 2倍) */
  changeStats?(stats: StatTable, config: Config, context: GimmickContext): StatTable;

  // 「技の威力やタイプを変える」「ダメージ補正を加える」の2つは、
  // ダメージ計算を作るステップで、ここに足す。
}

/** ギミック K の設定の形(GimmickSettings に書いたもの) */
export type GimmickConfig<K extends GimmickId> = NonNullable<GimmickSettings[K]>;

/**
 * 登録簿の形。「GimmickSettings に書いたすべてのギミックについて、実装が1つずつある」という意味。
 * GimmickSettings に項目を足して登録を忘れると、TypeScript がエラーで教えてくれる。
 */
export type GimmickRegistry = { [K in GimmickId]: Gimmick<GimmickConfig<K>> };
