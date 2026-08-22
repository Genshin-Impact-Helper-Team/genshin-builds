import fs from 'fs';
import path from 'path';
import {
  getPublicCharacterName,
  getPublicCharacterSlug,
} from './character-slugs';
import { resolveCharacterAssetImage } from './character-assets';
import { normalizeVersion, readJSONFile, toTitleCase } from './content';
import { getCharacterBuilds, getContentCharacters } from './content-tree';
import { getLocale } from './i18n';
import { TranslationHelper } from './translator';

function parseVersionParts(version: string) {
  const match = version.match(/^\s*(\d+)\.(\d+)/);

  return match ? [Number(match[1]), Number(match[2])] : null;
}

function compareVersions(left: string, right: string) {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);

  if (!leftParts && !rightParts) return 0;
  if (!leftParts) return -1;
  if (!rightParts) return 1;

  return leftParts[0] - rightParts[0] || leftParts[1] - rightParts[1];
}

function newestVersion(versions: string[]) {
  return (
    versions
      .filter(Boolean)
      .sort((left, right) => compareVersions(right, left))[0] ?? ''
  );
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
  defaultLastUpdated: string,
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
      lastUpdated:
        normalizeVersion(buildNoteData?.last_updated) || defaultLastUpdated,
    };
  });
}

/**
 * Builds the localized character list used by the home page.
 *
 * The content directory is the source of truth: element, rarity, and slug come
 * from folder names, weapon comes from metadata.json, and images come from
 * src/assets/character-assets.
 *
 * @param lang Requested language code.
 * @returns Characters plus the matching locale bundle.
 */
export function getHomePageData(lang = 'en') {
  const locale = getLocale(lang);
  const contentPath = path.join(process.cwd(), 'src', 'content');
  const translator = new TranslationHelper(locale, {}, lang);
  const latestVersion = getLatestChangelogVersion(contentPath);

  const characters = getContentCharacters(contentPath, true)
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
      const versionReleased = normalizeVersion(metadata.version_released);
      const builds = getBuildSummaries(
        characterPath,
        lang,
        translator,
        lastUpdated,
      );
      const buildLastUpdatedValues = builds
        .map((build) => build.lastUpdated)
        .filter(Boolean);
      const effectiveLastUpdatedValues =
        buildLastUpdatedValues.length > 0
          ? buildLastUpdatedValues
          : [lastUpdated].filter(Boolean);
      const distinctBuildLastUpdatedValues = new Set(
        effectiveLastUpdatedValues,
      );
      const newestLastUpdated = newestVersion(effectiveLastUpdatedValues);

      return {
        name,
        slug: getPublicCharacterSlug({
          character,
          element,
        }),
        element,
        rarity,
        weapon: metadata.weapon,
        lastUpdated: newestLastUpdated,
        versionReleased,
        hasMultipleLastUpdated: distinctBuildLastUpdatedValues.size > 1,
        isWip: newestLastUpdated.toUpperCase() === 'WIP',
        isRecentlyUpdated: latestVersion
          ? effectiveLastUpdatedValues.includes(latestVersion)
          : false,
        portrait: resolveCharacterAssetImage(assetContext, 'portrait'),
        builds,
      };
    })
    .sort(
      (a, b) =>
        a.element.localeCompare(b.element) || a.name.localeCompare(b.name),
    );

  const recentlyUpdatedCharacters = characters.filter(
    (character) => character.isRecentlyUpdated,
  );

  return {
    characters,
    latestVersion,
    recentlyUpdatedCharacters,
    lang,
    locale,
  };
}
