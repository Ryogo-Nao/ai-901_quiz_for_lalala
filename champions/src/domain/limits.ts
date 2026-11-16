// ゲームとアプリの「上限」の数字を1か所に集めたもの。
// 数字をコードのあちこちに直接書くと、変えるときに直し忘れが出る。
// 名前を付けてここに置けば、意味がわかり、直す場所も1か所で済む。

/** レベル(固定) */
export const LEVEL = 50;

/** 能力ポイント: 合計の上限 */
export const MAX_TOTAL_STAT_POINTS = 66;

/** 能力ポイント: 1つの能力に振れる上限 */
export const MAX_STAT_POINTS_PER_STAT = 32;

/** 技の数 */
export const MOVE_SLOT_COUNT = 4;

/** ニックネームの長さの上限(このアプリの決まり。ゲームの制限とは別) */
export const MAX_NICKNAME_LENGTH = 20;

/** 保存できる個体の数 */
export const MAX_INDIVIDUALS = 500;

/** 保存できるチームの数 */
export const MAX_TEAMS = 10;

/** 1チームに入れられる数 */
export const MAX_TEAM_MEMBERS = 6;
