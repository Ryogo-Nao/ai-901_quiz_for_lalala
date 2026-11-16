// 保存に関するエラー。

/** 保存できる数の上限に達したときのエラー。message は、利用者にそのまま見せる説明 */
export class LimitReachedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimitReachedError';
  }
}
