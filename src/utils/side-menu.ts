import fs from 'fs';
import path from 'path';
import {
  getPublicCharacterName,
  getPublicCharacterSlug,
} from './character-slugs';
import { t } from './i18n';

const elementOrder = [
  'pyro',
  'hydro',
  'dendro',
  'electro',
  'anemo',
  'cryo',
  'geo',
];
const rarityOrder = ['5', '4'];

type SideMenuCharacter = {
  name: string;
  slug: string;
};

type SideMenuRarity = {
  rarity: string;
  label: string;
  characters: SideMenuCharacter[];
};

type SideMenuElement = {
  element: string;
  name: string;
  rarities: SideMenuRarity[];
};

const isPresent = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

/**
 * Builds the header side-menu data from the content folder tree.
 *
 * The menu mirrors `src/content/<element>/<rarity>/<character>` so newly added
 * characters appear automatically under the right element and rarity.
 *
 * @param locale Current locale bundle used to translate labels.
 * @returns Element groups with nested rarity and character links.
 */
export function getSideMenuData(locale: any): SideMenuElement[] {
  const contentPath = path.join(process.cwd(), 'src', 'content');

  // Preserve the game's usual element/rarity ordering instead of filesystem order.
  return elementOrder
    .map((element) => {
      const elementPath = path.join(contentPath, element);

      if (!fs.existsSync(elementPath)) {
        return null;
      }

      const rarities = rarityOrder
        .map((rarity) => {
          const rarityPath = path.join(elementPath, rarity);

          if (!fs.existsSync(rarityPath)) {
            return null;
          }

          const characters = fs
            .readdirSync(rarityPath, { withFileTypes: true })
            .filter((character) => character.isDirectory())
            .filter((character) =>
              fs.existsSync(
                path.join(rarityPath, character.name, 'metadata.json'),
              ),
            )
            .map((character) => ({
              name: getPublicCharacterName(locale, {
                character: character.name,
                element,
              }),
              slug: getPublicCharacterSlug({
                character: character.name,
                element,
              }),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

          return {
            rarity,
            label: `${rarity} \u2605`,
            characters,
          };
        })
        .filter(isPresent)
        .filter((rarity) => rarity.characters.length > 0);

      return {
        element,
        name: t(locale, 'element', element),
        rarities,
      };
    })
    .filter(isPresent)
    .filter((element) => element.rarities.length > 0);
}
