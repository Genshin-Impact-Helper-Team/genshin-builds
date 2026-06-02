import fs from 'fs';
import path from 'path';
import { sitePath } from './paths';

type CharacterAssetKind = 'image' | 'portrait';

/**
 * Folder identity for one character under src/content.
 */
type CharacterAssetContext = {
  element: string;
  rarity: string;
  character: string;
  characterPath?: string;
};

const contentBase = path.resolve('src/content');
const assetFileNames: Record<CharacterAssetKind, string> = {
  image: 'splash_art.webp',
  portrait: 'portrait.webp',
};

/**
 * Checks that a resolved asset path stays inside the content directory.
 *
 * @param filePath Absolute file path to validate.
 * @returns Whether the path is a child of src/content.
 */
function isInsideContent(filePath: string) {
  const relative = path.relative(contentBase, filePath);

  return (
    Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
  );
}

/**
 * Maps a metadata image field to its local WebP file name.
 *
 * @param kind Metadata image field to resolve.
 * @returns The expected local file name for the asset.
 */
function getCharacterAssetFileName(kind: CharacterAssetKind) {
  return assetFileNames[kind];
}

/**
 * Builds the absolute local path for a character asset.
 *
 * @param context Character folder identity.
 * @param kind Metadata image field to resolve.
 * @returns Absolute path to the expected WebP file.
 */
function getCharacterAssetFilePath(
  context: CharacterAssetContext,
  kind: CharacterAssetKind,
) {
  return path.join(
    context.characterPath ??
      path.join(
        contentBase,
        context.element,
        context.rarity,
        context.character,
      ),
    getCharacterAssetFileName(kind),
  );
}

/**
 * Builds the public route for a local character asset.
 *
 * @param context Character folder identity.
 * @param kind Metadata image field to resolve.
 * @returns Base-aware URL for the generated static asset route.
 */
function getCharacterAssetUrl(
  context: CharacterAssetContext,
  kind: CharacterAssetKind,
) {
  return sitePath(
    [
      'character-assets',
      context.element,
      context.rarity,
      context.character,
      getCharacterAssetFileName(kind),
    ].join('/'),
  );
}

/**
 * Resolves the display URL for a character image.
 *
 * Local WebP files are preferred when present. The metadata URL remains the
 * fallback so existing content still renders if an asset has not been hosted.
 *
 * @param context Character folder identity.
 * @param fallbackUrl URL from metadata.json.
 * @param kind Metadata image field to resolve.
 * @returns Local asset URL when available, otherwise the trimmed fallback URL.
 */
export function resolveCharacterAssetUrl(
  context: CharacterAssetContext,
  fallbackUrl: string | undefined,
  kind: CharacterAssetKind,
) {
  if (fs.existsSync(getCharacterAssetFilePath(context, kind))) {
    return getCharacterAssetUrl(context, kind);
  }

  return fallbackUrl?.trim();
}

/**
 * Collects static routes for every hosted character asset.
 *
 * @returns Astro getStaticPaths entries for existing local WebP files.
 */
export function getCharacterAssetStaticPaths() {
  if (!fs.existsSync(contentBase)) {
    return [];
  }

  return fs
    .readdirSync(contentBase, { withFileTypes: true })
    .filter((element) => element.isDirectory() && element.name !== 'site')
    .flatMap((element) =>
      fs
        .readdirSync(path.join(contentBase, element.name), {
          withFileTypes: true,
        })
        .filter((rarity) => rarity.isDirectory())
        .flatMap((rarity) =>
          fs
            .readdirSync(path.join(contentBase, element.name, rarity.name), {
              withFileTypes: true,
            })
            .filter((character) => character.isDirectory())
            .flatMap((character) => {
              const context = {
                element: element.name,
                rarity: rarity.name,
                character: character.name,
              };

              return (Object.keys(assetFileNames) as CharacterAssetKind[])
                .filter((kind) =>
                  fs.existsSync(getCharacterAssetFilePath(context, kind)),
                )
                .map((kind) => ({
                  params: {
                    asset: [
                      context.element,
                      context.rarity,
                      context.character,
                      getCharacterAssetFileName(kind),
                    ].join('/'),
                  },
                }));
            }),
        ),
      );
}

/**
 * Resolves and validates the file requested by the asset catch-all route.
 *
 * @param assetParam Route parameter shaped as element/rarity/character/file.
 * @returns Absolute file path when valid, otherwise null.
 */
export function resolveCharacterAssetFileFromRoute(assetParam?: string) {
  const parts = assetParam?.split('/').filter(Boolean) ?? [];

  if (parts.length !== 4) {
    return null;
  }

  const [element, rarity, character, fileName] = parts;
  const allowedFileNames = Object.values(assetFileNames);

  if (!allowedFileNames.includes(fileName)) {
    return null;
  }

  const filePath = path.resolve(
    contentBase,
    element,
    rarity,
    character,
    fileName,
  );

  return isInsideContent(filePath) ? filePath : null;
}
