import type { ImageMetadata } from 'astro';

type CharacterAssetKind = 'image' | 'portrait';
type CharacterAssetImage = Promise<{ default: ImageMetadata }>;

type CharacterAssetContext = {
  element: string;
  rarity: string;
  character: string;
};

const assetFileNames: Record<CharacterAssetKind, string> = {
  image: 'splash_art.webp',
  portrait: 'portrait.webp',
};

const characterImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/character-assets/**/*.webp',
);

export function resolveCharacterAssetImage(
  context: CharacterAssetContext,
  kind: CharacterAssetKind,
): CharacterAssetImage | undefined {
  const assetPath = [
    '/src/assets/character-assets',
    context.element,
    context.rarity,
    context.character,
    assetFileNames[kind],
  ].join('/');

  return characterImages[assetPath]?.();
}
