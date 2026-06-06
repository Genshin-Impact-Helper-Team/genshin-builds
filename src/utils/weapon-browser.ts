import path from 'path';
import { readJSONFile } from './content';
import { getLocale, t } from './i18n';
import {
  formatWeaponPassive,
  type WeaponPassiveText,
  type WeaponPassiveValue,
} from './weapon-passive';
import { getWeaponSource } from './weapon-source';

const weaponTypes = [
  'bow',
  'catalyst',
  'claymore',
  'polearm',
  'sword',
] as const;
const refinements = [1, 2, 3, 4, 5] as const;

type WeaponType = (typeof weaponTypes)[number];

type SharedWeaponData = {
  rarity: number;
  source?: string;
  passive?: WeaponPassiveText;
  r1?: WeaponPassiveValue[];
  r2?: WeaponPassiveValue[];
  r3?: WeaponPassiveValue[];
  r4?: WeaponPassiveValue[];
  r5?: WeaponPassiveValue[];
  substat?: string;
  level_1?: {
    base_attack?: number;
    substat_value?: string;
  };
  level_max?: {
    base_attack?: number;
    substat_value?: string;
  };
};

function formatWeaponValue(value?: number | string) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value);
}

function translateWeaponSource(locale: any, source?: string) {
  const normalizedSource = getWeaponSource(source);
  const sourceTranslationKey = `Weapon source ${normalizedSource}`;
  const translatedSource = t(
    locale,
    'ui',
    sourceTranslationKey,
    undefined,
    false,
  );

  return translatedSource && translatedSource !== sourceTranslationKey
    ? translatedSource
    : normalizedSource;
}

function getWeaponEntries(locale: any, lang: string) {
  const weaponDataPath = path.resolve('src/data/weapons');

  return weaponTypes.flatMap((type) => {
    const filePath = path.join(weaponDataPath, `${type}.json`);
    const typeData = readJSONFile(filePath) as Record<string, SharedWeaponData>;
    const typeLabel = t(locale, 'ui', type, undefined, false);

    return Object.entries(typeData).map(([id, info]) => {
      const substatName = info.substat
        ? t(locale, 'stat', info.substat, undefined, false)
        : '';

      return {
        id,
        name: t(locale, 'weapon', id, undefined, false),
        rarity: info.rarity,
        type,
        typeLabel,
        sourceName: translateWeaponSource(locale, info.source),
        substat: info.substat ?? '',
        substatName,
        level1BaseAttack: formatWeaponValue(info.level_1?.base_attack),
        levelMaxBaseAttack: formatWeaponValue(info.level_max?.base_attack),
        level1Substat: formatWeaponValue(info.level_1?.substat_value),
        levelMaxSubstat: formatWeaponValue(info.level_max?.substat_value),
        passivePanels: info.passive
          ? refinements.map((refinement) => ({
              refinement,
              html: formatWeaponPassive(info, refinement, lang),
            }))
          : [],
      };
    });
  });
}

/**
 * Builds the localized weapon browser data used by the weapons page.
 */
export function getWeaponBrowserData(lang = 'en') {
  const locale = getLocale(lang);
  const weapons = getWeaponEntries(locale, lang).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const substats = [...new Set(weapons.map((weapon) => weapon.substat))]
    .filter(Boolean)
    .map((id) => ({
      id,
      label: t(locale, 'stat', id, undefined, false),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const rarities = [...new Set(weapons.map((weapon) => weapon.rarity))].sort(
    (a, b) => a - b,
  );

  return {
    lang,
    locale,
    rarities,
    substats,
    weapons,
    weaponTypes: weaponTypes.map((type) => ({
      id: type,
      label: t(locale, 'ui', type, undefined, false),
    })),
  };
}
