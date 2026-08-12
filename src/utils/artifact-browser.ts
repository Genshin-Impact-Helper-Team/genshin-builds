import path from 'path';
import translationAliases from '../data/translation-aliases.json';
import {
  getBestBuildUsage,
  getWipNoteItems,
  type BuildUsage,
} from './build-usage';
import { loadJSON, readJSONFile } from './content';
import { getLocale, t } from './i18n';
import { resolveArtifactAssetImage } from './item-assets';

const bonusKeys = ['1p', '2p', '4p'] as const;

type LabelRef = readonly [string, string];

const tagOptionGroups = [
  {
    label: ['ui', 'Stat'],
    options: [
      { id: 'atk', label: ['stat', 'atk%'], tags: ['atk', 'atk-set'] },
      { id: 'hp', label: ['stat', 'hp%'], tags: ['hp', 'hp-set'] },
      { id: 'def', label: ['stat', 'def%'], tags: ['def', 'def-set'] },
      { id: 'er', label: ['stat', 'er'], tags: ['er-set'] },
      { id: 'em', label: ['stat', 'em'], tags: ['em', 'em-set'] },
      { id: 'crit-rate', label: ['stat', 'cr'], tags: ['cr'] },
    ],
  },
  {
    label: ['ui', 'Damage Type'],
    options: [
      {
        id: 'physical',
        label: ['stat', 'physical-dmg'],
        tags: ['physical-set'],
      },
      {
        id: 'anemo',
        label: ['stat', 'anemo-dmg'],
        tags: ['anemo', 'anemo-set'],
      },
      {
        id: 'geo',
        label: ['stat', 'geo-dmg'],
        tags: ['geo', 'geo-set'],
      },
      {
        id: 'electro',
        label: ['stat', 'electro-dmg'],
        tags: ['electro', 'electro-set'],
      },
      {
        id: 'dendro',
        label: ['stat', 'dendro-dmg'],
        tags: ['dendro', 'dendro-set'],
      },
      {
        id: 'hydro',
        label: ['stat', 'hydro-dmg'],
        tags: ['hydro', 'hydro-set'],
      },
      {
        id: 'pyro',
        label: ['stat', 'pyro-dmg'],
        tags: ['pyro', 'pyro-set'],
      },
      {
        id: 'cryo',
        label: ['stat', 'cryo-dmg'],
        tags: ['cryo', 'cryo-set'],
      },
    ],
  },
  {
    label: ['ui', 'Talents'],
    options: [
      { id: 'normal-attack', label: ['ability', 'na'], tags: ['na'] },
      { id: 'charged-attack', label: ['ability', 'ca'], tags: ['ca'] },
      { id: 'plunging-attack', label: ['ability', 'plunge'], tags: ['plunge'] },
      { id: 'skill', label: ['ability', 'skill'], tags: ['skill'] },
      { id: 'burst', label: ['ability', 'burst'], tags: ['burst'] },
    ],
  },
  {
    label: ['ui', 'Utility'],
    options: [
      {
        id: 'healing',
        label: ['stat', 'healing-bonus'],
        tags: ['healing', 'healing-set'],
      },
      { id: 'shield', label: ['ability', 'shield'], tags: ['shield'] },
      {
        id: 'elemental-res',
        label: ['stat', 'elemental-res'],
        tags: ['elemental-res'],
      },
    ],
  },
  {
    label: ['ui', 'Special Mechanics'],
    options: [
      { id: 'lunar', label: ['element', 'lunar'], tags: ['lunar'] },
      {
        id: 'stellar',
        label: ['element', 'stellar-glimmer'],
        tags: ['stellar'],
      },
      {
        id: 'nightsoul',
        label: ['ability', 'nightsoul-blessing'],
        tags: ['nightsoul'],
      },
      { id: 'hexerei', label: ['ability', 'hexerei'], tags: ['hexerei'] },
    ],
  },
] as const satisfies readonly {
  label: LabelRef;
  options: readonly {
    id: string;
    label: LabelRef;
    tags: readonly string[];
  }[];
}[];

const tagGroups = tagOptionGroups.flatMap((group) => group.options);

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
  version_released?: string;
  tags?: string[];
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

function getArtifactSetTagGroups(tags: string[]) {
  const tagSet = new Set(tags);

  return tagGroups
    .filter((group) => group.tags.some((tag) => tagSet.has(tag)))
    .map((group) => group.id);
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
  return getBestBuildUsage(locale, lang, (buildPath, buildNotes) => {
    const data = loadJSON(buildPath, 'artifacts-sets.json');
    const groups = [
      ...(data?.artifact_sets?.flatMap((entry: any, index: number) =>
        (entry.groups ?? []).map((group: any) => ({
          group,
          rank: index + 1,
        })),
      ) ?? []),
      ...(data?.conditional?.flatMap((entry: any) =>
        (entry.groups ?? [entry]).map((group: any) => ({ group })),
      ) ?? []),
    ];

    return [
      ...groups.flatMap(({ group, rank }) =>
        getArtifactSetItems(group)
          .filter((item) => Number(item?.pieces) === 4)
          .map((item) => ({ id: normalizeArtifactSetItemId(item), rank })),
      ),
      ...getWipNoteItems(
        buildNotes,
        'artifact',
        'set',
        (id) => aliases.set?.[id] ?? id,
      ),
    ];
  });
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
  fourPieceUsageBySet: Map<string, BuildUsage[]>,
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
        html: info[key]?.[lang] ?? info[key]?.en ?? '',
      }))
      .filter((bonus) => bonus.html);

    return {
      id,
      image: resolveArtifactAssetImage(id),
      name: t(locale, 'artifact', id, undefined, false),
      rarity: info.rarity,
      versionReleased: info.version_released ?? '',
      bonuses,
      tags: info.tags ?? [],
      tagGroups: getArtifactSetTagGroups(info.tags ?? []),
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
  const visibleTagOptionGroups = tagOptionGroups
    .map((group) => ({
      label: t(locale, group.label[0], group.label[1], undefined, false),
      options: group.options
        .filter((option) =>
          artifactSets.some((artifactSet) =>
            artifactSet.tagGroups.includes(option.id),
          ),
        )
        .map((option) => ({
          id: option.id,
          label: t(locale, option.label[0], option.label[1], undefined, false),
        })),
    }))
    .filter((group) => group.options.length > 0);

  return {
    artifactSets,
    lang,
    locale,
    rarities,
    tagOptionGroups: visibleTagOptionGroups,
  };
}
