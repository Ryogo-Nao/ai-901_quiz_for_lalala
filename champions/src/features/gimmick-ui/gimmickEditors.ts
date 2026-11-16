// ギミックの設定欄の登録簿。
//
// 個体編集画面は、この登録簿から設定欄を取り出して表示する。
// 新しいギミックを足すときは、設定欄の部品を作って、ここに1行並べる。

import type { ComponentType } from 'react';
import type { GimmickId } from '../../domain/individual.ts';
import MegaEditor from './MegaEditor.tsx';
import type { GimmickEditorProps } from './types.ts';

export const gimmickEditors: Record<GimmickId, ComponentType<GimmickEditorProps>> = {
  mega: MegaEditor,
};
