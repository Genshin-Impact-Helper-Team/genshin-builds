import fs from 'fs';
import path from 'path';
import { sitePath } from './paths';

const assetsBase = path.resolve('src/data/assets');
const weaponTypes = [
  'bow',
  'catalyst',
  'claymore',
  'polearm',
  'sword',
] as const;

/**
 * Checks that a resolved asset path stays inside the item asset directory.
 *
 * @param filePath Absolute file path to validate.
 * @returns Whether the path is a child of src/data/assets.
 */
function isInsideAssets(filePath: string) {
  const relative = path.relative(assetsBase, filePath);

  return (
    Boolean(relative) &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}

/**
 * Builds the expected local file path for a weapon image.
 *
 * @param type Weapon type folder.
 * @param id Weapon data ID.
 * @returns Absolute path to the expected WebP image.
 */
function getWeaponAssetFilePath(type: string, id: string) {
  return path.join(assetsBase, 'weapons', type, `${id}.webp`);
}

/**
 * Builds the expected local file path for an artifact set image.
 *
 * @param id Artifact set data ID.
 * @returns Absolute path to the expected WebP image.
 */
function getArtifactAssetFilePath(id: string) {
  return path.join(assetsBase, 'artifacts', `${id}.webp`);
}

/**
 * Resolves the public URL for a hosted weapon image.
 *
 * @param type Weapon type folder.
 * @param id Weapon data ID.
 * @returns Base-aware asset URL when the image exists, otherwise an empty string.
 */
export function resolveWeaponAssetUrl(type: string, id: string) {
  if (!fs.existsSync(getWeaponAssetFilePath(type, id))) {
    return '';
  }

  return sitePath(['item-assets', 'weapons', type, `${id}.webp`].join('/'));
}

/**
 * Resolves the public URL for a hosted weapon image using only its data ID.
 *
 * Character recommendation popovers know the weapon ID, while the current
 * character metadata owns the weapon type. Searching the small shared asset
 * folders keeps those component props simple.
 *
 * @param id Weapon data ID.
 * @returns Base-aware asset URL when the image exists, otherwise an empty string.
 */
export function resolveWeaponAssetUrlById(id: string) {
  const type = weaponTypes.find((weaponType) =>
    fs.existsSync(getWeaponAssetFilePath(weaponType, id)),
  );

  return type ? resolveWeaponAssetUrl(type, id) : '';
}

/**
 * Resolves the public URL for a hosted artifact set image.
 *
 * @param id Artifact set data ID.
 * @returns Base-aware asset URL when the image exists, otherwise an empty string.
 */
export function resolveArtifactAssetUrl(id: string) {
  if (!fs.existsSync(getArtifactAssetFilePath(id))) {
    return '';
  }

  return sitePath(['item-assets', 'artifacts', `${id}.webp`].join('/'));
}

/**
 * Collects static routes for every hosted weapon and artifact set image.
 *
 * @returns Astro getStaticPaths entries for existing local WebP files.
 */
export function getItemAssetStaticPaths() {
  const weaponAssetPaths = weaponTypes.flatMap((type) => {
    const typePath = path.join(assetsBase, 'weapons', type);

    if (!fs.existsSync(typePath)) {
      return [];
    }

    return fs
      .readdirSync(typePath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.webp'))
      .map((entry) => ({
        params: {
          asset: ['weapons', type, entry.name].join('/'),
        },
      }));
  });
  const artifactAssetPath = path.join(assetsBase, 'artifacts');
  const artifactAssetPaths = fs.existsSync(artifactAssetPath)
    ? fs
        .readdirSync(artifactAssetPath, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.webp'))
        .map((entry) => ({
          params: {
            asset: ['artifacts', entry.name].join('/'),
          },
        }))
    : [];

  return [...weaponAssetPaths, ...artifactAssetPaths];
}

/**
 * Resolves and validates the file requested by the item asset catch-all route.
 *
 * @param assetParam Route parameter shaped as weapons/type/file or artifacts/file.
 * @returns Absolute file path when valid, otherwise null.
 */
export function resolveItemAssetFileFromRoute(assetParam?: string) {
  const parts = assetParam?.split('/').filter(Boolean) ?? [];

  if (parts[0] === 'weapons' && parts.length === 3) {
    const [, type, fileName] = parts;

    if (!weaponTypes.includes(type as (typeof weaponTypes)[number])) {
      return null;
    }

    const filePath = path.resolve(assetsBase, 'weapons', type, fileName);

    return fileName.endsWith('.webp') && isInsideAssets(filePath)
      ? filePath
      : null;
  }

  if (parts[0] === 'artifacts' && parts.length === 2) {
    const [, fileName] = parts;
    const filePath = path.resolve(assetsBase, 'artifacts', fileName);

    return fileName.endsWith('.webp') && isInsideAssets(filePath)
      ? filePath
      : null;
  }

  return null;
}
