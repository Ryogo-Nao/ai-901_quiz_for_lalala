// メガシンカ。ギミックの共通の形(Gimmick)の、実装の1つ。
//
// メガシンカで変わるのは「種族値・タイプ・特性」なので、changeForm だけを書く。
// HP を変える changeStats などは、必要ないので書かない。

import type { MegaFormData, PokemonData } from '../data/index.ts';
import type { Gimmick } from './types.ts';

/** メガシンカの設定。formId はメガシンカ後の姿の ID */
export interface MegaConfig {
  formId: string;
}

/** 持ち物から、メガシンカ後の姿を探す。対応するメガストーンでなければ undefined */
export function megaFormForItem(species: PokemonData, itemId: string | null): MegaFormData | undefined {
  return species.megaForms.find((form) => form.requiredItem === itemId);
}

export const mega: Gimmick<MegaConfig> = {
  id: 'mega',
  label: 'メガシンカ',
  shortLabel: 'メガ',

  canUse: (species) => species.megaForms.length > 0,

  // メガシンカできるかどうかは、持ち物で決まる。
  // そのポケモン用のメガストーンを持っていれば設定あり、持っていなければ設定なし。
  syncSettings: (individual, species) => {
    const form = megaFormForItem(species, individual.itemId);
    return form ? { formId: form.id } : undefined;
  },

  changeForm: (form, config, context) => {
    const megaForm = context.species.megaForms.find((candidate) => candidate.id === config.formId);
    if (!megaForm) return form; // データに無い姿が指定されていたら、何も変えない
    return {
      name: megaForm.name,
      baseStats: megaForm.baseStats, // 種族値を差し替える
      types: megaForm.types, // タイプを差し替える
      stabTypes: megaForm.types,
      abilityId: megaForm.ability, // 特性を差し替える
    };
  },
};
