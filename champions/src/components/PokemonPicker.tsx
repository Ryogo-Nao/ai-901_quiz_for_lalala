// ポケモンを選ぶ部品。数が多いので、名前の一部を入力して候補を絞れるようにしてある。

import { useId, useState } from 'react';
import type { MasterData } from '../data/index.ts';

interface Props {
  label: string;
  data: MasterData;
  /** いま選ばれているポケモンの ID */
  value: string;
  onChange: (speciesId: string) => void;
  hint?: string;
}

/** ひらがなをカタカナにそろえる(「がぶ」でも「ガブ」でも探せるようにするため) */
const toKatakana = (text: string) => text.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

export default function PokemonPicker({ label, data, value, onChange, hint }: Props) {
  const [query, setQuery] = useState('');
  const selectId = useId();
  const all = [...data.pokemon.values()];
  const keyword = toKatakana(query.trim());
  const matches = keyword === '' ? all : all.filter((species) => toKatakana(species.name).includes(keyword));
  // いま選んでいるポケモンは、絞り込みに合わなくても候補に残す(選択欄の表示が消えないように)
  const current = data.pokemon.get(value);
  const options = current && !matches.includes(current) ? [current, ...matches] : matches;

  return (
    <div className="field">
      <label className="field-label" htmlFor={selectId}>
        {label}
      </label>
      <div className="picker">
        <input
          className="field-control picker-search"
          type="search"
          placeholder="名前で絞る"
          aria-label={`${label}を名前で絞る`}
          value={query}
          onChange={(event) => {
            const text = event.target.value;
            setQuery(text);
            // 絞り込んだ結果が1体だけになったら、そのポケモンを選ぶ
            const next = toKatakana(text.trim());
            const found = next === '' ? [] : all.filter((species) => toKatakana(species.name).includes(next));
            if (found.length === 1 && found[0].id !== value) onChange(found[0].id);
          }}
        />
        <select
          id={selectId}
          className="field-control"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery('');
          }}
        >
          {options.map((species) => (
            <option key={species.id} value={species.id}>
              {species.name}
            </option>
          ))}
        </select>
      </div>
      {keyword !== '' && matches.length === 0 && <p className="field-hint">「{query}」に合うポケモンはいません。</p>}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
