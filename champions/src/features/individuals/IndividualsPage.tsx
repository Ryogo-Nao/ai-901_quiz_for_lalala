// 「個体」の画面全体。一覧と編集画面を切り替え、保存データの読み書きを受け持つ。
//
//   IndividualsPage   … 保存データを読む・書く。どちらの画面を出すか決める
//     ├ IndividualList   … 一覧を表示するだけ
//     └ IndividualEditor … 1体を編集するだけ
//
// 一覧と編集画面は、保存のしかたを知らない。「保存して」「削除して」と、この部品に頼むだけ。

import { useEffect, useState } from 'react';
import type { MasterData, RegulationData } from '../../data/index.ts';
import { createIndividual, type Individual } from '../../domain/individual.ts';
import { deleteIndividual, listIndividuals, saveDuplicate, saveIndividual } from '../../storage/individuals.ts';
import IndividualEditor from './IndividualEditor.tsx';
import IndividualList from './IndividualList.tsx';

interface Props {
  data: MasterData;
  regulation: RegulationData;
}

/** いま編集している個体。一覧を表示しているときは null */
type Editing = { individual: Individual; isNew: boolean } | null;

export default function IndividualsPage({ data, regulation }: Props) {
  // 保存されている個体の一覧。まだ読み込めていないあいだは null
  const [individuals, setIndividuals] = useState<Individual[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** 保存データを読み直して、一覧を最新にする */
  async function reload() {
    try {
      setIndividuals(await listIndividuals());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(describe(error, '保存データを読み込めませんでした'));
    }
  }

  // useEffect は「画面が表示されたあとに行う処理」を書く場所。
  // 最後の [] は「最初に表示されたときに1回だけ」という意味。ここで保存データを読み込む
  useEffect(() => {
    let cancelled = false;
    listIndividuals()
      .then((list) => {
        if (!cancelled) setIndividuals(list);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(describe(error, '保存データを読み込めませんでした'));
      });
    return () => {
      cancelled = true; // 読み込みが終わる前に画面が閉じられたら、結果を使わない
    };
  }, []);

  /** 一覧からの操作(複製・削除)を行い、終わったら一覧を読み直す */
  async function run(action: () => Promise<unknown>, fallbackMessage: string) {
    try {
      await action();
      await reload();
    } catch (error) {
      setErrorMessage(describe(error, fallbackMessage));
    }
  }

  if (editing) {
    return (
      <IndividualEditor
        // key を変えると、React は別の部品として作り直す(前の個体の入力が残らない)
        key={editing.individual.id}
        data={data}
        regulation={regulation}
        initial={editing.individual}
        isNew={editing.isNew}
        onSave={async (individual) => {
          await saveIndividual(individual);
          await reload();
        }}
        onBack={() => setEditing(null)}
      />
    );
  }

  return (
    <>
      {errorMessage && (
        <p className="notice notice-warn" role="alert">
          {errorMessage}
        </p>
      )}
      {individuals === null ? (
        !errorMessage && <p className="card empty">読み込み中…</p>
      ) : (
        <IndividualList
          data={data}
          individuals={individuals}
          onCreate={() => {
            const first = [...data.pokemon.values()][0];
            setEditing({ individual: createIndividual(first.id, first.abilities[0]), isNew: true });
          }}
          onEdit={(individual) => setEditing({ individual, isNew: false })}
          onDuplicate={(individual) => run(() => saveDuplicate(individual), '複製できませんでした')}
          onDelete={(individual) => run(() => deleteIndividual(individual.id), '削除できませんでした')}
        />
      )}
    </>
  );
}

/** エラーを、利用者に見せる文にする */
function describe(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}
