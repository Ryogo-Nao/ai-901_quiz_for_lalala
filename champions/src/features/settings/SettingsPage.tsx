// 設定の画面: レギュレーションの切り替え、全データの書き出しと読み込み、データの出典。

import { useId, useRef, useState } from 'react';
import SelectField from '../../components/SelectField.tsx';
import type { MasterData, RegulationData } from '../../data/index.ts';
import sourcesJson from '../../data/sources.json';
import { MAX_INDIVIDUALS, MAX_TEAMS } from '../../domain/limits.ts';
import { gimmickRegistry } from '../../gimmicks/registry.ts';
import { exportAll, importAll, parseImport, type DataSet, type ImportMode } from '../../storage/exportImport.ts';
import './settings.css';

interface Props {
  data: MasterData;
  regulation: RegulationData;
  onRegulationChange: (id: string) => void;
}

type Message = { kind: 'ok' | 'error'; text: string } | null;

const describe = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export default function SettingsPage({ data, regulation, onRegulationChange }: Props) {
  // ----- 書き出し -----
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<Message>(null);
  const exportAreaRef = useRef<HTMLTextAreaElement>(null);
  const exportAreaId = useId();

  /** 書き出す文字を用意し、ファイルとして保存する */
  async function exportToFile() {
    try {
      const text = await exportAll();
      setExportText(text);
      // 文字をファイルの形(Blob)にして、ダウンロード用のリンクを一時的に作って押す
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `champions-tool-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportMessage({
        kind: 'ok',
        text: '書き出しました。ファイルが保存されない場合は、下の文字をコピーして、メモなどに貼り付けて保管してください。',
      });
    } catch (error) {
      setExportMessage({ kind: 'error', text: describe(error, '書き出せませんでした') });
    }
  }

  async function copyExport() {
    if (!exportText) return;
    try {
      await navigator.clipboard.writeText(exportText);
      setExportMessage({ kind: 'ok', text: 'コピーしました。' });
    } catch {
      // コピーが許可されていない環境では、文字を選んだ状態にして、手でコピーしてもらう
      exportAreaRef.current?.select();
      setExportMessage({ kind: 'ok', text: '文字を選びました。コピーの操作をしてください。' });
    }
  }

  // ----- 読み込み -----
  const [importText, setImportText] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [preview, setPreview] = useState<DataSet | null>(null);
  const [importMessage, setImportMessage] = useState<Message>(null);
  const importAreaId = useId();
  const fileId = useId();

  /** 読み込む文字が変わったら、中身を調べて「何件入っているか」を出す。まだ保存データは変えない */
  function inspect(text: string) {
    setImportText(text);
    setPreview(null);
    setImportMessage(null);
    if (text.trim() === '') return;
    try {
      setPreview(parseImport(text));
    } catch (error) {
      setImportMessage({ kind: 'error', text: describe(error, '読み込めませんでした') });
    }
  }

  async function runImport() {
    try {
      const result = await importAll(importText, mode);
      setImportMessage({ kind: 'ok', text: `読み込みました。いまのデータ: 個体 ${result.individuals}体、チーム ${result.teams}個` });
      setPreview(null);
      setImportText('');
    } catch (error) {
      setImportMessage({ kind: 'error', text: describe(error, '読み込めませんでした') });
    }
  }

  const messageBox = (message: Message) =>
    message && (
      <p className={message.kind === 'ok' ? 'notice notice-ok' : 'notice notice-warn'} role="status">
        {message.text}
      </p>
    );

  return (
    <div className="list-page">
      <section className="card">
        <h2>レギュレーション</h2>
        <SelectField
          label="使うレギュレーション"
          value={regulation.id}
          options={data.regulations.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          onChange={onRegulationChange}
          hint={`使えるギミック: ${regulation.gimmicks.map((id) => gimmickRegistry[id].label).join('、') || 'なし'}`}
        />
        <p className="field-hint">
          個体の編集とダメージ計算には、ここで選んだレギュレーションで使えるギミックだけが出ます。
          使えないギミックの設定は、個体から消えずに残ります。
        </p>
      </section>

      <section className="card">
        <h2>データの書き出し</h2>
        <p className="field-hint">
          保存した個体とチームを、すべて1つの JSON ファイルにします。機種変更の前や、念のための控えにどうぞ。
        </p>
        <div className="row-actions settings-actions">
          <button type="button" className="button-primary" onClick={exportToFile}>
            ファイルに書き出す
          </button>
        </div>
        {messageBox(exportMessage)}
        {exportText !== null && (
          <div className="field">
            <label className="field-label" htmlFor={exportAreaId}>
              書き出した内容
            </label>
            <textarea id={exportAreaId} ref={exportAreaRef} className="field-control settings-text" readOnly value={exportText} />
            <div className="row-actions">
              <button type="button" className="button-quiet" onClick={copyExport}>
                コピーする
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>データの読み込み</h2>
        <p className="field-hint">このアプリで書き出したファイルを選ぶか、内容を貼り付けてください。</p>
        <div className="field">
          <label className="field-label" htmlFor={fileId}>
            ファイルを選ぶ
          </label>
          <input
            id={fileId}
            className="field-control"
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) inspect(await file.text());
              event.target.value = ''; // 同じファイルをもう一度選べるようにする
            }}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={importAreaId}>
            または、内容を貼り付ける
          </label>
          <textarea
            id={importAreaId}
            className="field-control settings-text"
            value={importText}
            onChange={(event) => inspect(event.target.value)}
          />
        </div>

        {preview && (
          <div className="notice notice-plain">
            <p>
              このファイルには、個体 <strong>{preview.individuals.length}</strong>体、チーム <strong>{preview.teams.length}</strong>個が入っています。
            </p>
            <label className="check">
              <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
              いまのデータに追加する(同じ個体・チームは、ファイルの内容で上書き)
            </label>
            <label className="check">
              <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              いまのデータを消して、置き換える
            </label>
            {mode === 'replace' && <p className="settings-danger">いまの個体とチームは、すべて消えます。元に戻せません。</p>}
            <div className="notice-actions">
              <button type="button" className="button-quiet" onClick={() => inspect('')}>
                やめる
              </button>
              <button type="button" className={mode === 'replace' ? 'button-danger' : 'button-primary'} onClick={runImport}>
                {mode === 'replace' ? '置き換える' : '追加する'}
              </button>
            </div>
          </div>
        )}
        {messageBox(importMessage)}
        <p className="field-hint">
          上限は、個体 {MAX_INDIVIDUALS}体、チーム {MAX_TEAMS}個です。超える場合は読み込まず、いまのデータは変わりません。
        </p>
      </section>

      <section className="card">
        <h2>データの出典</h2>
        <ul className="settings-sources">
          {sourcesJson.sources.map((source) => (
            <li key={source.id}>
              <strong>{source.name}</strong>({source.license})
              <br />
              <span className="summary-sub">
                {source.usedFor}
                <br />
                {source.copyright}
                <br />
                取得した版: {source.commit.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
        <p className="field-hint">
          ポケモン {sourcesJson.counts.pokemon}体、技 {sourcesJson.counts.moves}個、特性 {sourcesJson.counts.abilities}個、持ち物{' '}
          {sourcesJson.counts.items}個({sourcesJson.generatedOn} に作成)。有志が管理する非公式のデータです。
        </p>
      </section>
    </div>
  );
}
