import path from 'path';
import translationAliases from '../data/translation-aliases.json';
import {
  getPublicCharacterName,
  getPublicCharacterSlug,
} from './character-slugs';
import { loadJSON, readJSONFile } from './content';
import { getCharacterBuilds, getContentCharacters } from './content-tree';
import { getLocale, t } from './i18n';
import { resolveArtifactAssetUrl } from './item-assets';
import { localizedPath } from './paths';

/**
 * Artifact set bonus keys supported by the source data.
 *
 * Most sets provide 2-piece and 4-piece bonuses, while a few older
 * circlet-only sets provide a 1-piece bonus.
 */
const bonusKeys = ['1p', '2p', '4p'] as const;

type BonusKey = (typeof bonusKeys)[number];

/**
 * Character link rendered in the 4-piece artifact set usage section.
 */
type ArtifactSetUsage = {
  characterName: string;
  characterRarity: string;
  href: string;
};

/**
 * Translation aliases relevant to canonicalizing artifact set recommendation IDs.
 */
type TranslationAliasCategory = Partial<Record<'set', Record<string, string>>>;

const aliases = translationAliases as TranslationAliasCategory;

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
 * Extracts a canonical set ID from one artifact recommendation item.
 *
 * @param item Raw artifact set item from `artifacts-sets.json`.
 * @returns Canonical artifact set ID, or null when the item is unusable.
 */
function normalizeArtifactSetItemId(item: any) {
  const setId = item?.name;

  if (typeof setId !== 'string' || !setId.trim()) {
    return null;
  }

  return aliases.set?.[setId] ?? setId;
}

/**
 * Returns every direct item list attached to one artifact recommendation group.
 *
 * Groups can hold a plain `items` list, nested `choices`, or both.
 *
 * @param group Raw artifact recommendation group.
 * @returns Flat list of raw artifact set items.
 */
function getArtifactSetItems(group: any) {
  const items = Array.isArray(group?.items) ? group.items : [];
  const choiceItems = Array.isArray(group?.choices)
    ? group.choices.flatMap((choice: any) =>
        Array.isArray(choice?.items) ? choice.items : [],
      )
    : [];

  return [...items, ...choiceItems];
}

/**
 * Builds a reverse index of artifact sets mentioned as 4-piece options.
 *
 * Only builds marked `best: true` are scanned. Both ranked set rows and
 * conditional set groups are included because the artifact page labels this as
 * a 4-piece mention, not a ranking position.
 *
 * @param locale Locale dictionary bundle used for character display names.
 * @param lang Active language code used for character links.
 * @returns Artifact set IDs mapped to characters that mention them as 4-piece.
 */
function getArtifactSetFourPieceUsage(locale: any, lang: string) {
  const usageBySet = new Map<string, ArtifactSetUsage[]>();

  for (const character of getContentCharacters()) {
    const characterName = getPublicCharacterName(locale, character);
    const href = localizedPath(lang, getPublicCharacterSlug(character));
    const usageEntry = {
      characterName,
      characterRarity: character.rarity,
      href,
    };

    for (const build of getCharacterBuilds(character.characterPath)) {
      if (loadJSON(build.path, 'build-notes.json')?.best !== true) continue;

      const data = loadJSON(build.path, 'artifacts-sets.json');
      const groups = [
        ...(data?.artifact_sets?.flatMap((rank: any) => rank.groups ?? []) ??
          []),
        ...(data?.conditional?.flatMap(
          (entry: any) => entry.groups ?? [entry],
        ) ?? []),
      ];
      const seenInBuild = new Set<string>();

      for (const group of groups) {
        for (const item of getArtifactSetItems(group)) {
          if (Number(item?.pieces) !== 4) continue;

          const setId = normalizeArtifactSetItemId(item);
          if (!setId || seenInBuild.has(setId)) continue;

          seenInBuild.add(setId);
          const usage = usageBySet.get(setId) ?? [];
          if (!usage.some((item) => item.href === href)) usage.push(usageEntry);
          usageBySet.set(setId, usage);
        }
      }
    }
  }

  usageBySet.forEach((usage) => {
    usage.sort((a, b) => a.characterName.localeCompare(b.characterName));
  });

  return usageBySet;
}

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
function getArtifactSetEntries(
  locale: any,
  lang: string,
  fourPieceUsageBySet: Map<string, ArtifactSetUsage[]>,
) {
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
      fourPieceUsage: fourPieceUsageBySet.get(id) ?? [],
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
  const fourPieceUsageBySet = getArtifactSetFourPieceUsage(locale, lang);
  const artifactSets = getArtifactSetEntries(
    locale,
    lang,
    fourPieceUsageBySet,
  ).sort((a, b) => a.name.localeCompare(b.name));
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
