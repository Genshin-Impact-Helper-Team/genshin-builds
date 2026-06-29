import fs from 'fs';
import path from 'path';
import {
  getPublicCharacterName,
  getPublicCharacterSlug,
} from './character-slugs';
import { resolveCharacterAssetUrl } from './character-assets';
import { readJSONFile, toTitleCase } from './content';
import { getCharacterBuilds, getContentCharacters } from './content-tree';
import { getLocale } from './i18n';
import { TranslationHelper } from './translator';

function normalizeVersion(version: unknown) {
  return typeof version === 'string'
    ? version
        .trim()
        .replace(/\s*\/\s*/g, ' / ')
        .replace(/\s+/g, ' ')
    : '';
}

function getLatestChangelogVersion(contentPath: string) {
  const changelogPath = path.join(contentPath, 'site', 'changelog.json');

  if (!fs.existsSync(changelogPath)) {
    return '';
  }

  const changelog = readJSONFile(changelogPath);

  return normalizeVersion(changelog?.groups?.[0]?.version);
}

function getBuildSummaries(
  characterPath: string,
  lang: string,
  translator: TranslationHelper,
) {
  return getCharacterBuilds(characterPath).map((build) => {
    const buildNotesPath = path.join(build.path, 'build-notes.json');
    const buildNoteData = fs.existsSync(buildNotesPath)
      ? readJSONFile(buildNotesPath)
      : null;
    const rawBuildName =
      buildNoteData?.name?.[lang] ??
      buildNoteData?.name?.en ??
      toTitleCase(build.name);

    return {
      name: translator.translateNoteText(rawBuildName, buildNotesPath),
    };
  });
}

/**
 * Builds the localized character list used by the home page.
 *
 * The content directory is the source of truth: element, rarity, and slug come
 * from folder names, while weapon and portrait come from metadata.json.
 *
 * @param lang Requested language code.
 * @returns Characters plus the matching locale bundle.
 */
export function getHomePageData(lang = 'en') {
  const locale = getLocale(lang);
  const contentPath = path.join(process.cwd(), 'src', 'content');
  const translator = new TranslationHelper(locale, {}, lang);
  const latestVersion = getLatestChangelogVersion(contentPath);

  const characters = getContentCharacters(contentPath)
    .map(({ character, characterPath, element, metadataPath, rarity }) => {
      const metadata = readJSONFile(metadataPath);
      const assetContext = {
        element,
        rarity,
        character,
        characterPath,
      };
      const name = getPublicCharacterName(locale, {
        character,
        element,
      });
      const lastUpdated = normalizeVersion(metadata.last_updated);

      return {
        name,
        slug: getPublicCharacterSlug({
          character,
          element,
        }),
        element,
        rarity,
        weapon: metadata.weapon,
        lastUpdated,
        isRecentlyUpdated: latestVersion
          ? lastUpdated === latestVersion
          : false,
        image: resolveCharacterAssetUrl(assetContext, metadata.image, 'image'),
        portrait: resolveCharacterAssetUrl(
          assetContext,
          metadata.portrait,
          'portrait',
        ),
        builds: getBuildSummaries(characterPath, lang, translator),
      };
    })
    .sort(
      (a, b) =>
        a.element.localeCompare(b.element) || a.name.localeCompare(b.name),
    );

  const recentlyUpdatedCharacters = latestVersion
    ? characters.filter((character) => character.lastUpdated === latestVersion)
    : [];

  return {
    characters,
    latestVersion,
    recentlyUpdatedCharacters,
    lang,
    locale,
  };
}
