import { languageCodes, type LanguageCode } from './languages';

type LocaleCategory = Record<string, string>;
type LocaleBundle = {
  weapon: LocaleCategory;
  artifact: LocaleCategory;
  character: LocaleCategory;
  stat: LocaleCategory;
  element: LocaleCategory;
  ability: LocaleCategory;
  ui: LocaleCategory;
  note: LocaleCategory;
};

const localeFiles = {
  weapon: 'weapons',
  artifact: 'artifact-sets',
  character: 'characters',
  stat: 'stats',
  element: 'elements',
  ability: 'abilities',
  ui: 'ui',
  note: 'notes',
} as const satisfies Record<keyof LocaleBundle, string>;

const dictionaries = import.meta.glob<LocaleCategory>('../i18n/*/*.json', {
  eager: true,
  import: 'default',
});

const locales = Object.fromEntries(
  languageCodes.map((lang) => [
    lang,
    Object.fromEntries(
      Object.entries(localeFiles).map(([category, fileName]) => [
        category,
        dictionaries[`../i18n/${lang}/${fileName}.json`] ?? {},
      ]),
    ) as LocaleBundle,
  ]),
) as Record<LanguageCode, LocaleBundle>;

function getLocaleCode(locale: unknown) {
  return (
    Object.entries(locales).find(
      ([, localeBundle]) => localeBundle === locale,
    )?.[0] ?? 'unknown'
  );
}

export function formatMissingTranslationWarning(
  lang: string | undefined,
  id: string,
  category?: string,
  sourceFile?: string,
) {
  return (
    `[i18n] [${(lang ?? 'unknown').toUpperCase()}] Missing translation for id '${id}'` +
    (category ? ` in category '${category}'` : '') +
    (sourceFile ? ` (source: ${sourceFile})` : '')
  );
}

export function getLocale(lang: string | undefined) {
  const localeKey =
    typeof lang === 'string' && lang in locales ? (lang as LanguageCode) : 'en';
  return locales[localeKey];
}

export function t(
  locale: any,
  category: string,
  id: string,
  sourceFile?: string,
  warn = true,
): string {
  const translation = locale?.[category]?.[id];

  if (translation !== undefined) return translation;

  if (warn) {
    console.warn(
      formatMissingTranslationWarning(
        getLocaleCode(locale),
        id,
        category,
        sourceFile,
      ),
    );
  }

  return locales.en[category as keyof LocaleBundle]?.[id] ?? id;
}
