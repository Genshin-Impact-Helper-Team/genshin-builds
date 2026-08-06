import type { ImageMetadata } from 'astro';

export type AssetImage = Promise<{ default: ImageMetadata }>;

const weaponTypes = [
  'bow',
  'catalyst',
  'claymore',
  'polearm',
  'sword',
] as const;

const itemImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/item-assets/**/*.webp',
);
const itemUrls = import.meta.glob<string>('/src/assets/item-assets/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

function assetPath(...parts: string[]) {
  return ['/src/assets/item-assets', ...parts].join('/');
}

function assetImage(...parts: string[]) {
  return itemImages[assetPath(...parts)]?.() ?? '';
}

function assetUrl(...parts: string[]) {
  return itemUrls[assetPath(...parts)] ?? '';
}

export function resolveWeaponAssetImage(type: string, id: string) {
  return assetImage('weapons', type, `${id}.webp`);
}

function weaponAssetUrl(type: string, id: string) {
  return assetUrl('weapons', type, `${id}.webp`);
}

export function resolveWeaponAssetUrlById(id: string) {
  const type = weaponTypes.find(
    (weaponType) => itemUrls[assetPath('weapons', weaponType, `${id}.webp`)],
  );

  return type ? weaponAssetUrl(type, id) : '';
}

export function resolveArtifactAssetImage(id: string) {
  return assetImage('artifacts', `${id}.webp`);
}

export function resolveArtifactAssetUrl(id: string) {
  return assetUrl('artifacts', `${id}.webp`);
}
