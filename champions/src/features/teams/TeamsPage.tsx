// 「チーム」の画面全体。一覧と編集画面を切り替え、保存データの読み書きを受け持つ。
//
// チームの変更(名前、メンバーの追加・並べ替えなど)は、操作するたびにすぐ保存する。
// 個体の編集と違って「保存」ボタンが無いのは、1回の操作が小さく、やり直しも簡単なため。

import { useEffect, useState } from 'react';
import type { MasterData } from '../../data/index.ts';
import type { Individual } from '../../domain/individual.ts';
import { moveItem, type Team } from '../../domain/team.ts';
import { listIndividuals } from '../../storage/individuals.ts';
import {
  createAndSaveTeam,
  deleteTeam,
  listTeams,
  saveTeam,
  saveTeamDuplicate,
  saveTeamOrder,
} from '../../storage/teams.ts';
import TeamEditor from './TeamEditor.tsx';
import TeamList from './TeamList.tsx';
import './teams.css';

interface Props {
  data: MasterData;
}

export default function TeamsPage({ data }: Props) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  // 編集しているチームの id。一覧を表示しているときは null
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listTeams(), listIndividuals()])
      .then(([teamList, individualList]) => {
        if (cancelled) return;
        setTeams(teamList);
        setIndividuals(individualList);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(describe(error, '保存データを読み込めませんでした'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 保存の操作を行い、終わったらチームを読み直す。失敗したら理由を表示する */
  async function run<T>(action: () => Promise<T>, fallbackMessage: string): Promise<T | undefined> {
    try {
      const result = await action();
      setTeams(await listTeams());
      setErrorMessage(null);
      return result;
    } catch (error) {
      setErrorMessage(describe(error, fallbackMessage));
      return undefined;
    }
  }

  const editingTeam = teams?.find((team) => team.id === editingId);

  return (
    <>
      {errorMessage && (
        <p className="notice notice-warn" role="alert">
          {errorMessage}
        </p>
      )}
      {teams === null ? (
        !errorMessage && <p className="card empty">読み込み中…</p>
      ) : editingTeam ? (
        <TeamEditor
          data={data}
          team={editingTeam}
          individuals={individuals}
          onChange={(next) => run(() => saveTeam(next), '保存できませんでした')}
          onBack={() => setEditingId(null)}
        />
      ) : (
        <TeamList
          data={data}
          teams={teams}
          individuals={individuals}
          onCreate={async () => {
            const created = await run(createAndSaveTeam, 'チームを作れませんでした');
            if (created) setEditingId(created.id); // 作ったら、そのまま編集画面を開く
          }}
          onEdit={(team) => setEditingId(team.id)}
          onDuplicate={(team) => run(() => saveTeamDuplicate(team), '複製できませんでした')}
          onDelete={(team) => run(() => deleteTeam(team.id), '削除できませんでした')}
          onMove={(fromIndex, toIndex) =>
            run(
              () => saveTeamOrder(moveItem(teams, fromIndex, toIndex).map((team) => team.id)),
              '並べ替えできませんでした',
            )
          }
        />
      )}
    </>
  );
}

function describe(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}
