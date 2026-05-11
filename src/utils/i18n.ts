import enWeapons from '../i18n/en/weapons.json';
import enArtifacts from '../i18n/en/artifact-sets.json';
import enCharacters from '../i18n/en/characters.json';
import enStats from '../i18n/en/stats.json';
import enElements from '../i18n/en/elements.json';
import enUi from '../i18n/en/ui.json';

import frWeapons from '../i18n/fr/weapons.json';
import frArtifacts from '../i18n/fr/artifact-sets.json';
import frCharacters from '../i18n/fr/characters.json';
import frStats from '../i18n/fr/stats.json';
import frElements from '../i18n/fr/elements.json';
import frUi from '../i18n/fr/ui.json';

import deWeapons from '../i18n/de/weapons.json';
import deArtifacts from '../i18n/de/artifact-sets.json';
import deCharacters from '../i18n/de/characters.json';
import deStats from '../i18n/de/stats.json';
import deElements from '../i18n/de/elements.json';
import deUi from '../i18n/de/ui.json';

import esWeapons from '../i18n/es/weapons.json';
import esArtifacts from '../i18n/es/artifact-sets.json';
import esCharacters from '../i18n/es/characters.json';
import esStats from '../i18n/es/stats.json';
import esElements from '../i18n/es/elements.json';
import esUi from '../i18n/es/ui.json';

import itWeapons from '../i18n/it/weapons.json';
import itArtifacts from '../i18n/it/artifact-sets.json';
import itCharacters from '../i18n/it/characters.json';
import itStats from '../i18n/it/stats.json';
import itElements from '../i18n/it/elements.json';
import itUi from '../i18n/it/ui.json';

import ruWeapons from '../i18n/ru/weapons.json';
import ruArtifacts from '../i18n/ru/artifact-sets.json';
import ruCharacters from '../i18n/ru/characters.json';
import ruStats from '../i18n/ru/stats.json';
import ruElements from '../i18n/ru/elements.json';
import ruUi from '../i18n/ru/ui.json';

// Keep locale imports explicit so bundlers include every JSON dictionary.
const locales = {
  en: {
    weapon: enWeapons,
    artifact: enArtifacts,
    character: enCharacters,
    stat: enStats,
    element: enElements,
    ui: enUi,
  },

  fr: {
    weapon: frWeapons,
    artifact: frArtifacts,
    character: frCharacters,
    stat: frStats,
    element: frElements,
    ui: frUi,
  },

  de: {
    weapon: deWeapons,
    artifact: deArtifacts,
    character: deCharacters,
    stat: deStats,
    element: deElements,
    ui: deUi,
  },

  es: {
    weapon: esWeapons,
    artifact: esArtifacts,
    character: esCharacters,
    stat: esStats,
    element: esElements,
    ui: esUi,
  },

  it: {
    weapon: itWeapons,
    artifact: itArtifacts,
    character: itCharacters,
    stat: itStats,
    element: itElements,
    ui: itUi,
  },

  ru: {
    weapon: ruWeapons,
    artifact: ruArtifacts,
    character: ruCharacters,
    stat: ruStats,
    element: ruElements,
    ui: ruUi,
  },
};

/**
 * Returns the locale bundle for a requested language.
 *
 * Unknown or missing language codes fall back to English so routes can render
 * even when the URL contains an unsupported language segment.
 *
 * @param lang Requested language code.
 * @returns Locale dictionary bundle.
 */
export function getLocale(lang: string | undefined) {
  const localeKey =
    typeof lang === 'string' && lang in locales
      ? (lang as keyof typeof locales)
      : 'en';
  return locales[localeKey];
}

/**
 * Looks up a translated string by category and ID.
 *
 * When a translation is missing, the original ID is returned. Optional warnings
 * make missing content visible during development without breaking rendering.
 *
 * @param locale Locale dictionary bundle.
 * @param category Translation dictionary name.
 * @param id Translation key.
 * @param sourceFile Optional content file path for debugging warnings.
 * @param warn Whether to log missing translation warnings.
 * @returns Translated string, or the original ID if missing.
 */
export function t(
  locale: any,
  category: string,
  id: string,
  sourceFile?: string,
  warn = true,
): string {
  const translation = locale?.[category]?.[id];

  if (translation !== undefined) {
    return translation;
  }

  if (warn) {
    console.warn(
      `[i18n] Missing translation for id '${id}' in category '${category}'` +
        (sourceFile ? ` (source: ${sourceFile})` : ''),
    );
  }

  return id;
}
