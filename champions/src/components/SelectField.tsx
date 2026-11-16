// 「見出し + 選択欄」をひとまとめにした部品。いろいろな画面で使い回す。

import { useId } from 'react';

/** 選択肢1つ。value は内部で使う値(ID)、label は表示する文字 */
export interface SelectOption {
  value: string;
  label: string;
}

/** 選択肢のグループ(見出しつきのまとまり) */
export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface Props {
  /** 見出し */
  label: string;
  /** いま選ばれている値 */
  value: string;
  /** グループに入れない選択肢(先頭に並ぶ) */
  options?: SelectOption[];
  /** グループ分けした選択肢 */
  groups?: SelectGroup[];
  /** 選び直されたときに呼ばれる関数 */
  onChange: (value: string) => void;
  /** 欄の下に出す補足の説明 */
  hint?: string;
}

export default function SelectField({ label, value, options = [], groups = [], onChange, hint }: Props) {
  // useId は、この部品ごとに重複しない名前を作る。見出し(label)と選択欄(select)を結びつけるのに使う。
  // 結びつけておくと、見出しをタップしても選択欄が開き、読み上げソフトも正しく読める。
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="field-control" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
