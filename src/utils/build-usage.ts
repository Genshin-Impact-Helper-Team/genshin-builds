import {
  getPublicCharacterName,
  getPublicCharacterSlug,
} from './character-slugs';
import { loadJSON } from './content';
import { getCharacterBuilds, getContentCharacters } from './content-tree';
import { localizedPath } from './paths';

export type BuildUsage = {
  characterName: string;
  characterRarity: string;
  href: string;
  rank?: number;
};

type BuildUsageItem = {
  id: string | null;
  rank?: number;
};

export function getBestBuildUsage(
  locale: any,
  lang: string,
  getItems: (buildPath: string) => BuildUsageItem[],
) {
  const usageByItem = new Map<string, BuildUsage[]>();

  for (const character of getContentCharacters()) {
    const characterName = getPublicCharacterName(locale, character);
    const characterHref = localizedPath(
      lang,
      getPublicCharacterSlug(character),
    );

    for (const build of getCharacterBuilds(character.characterPath)) {
      if (loadJSON(build.path, 'build-notes.json')?.best !== true) continue;

      const href = `${characterHref}?build=${encodeURIComponent(build.name)}`;

      for (const { id, rank } of getItems(build.path)) {
        if (!id) continue;

        const usage = usageByItem.get(id) ?? [];
        const existing = usage.find((item) =>
          item.href.startsWith(`${characterHref}?`),
        );

        if (!existing) {
          usage.push({
            characterName,
            characterRarity: character.rarity,
            href,
            rank,
          });
        } else if (
          rank !== undefined &&
          (existing.rank === undefined || rank < existing.rank)
        ) {
          Object.assign(existing, { href, rank });
        }

        usageByItem.set(id, usage);
      }
    }
  }

  for (const usage of usageByItem.values()) {
    usage.sort((a, b) => a.characterName.localeCompare(b.characterName));
  }

  return usageByItem;
}
