import { getPublicCharacterSlug } from './character-slugs';
import {
  getCharacterBuilds,
  getContentCharacters,
  PRE_AR_45_ROUTE_SEGMENT,
} from './content-tree';
import { languageCodes } from './languages';

/**
 * Returns static route params for every supported language.
 *
 * @returns Astro static path entries for `[lang]` pages.
 */
export function getLanguageStaticPaths() {
  return languageCodes.map((lang) => ({ params: { lang } }));
}

/**
 * Finds every character slug available in `src/content`.
 *
 * Element and rarity folders are implementation details, except Traveler whose
 * public URL includes the element because they have one folder per element.
 *
 * @returns Sorted unique character slugs.
 */
function getCharacterSlugs() {
  const slugs = new Set<string>();

  getContentCharacters().forEach(({ character, characterPath, element }) => {
    const slug = getPublicCharacterSlug({ character, element });

    slugs.add(slug);
    if (getCharacterBuilds(characterPath, PRE_AR_45_ROUTE_SEGMENT).length > 0) {
      slugs.add(`${slug}/${PRE_AR_45_ROUTE_SEGMENT}`);
    }
  });

  return [...slugs].sort((a, b) => a.localeCompare(b));
}

/**
 * Returns static route params for every localized character page.
 *
 * @returns Astro static path entries for `[lang]/[...character]`.
 */
export function getCharacterStaticPaths() {
  const characters = getCharacterSlugs();

  return languageCodes.flatMap((lang) =>
    characters.map((character) => ({ params: { lang, character } })),
  );
}
