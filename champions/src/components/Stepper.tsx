// 「− 数値 +」で数値を増減する部品(能力ポイント、ランク補正)。

interface Props {
  /** 何の数値か(読み上げソフト用の名前。例: 「こうげきの能力ポイント」) */
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** 表示のしかた。省略すると数値をそのまま出す(ランクは「+2」「±0」のように出したいので指定する) */
  format?: (value: number) => string;
}

export default function Stepper({ label, value, min, max, onChange, format }: Props) {
  return (
    <div className="stat-stepper">
      <button type="button" className="stepper-button" aria-label={`${label}を1減らす`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      {format ? (
        <output className="stepper-input stepper-output" aria-label={label}>
          {format(value)}
        </output>
      ) : (
        <input
          className="stepper-input"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          aria-label={label}
          value={value}
          onChange={(event) => {
            const next = Math.trunc(Number(event.target.value));
            onChange(Number.isFinite(next) ? Math.max(min, Math.min(max, next)) : min);
          }}
          onFocus={(event) => event.target.select()}
        />
      )}
      <button type="button" className="stepper-button" aria-label={`${label}を1増やす`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
