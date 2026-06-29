import fs from 'node:fs';
import path from 'node:path';
import { sitePath } from './paths';

type CharacterAssetKind = 'image' | 'portrait';

type CharacterAssetContext = {
  element: string;
  rarity: string;
  character: string;
};

const assetFileNames: Record<CharacterAssetKind, string> = {
  image: 'splash_art.webp',
  portrait: 'portrait.webp',
};

export function resolveCharacterAssetUrl(
  context: CharacterAssetContext,
  fallbackUrl: string | undefined,
  kind: CharacterAssetKind,
) {
  const parts = [
    'character-assets',
    context.element,
    context.rarity,
    context.character,
    assetFileNames[kind],
  ];

  return fs.existsSync(path.resolve('public', ...parts))
    ? sitePath(parts.join('/'))
    : fallbackUrl?.trim();
}
