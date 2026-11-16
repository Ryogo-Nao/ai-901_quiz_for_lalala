// メガシンカの設定欄。

import SelectField from '../../components/SelectField.tsx';
import { changeMegaForm } from '../../domain/editIndividual.ts';
import type { GimmickEditorProps } from './types.ts';

export default function MegaEditor({ individual, species, data, onChange }: GimmickEditorProps) {
  const options = [
    { value: '', label: 'しない' },
    ...species.megaForms.map((form) => ({ value: form.id, label: form.name })),
  ];
  return (
    <SelectField
      label="メガシンカ"
      value={individual.gimmicks.mega?.formId ?? ''}
      options={options}
      onChange={(value) => onChange(changeMegaForm(individual, value === '' ? null : value, data))}
      hint="メガシンカにはメガストーンが必要なので、選ぶと持ち物も一緒に変わります。"
    />
  );
}
