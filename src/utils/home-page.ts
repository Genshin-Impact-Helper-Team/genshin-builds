import fs from 'fs';
import path from 'path';
import {
  getPublicCharacterName,
  getPublicCharacterSlug,
} from './character-slugs';
import { getLocale } from './i18n';

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

  // Walk element/rarity/character folders so new content appears automatically.
  const characters = fs
    .readdirSync(contentPath, { withFileTypes: true })
    .filter((element) => element.isDirectory())
    .flatMap((element) =>
      fs
        .readdirSync(path.join(contentPath, element.name), {
          withFileTypes: true,
        })
        .filter((rarity) => rarity.isDirectory())
        .flatMap((rarity) =>
          fs
            .readdirSync(path.join(contentPath, element.name, rarity.name), {
              withFileTypes: true,
            })
            .filter((character) => character.isDirectory())
            .flatMap((character) => {
              const metadataPath = path.join(
                contentPath,
                element.name,
                rarity.name,
                character.name,
                'metadata.json',
              );

              if (!fs.existsSync(metadataPath)) {
                return [];
              }

              const metadata = JSON.parse(
                fs.readFileSync(metadataPath, 'utf-8'),
              );
              const name = getPublicCharacterName(locale, {
                character: character.name,
                element: element.name,
              });

              return {
                name,
                slug: getPublicCharacterSlug({
                  character: character.name,
                  element: element.name,
                }),
                element: element.name,
                rarity: rarity.name,
                weapon: metadata.weapon,
                portrait: metadata.portrait,
              };
            }),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    characters,
    lang,
    locale,
  };
}
