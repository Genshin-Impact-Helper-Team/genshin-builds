import fs from 'fs';
import path from 'path';

/**
 * Returns the localized note for a content item.
 *
 * Supports:
 * - legacy string notes
 * - localized note objects
 *
 * Example:
 * {
 *   note: {
 *     en: "Example note",
 *     fr: "Note d'exemple"
 *   }
 * }
 *
 * Falls back to English if the requested language
 * does not exist.
 *
 * @param item Content item containing a note field.
 * @param lang Current language code.
 * @returns Localized note string or null if no note exists.
 */
export function getLocalizedNote(item: any, lang: string): string | null {
  if (!item?.note) return null;

  if (typeof item.note === 'string') {
    return item.note;
  }

  return item.note[lang] ?? item.note.en ?? null;
}

/**
 * Loads a JSON file from either:
 * - the current build folder
 * - the parent character folder
 *
 * Build-level files override character-level files.
 *
 * Example lookup order:
 * 1. builds/dps/weapons.json
 * 2. character/weapons.json
 *
 * @param buildPath Current build directory path.
 * @param fileName JSON file name.
 * @returns Parsed JSON object or null if the file does not exist.
 */
export function loadJSON(buildPath: string, fileName: string) {
  const buildFile = path.join(buildPath, fileName);
  const charFile = path.join(path.dirname(buildPath), fileName);

  if (fs.existsSync(buildFile)) {
    return JSON.parse(fs.readFileSync(buildFile, 'utf-8'));
  }

  if (fs.existsSync(charFile)) {
    return JSON.parse(fs.readFileSync(charFile, 'utf-8'));
  }

  return null;
}

/**
 * Converts a kebab-case string into title case.
 *
 * Example:
 * - "raiden-shogun" -> "Raiden Shogun"
 *
 * @param str Input kebab-case string.
 * @returns Human-readable title string.
 */
export const toTitleCase = (str: string) =>
  str
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/**
 * Searches the content directory for a character folder.
 *
 * Traverses:
 * - element folders
 * - rarity folders
 *
 * Example structure:
 * content/electro/5-star/raiden-shogun
 *
 * @param base Base content directory.
 * @param char Character slug.
 * @returns Character path information or null if not found.
 */
export function findCharacterPath(base: string, char: string) {
  for (const element of fs.readdirSync(base)) {
    for (const rarity of fs.readdirSync(path.join(base, element))) {
      const candidate = path.join(base, element, rarity, char);

      if (fs.existsSync(candidate)) {
        return {
          element,
          rarity,
          path: candidate,
        };
      }
    }
  }

  return null;
}
