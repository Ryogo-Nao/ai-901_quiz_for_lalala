// アプリ全体の枠。上の見出し、画面の切り替え(タブ)、いま選んでいる画面を表示する。

import { useState } from 'react';
import './App.css';
import { masterData } from './data/index.ts';
import DamagePage from './features/damage/DamagePage.tsx';
import { createInitialDamageState } from './features/damage/state.ts';
import IndividualsPage from './features/individuals/IndividualsPage.tsx';
import TeamsPage from './features/teams/TeamsPage.tsx';

/** 画面の一覧。id は内部で使う名前、label は表示する名前 */
const SCREENS = [
  { id: 'individuals', label: '個体', plannedStep: null },
  { id: 'teams', label: 'チーム', plannedStep: null },
  { id: 'damage', label: 'ダメージ計算', plannedStep: null },
  { id: 'settings', label: '設定', plannedStep: 'ステップ5' },
] as const;

type ScreenId = (typeof SCREENS)[number]['id'];

export default function App() {
  // useState は「画面が覚えておく値」を作る。値を変えると、React が画面を描き直す。
  // ここでは「いまどの画面を表示しているか」を覚えている。
  const [screenId, setScreenId] = useState<ScreenId>('individuals');
  const screen = SCREENS.find((candidate) => candidate.id === screenId)!;

  // ダメージ計算の画面の一時データ。ほかの画面へ切り替えても消えないよう、ここで持つ
  // (ページを再読み込みすると消える。保存した個体には影響しない)
  const [damageState, setDamageState] = useState(() => createInitialDamageState(masterData));

  // いまは、レギュレーションを選ぶ画面がまだ無いので、1つ目を使う
  const regulation = masterData.regulations[0];

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">対戦補助ツール</h1>
        <span className="app-badge">非公式</span>
      </header>

      <main className="app-main">
        {screen.id === 'individuals' ? (
          <IndividualsPage data={masterData} regulation={regulation} />
        ) : screen.id === 'teams' ? (
          <TeamsPage data={masterData} />
        ) : screen.id === 'damage' ? (
          <DamagePage data={masterData} regulation={regulation} state={damageState} onChange={setDamageState} />
        ) : (
          <section className="card placeholder">
            <h2>{screen.label}</h2>
            <p>この画面は{screen.plannedStep}で作ります。</p>
          </section>
        )}

        <footer className="app-footer">
          <p>
            個人の学習用に作った非公式のファンツールです。株式会社ポケモン・任天堂・クリーチャーズ・ゲームフリークとは関係ありません。
          </p>
          <p>データの出典: Pokémon Showdown(MIT)、PokéAPI(BSD 3条項)</p>
        </footer>
      </main>

      <nav className="app-nav" aria-label="画面の切り替え">
        {SCREENS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="app-nav-button"
            aria-current={candidate.id === screenId ? 'page' : undefined}
            onClick={() => setScreenId(candidate.id)}
          >
            {candidate.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
