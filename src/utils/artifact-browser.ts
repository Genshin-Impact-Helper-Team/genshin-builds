import path from 'path';
import { readJSONFile } from './content';
import { getLocale, t } from './i18n';
import { resolveArtifactAssetUrl } from './item-assets';

/**
 * Artifact set bonus keys supported by the source data.
 *
 * Most sets provide 2-piece and 4-piece bonuses, while a few older
 * circlet-only sets provide a 1-piece bonus.
 */
const bonusKeys = ['1p', '2p', '4p'] as const;

type BonusKey = (typeof bonusKeys)[number];

/**
 * Localized bonus text as stored in `artifact_sets.json`.
 *
 * English is treated as the fallback language when a requested locale is
 * missing from a bonus entry.
 */
type LocalizedArtifactEffect = {
  en?: string;
  [lang: string]: string | undefined;
};

/**
 * Raw artifact set record loaded from the shared artifact data file.
 */
type ArtifactSetData = {
  rarity: number;
  '1p'?: LocalizedArtifactEffect;
  '2p'?: LocalizedArtifactEffect;
  '4p'?: LocalizedArtifactEffect;
};

/**
 * Returns a localized artifact bonus description with English fallback.
 *
 * @param effect Localized bonus text object from the artifact data.
 * @param lang Active language code.
 * @returns Localized HTML/text for the bonus, or an empty string when absent.
 */
function getLocalizedEffect(
  effect: LocalizedArtifactEffect | undefined,
  lang: string,
) {
  return effect?.[lang] ?? effect?.en ?? '';
}

/**
 * Loads and localizes every artifact set for the browser grid.
 *
 * The returned entries keep both display data and filter data together so the
 * Astro component can render cards without reaching back into the raw JSON.
 *
 * @param locale Locale dictionary bundle used for set names.
 * @param lang Active language code used for bonus descriptions.
 * @returns Localized artifact set card entries.
 */
function getArtifactSetEntries(locale: any, lang: string) {
  const filePath = path.resolve('src/data/artifacts/artifact_sets.json');
  const artifactData = readJSONFile(filePath) as Record<
    string,
    ArtifactSetData
  >;

  return Object.entries(artifactData).map(([id, info]) => {
    const bonuses = bonusKeys
      .map((key) => ({
        id: key,
        label: key.toUpperCase(),
        html: getLocalizedEffect(info[key as BonusKey], lang),
      }))
      .filter((bonus) => bonus.html);

    return {
      id,
      imageUrl: resolveArtifactAssetUrl(id),
      name: t(locale, 'artifact', id, undefined, false),
      rarity: info.rarity,
      bonuses,
      bonusTypes: bonuses.map((bonus) => bonus.id),
    };
  });
}

/**
 * Builds the localized artifact set browser data used by the artifact sets page.
 *
 * @param lang Requested language code. Defaults to English.
 * @returns Locale, sorted artifact sets, and filter option data.
 */
export function getArtifactSetBrowserData(lang = 'en') {
  const locale = getLocale(lang);
  const artifactSets = getArtifactSetEntries(locale, lang).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const rarities = [
    ...new Set(artifactSets.map((artifactSet) => artifactSet.rarity)),
  ].sort((a, b) => a - b);
  const bonusTypes = bonusKeys
    .filter((key) =>
      artifactSets.some((artifactSet) => artifactSet.bonusTypes.includes(key)),
    )
    .map((key) => ({
      id: key,
      label: key.toUpperCase(),
    }));

  return {
    artifactSets,
    bonusTypes,
    lang,
    locale,
    rarities,
  };
}
