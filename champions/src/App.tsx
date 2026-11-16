// アプリ全体の枠。上の見出し、画面の切り替え(タブ)、いま選んでいる画面を表示する。

import { useEffect, useState } from 'react';
import './App.css';
import { masterData } from './data/index.ts';
import DamagePage from './features/damage/DamagePage.tsx';
import { createInitialDamageState } from './features/damage/state.ts';
import IndividualsPage from './features/individuals/IndividualsPage.tsx';
import SettingsPage from './features/settings/SettingsPage.tsx';
import TeamsPage from './features/teams/TeamsPage.tsx';
import { loadRegulationId, saveRegulationId } from './storage/settings.ts';

/** 画面の一覧。id は内部で使う名前、label は表示する名前 */
const SCREENS = [
  { id: 'individuals', label: '個体' },
  { id: 'teams', label: 'チーム' },
  { id: 'damage', label: 'ダメージ計算' },
  { id: 'settings', label: '設定' },
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

  // 選んでいるレギュレーション。設定の画面で切り替える。選んだものは保存しておき、次に開いたときに読み込む
  const [regulationId, setRegulationId] = useState(masterData.regulations[0].id);
  useEffect(() => {
    let cancelled = false;
    loadRegulationId()
      .then((saved) => {
        if (!cancelled && saved && masterData.regulations.some((candidate) => candidate.id === saved)) setRegulationId(saved);
      })
      .catch(() => {}); // 読み込めなくても、1つ目のレギュレーションで使える
    return () => {
      cancelled = true;
    };
  }, []);
  const regulation = masterData.regulations.find((candidate) => candidate.id === regulationId) ?? masterData.regulations[0];
  const changeRegulation = (id: string) => {
    setRegulationId(id);
    saveRegulationId(id).catch(() => {});
  };

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
          <SettingsPage data={masterData} regulation={regulation} onRegulationChange={changeRegulation} />
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
