import fs from 'node:fs';
import path from 'node:path';
import { sitePath } from './paths';

const weaponTypes = [
  'bow',
  'catalyst',
  'claymore',
  'polearm',
  'sword',
] as const;

function publicAssetUrl(...parts: string[]) {
  return fs.existsSync(path.resolve('public', 'item-assets', ...parts))
    ? sitePath(['item-assets', ...parts].join('/'))
    : '';
}

export function resolveWeaponAssetUrl(type: string, id: string) {
  return publicAssetUrl('weapons', type, `${id}.webp`);
}

export function resolveWeaponAssetUrlById(id: string) {
  const type = weaponTypes.find((weaponType) =>
    fs.existsSync(
      path.resolve(
        'public',
        'item-assets',
        'weapons',
        weaponType,
        `${id}.webp`,
      ),
    ),
  );

  return type ? resolveWeaponAssetUrl(type, id) : '';
}

export function resolveArtifactAssetUrl(id: string) {
  return publicAssetUrl('artifacts', `${id}.webp`);
}
