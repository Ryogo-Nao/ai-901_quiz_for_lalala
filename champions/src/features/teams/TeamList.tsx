// チームの一覧。

import { useState } from 'react';
import type { MasterData } from '../../data/index.ts';
import type { Individual } from '../../domain/individual.ts';
import { MAX_TEAMS, MAX_TEAM_MEMBERS } from '../../domain/limits.ts';
import type { Team } from '../../domain/team.ts';

interface Props {
  data: MasterData;
  teams: Team[];
  individuals: Individual[];
  onCreate: () => void;
  onEdit: (team: Team) => void;
  onDuplicate: (team: Team) => void;
  onDelete: (team: Team) => void;
  /** 一覧の中で、fromIndex 番目のチームを toIndex 番目へ動かす */
  onMove: (fromIndex: number, toIndex: number) => void;
}

export default function TeamList({ data, teams, individuals, onCreate, onEdit, onDuplicate, onDelete, onMove }: Props) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const isFull = teams.length >= MAX_TEAMS;

  // 個体の id から名前を引くための表
  const nameById = new Map(
    individuals.map((individual) => [
      individual.id,
      individual.nickname || (data.pokemon.get(individual.speciesId)?.name ?? '不明なポケモン'),
    ]),
  );

  return (
    <div className="list-page">
      <section className="card">
        <div className="card-heading">
          <h2>
            チーム <span className="count">{teams.length} / {MAX_TEAMS}</span>
          </h2>
          <button type="button" className="button-primary" disabled={isFull} onClick={onCreate}>
            + 新しく作る
          </button>
        </div>
        {isFull && (
          <p className="notice notice-warn">
            チームは{MAX_TEAMS}個まで保存できます。新しく作るには、使わないチームを削除してください。
          </p>
        )}
      </section>

      {teams.length === 0 && (
        <section className="card empty">
          <p>まだチームがありません。「+ 新しく作る」から作成できます。</p>
        </section>
      )}

      <ul className="plain-list">
        {teams.map((team, index) => {
          const memberNames = team.memberIds.map((id) => nameById.get(id) ?? '(削除された個体)');
          const teamLabel = team.name || '(名前なし)';
          return (
            <li key={team.id} className="card team-card">
              <div className="card-heading">
                <h3 className="team-name">{teamLabel}</h3>
                <span className="count">
                  {team.memberIds.length} / {MAX_TEAM_MEMBERS}
                </span>
              </div>
              <p className="summary-sub">{memberNames.length > 0 ? memberNames.join(' / ') : 'メンバーなし'}</p>

              {confirmingDeleteId === team.id ? (
                <div className="notice notice-warn" role="alertdialog" aria-label="削除の確認">
                  <p>チーム「{teamLabel}」を削除しますか? 元に戻せません。メンバーの個体は消えません。</p>
                  <div className="notice-actions">
                    <button type="button" className="button-quiet" onClick={() => setConfirmingDeleteId(null)}>
                      やめる
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => {
                        setConfirmingDeleteId(null);
                        onDelete(team);
                      }}
                    >
                      削除する
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row-actions">
                  <button
                    type="button"
                    className="button-quiet button-icon"
                    aria-label={`${teamLabel}を上へ`}
                    disabled={index === 0}
                    onClick={() => onMove(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="button-quiet button-icon"
                    aria-label={`${teamLabel}を下へ`}
                    disabled={index === teams.length - 1}
                    onClick={() => onMove(index, index + 1)}
                  >
                    ↓
                  </button>
                  <span className="row-actions-spacer" />
                  <button type="button" className="button-quiet" onClick={() => onEdit(team)}>
                    編集
                  </button>
                  <button type="button" className="button-quiet" disabled={isFull} onClick={() => onDuplicate(team)}>
                    複製
                  </button>
                  <button type="button" className="button-quiet" onClick={() => setConfirmingDeleteId(team.id)}>
                    削除
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
