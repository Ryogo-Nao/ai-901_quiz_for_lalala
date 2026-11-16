// チーム1つの編集画面(名前、メンバーの追加・並べ替え・外す)。
//
// この画面は保存のしかたを知らない。変更後のチームを onChange に渡すだけ。
// メンバーの決まり(最大6体、同じ個体は1回だけ)は domain/team.ts にある。

import { useId, useState } from 'react';
import IndividualSummary from '../../components/IndividualSummary.tsx';
import type { MasterData } from '../../data/index.ts';
import type { Individual } from '../../domain/individual.ts';
import { MAX_TEAM_MEMBERS } from '../../domain/limits.ts';
import {
  MAX_TEAM_NAME_LENGTH,
  addMember,
  isTeamFull,
  moveMember,
  removeMember,
  renameTeam,
  type Team,
} from '../../domain/team.ts';

interface Props {
  data: MasterData;
  team: Team;
  /** 保存されているすべての個体 */
  individuals: Individual[];
  /** チームが変わったとき、変更後のチームを渡して呼ぶ関数 */
  onChange: (next: Team) => void;
  onBack: () => void;
}

export default function TeamEditor({ data, team, individuals, onChange, onBack }: Props) {
  // 名前は、入力している途中の文字を画面で持ち、入力欄から離れたときに保存する
  // (1文字打つたびに保存しないため)
  const [nameDraft, setNameDraft] = useState(team.name);
  const [query, setQuery] = useState('');
  const nameId = useId();
  const searchId = useId();

  const individualById = new Map(individuals.map((individual) => [individual.id, individual]));
  const full = isTeamFull(team);

  const displayName = (individual: Individual) =>
    individual.nickname || (data.pokemon.get(individual.speciesId)?.name ?? '不明なポケモン');

  // 追加できる候補: まだこのチームに入っていない個体。検索の文字があれば、それで絞る
  const keyword = query.trim();
  const candidates = individuals.filter(
    (individual) =>
      !team.memberIds.includes(individual.id) &&
      (keyword === '' ||
        individual.nickname.includes(keyword) ||
        (data.pokemon.get(individual.speciesId)?.name ?? '').includes(keyword)),
  );

  function commitName() {
    const renamed = renameTeam(team, nameDraft);
    setNameDraft(renamed.name);
    if (renamed.name !== team.name) onChange(renamed);
  }

  return (
    <div className="editor-page">
      <div className="page-bar">
        <button type="button" className="button-quiet" onClick={onBack}>
          ← 一覧
        </button>
        <span className="page-bar-title">{team.name || '(名前なし)'}</span>
        <span className="page-bar-status">
          {team.memberIds.length} / {MAX_TEAM_MEMBERS}
        </span>
      </div>

      <section className="card">
        <div className="field">
          <label className="field-label" htmlFor={nameId}>
            チーム名
          </label>
          <input
            id={nameId}
            className="field-control"
            type="text"
            maxLength={MAX_TEAM_NAME_LENGTH}
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur(); // Enter で入力を確定する
            }}
          />
        </div>
        <p className="field-hint">変更はすぐに保存されます。</p>
      </section>

      <section className="card">
        <div className="card-heading">
          <h2>
            メンバー{' '}
            <span className="count">
              {team.memberIds.length} / {MAX_TEAM_MEMBERS}
            </span>
          </h2>
        </div>
        {team.memberIds.length === 0 && <p className="empty">まだメンバーがいません。下の一覧から追加してください。</p>}
        <ol className="plain-list member-list">
          {team.memberIds.map((id, index) => {
            const individual = individualById.get(id);
            const label = individual ? displayName(individual) : '削除された個体';
            return (
              <li key={id} className="member-row">
                <span className="member-number">{index + 1}</span>
                <div className="member-body">
                  {individual ? (
                    <IndividualSummary individual={individual} data={data} compact />
                  ) : (
                    <p className="notice notice-warn">この個体は見つかりません。外してください。</p>
                  )}
                  <div className="row-actions">
                    <button
                      type="button"
                      className="button-quiet button-icon"
                      aria-label={`${label}を上へ`}
                      disabled={index === 0}
                      onClick={() => onChange(moveMember(team, index, index - 1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="button-quiet button-icon"
                      aria-label={`${label}を下へ`}
                      disabled={index === team.memberIds.length - 1}
                      onClick={() => onChange(moveMember(team, index, index + 1))}
                    >
                      ↓
                    </button>
                    <span className="row-actions-spacer" />
                    <button
                      type="button"
                      className="button-quiet"
                      aria-label={`${label}を外す`}
                      onClick={() => onChange(removeMember(team, id))}
                    >
                      外す
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card">
        <h2>メンバーを追加</h2>
        {full && (
          <p className="notice notice-warn">
            1チームは{MAX_TEAM_MEMBERS}体までです。追加するには、先にメンバーを外してください。
          </p>
        )}
        {individuals.length === 0 ? (
          <p className="empty">保存した個体がありません。先に「個体」の画面で個体を作って保存してください。</p>
        ) : (
          <>
            <input
              id={searchId}
              className="field-control"
              type="search"
              placeholder="名前で探す"
              aria-label="名前で探す"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {candidates.length === 0 && (
              <p className="empty">
                {keyword === '' ? '追加できる個体はありません(すべてこのチームに入っています)。' : `「${keyword}」に合う個体はありません。`}
              </p>
            )}
            <ul className="plain-list candidate-list">
              {candidates.map((individual) => (
                <li key={individual.id} className="candidate-row">
                  <IndividualSummary individual={individual} data={data} compact />
                  <button
                    type="button"
                    className="button-quiet"
                    aria-label={`${displayName(individual)}を追加`}
                    disabled={full}
                    onClick={() => onChange(addMember(team, individual.id))}
                  >
                    追加
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
