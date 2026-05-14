import fs from 'fs';
import path from 'path';
import { getPublicCharacterSlug } from './character-slugs';
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
export function getCharacterSlugs() {
  const contentPath = path.join(process.cwd(), 'src', 'content');
  const slugs = new Set<string>();

  fs.readdirSync(contentPath, { withFileTypes: true })
    .filter((element) => element.isDirectory() && element.name !== 'site')
    .forEach((element) => {
      const elementPath = path.join(contentPath, element.name);

      fs.readdirSync(elementPath, { withFileTypes: true })
        .filter((rarity) => rarity.isDirectory())
        .forEach((rarity) => {
          const rarityPath = path.join(elementPath, rarity.name);

          fs.readdirSync(rarityPath, { withFileTypes: true })
            .filter((character) => character.isDirectory())
            .filter((character) =>
              fs.existsSync(
                path.join(rarityPath, character.name, 'metadata.json'),
              ),
            )
            .forEach((character) =>
              slugs.add(
                getPublicCharacterSlug({
                  character: character.name,
                  element: element.name,
                }),
              ),
            );
        });
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
