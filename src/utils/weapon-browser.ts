import path from 'path';
import { readJSONFile } from './content';
import { getLocale, t } from './i18n';
import { resolveWeaponAssetUrl } from './item-assets';
import {
  formatWeaponPassive,
  type WeaponPassiveText,
  type WeaponPassiveValue,
} from './weapon-passive';
import { getWeaponSource } from './weapon-source';

/**
 * Weapon type files that make up the shared weapon data source.
 */
const weaponTypes = [
  'bow',
  'catalyst',
  'claymore',
  'polearm',
  'sword',
] as const;

/**
 * Refinement levels rendered as selectable passive descriptions.
 */
const refinements = [1, 2, 3, 4, 5] as const;

type WeaponType = (typeof weaponTypes)[number];

/**
 * Raw weapon record loaded from a type-specific weapon JSON file.
 */
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

/**
 * Normalizes numeric and string stat values for table rendering.
 *
 * @param value Raw value from a weapon level block.
 * @returns Display-ready value, or an empty string when no value exists.
 */
function formatWeaponValue(value?: number | string) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value);
}

/**
 * Translates a weapon acquisition source with normalized source fallback.
 *
 * @param locale Locale dictionary bundle used for UI source labels.
 * @param source Raw weapon source value from the data file.
 * @returns Localized source label, or the normalized source name.
 */
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

/**
 * Loads, localizes, and flattens every weapon entry across all weapon types.
 *
 * The returned objects include display labels, table values, filter metadata,
 * and pre-rendered passive HTML for each refinement level.
 *
 * @param locale Locale dictionary bundle used for names and labels.
 * @param lang Active language code used for passive text formatting.
 * @returns Localized weapon card entries.
 */
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
        imageUrl: resolveWeaponAssetUrl(type, id),
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
 *
 * @param lang Requested language code. Defaults to English.
 * @returns Locale, sorted weapons, and filter option data.
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
