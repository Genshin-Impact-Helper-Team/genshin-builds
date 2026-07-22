import fs from 'node:fs';
import path from 'node:path';
import { readJSONFile } from './content';

export type ContentCharacter = {
  element: string;
  rarity: string;
  character: string;
  characterPath: string;
  metadataPath: string;
};

export const PRE_AR_45_ROUTE_SEGMENT = 'pre-ar45';
type BuildMode = 'default' | typeof PRE_AR_45_ROUTE_SEGMENT;

export function isPreAr45BuildSlug(slug: string) {
  return slug === PRE_AR_45_ROUTE_SEGMENT;
}

export function getContentCharacters(
  contentPath = path.resolve('src/content'),
  includeWip = false,
): ContentCharacter[] {
  if (!fs.existsSync(contentPath)) return [];

  return fs
    .readdirSync(contentPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'site')
    .flatMap((element) =>
      fs
        .readdirSync(path.join(contentPath, element.name), {
          withFileTypes: true,
        })
        .filter((entry) => entry.isDirectory())
        .flatMap((rarity) =>
          fs
            .readdirSync(path.join(contentPath, element.name, rarity.name), {
              withFileTypes: true,
            })
            .filter((entry) => entry.isDirectory())
            .flatMap((character) => {
              const characterPath = path.join(
                contentPath,
                element.name,
                rarity.name,
                character.name,
              );
              const metadataPath = path.join(characterPath, 'metadata.json');

              if (!fs.existsSync(metadataPath)) return [];

              const isWip =
                String(readJSONFile(metadataPath)?.last_updated ?? '')
                  .trim()
                  .toUpperCase() === 'WIP';

              return isWip && !includeWip
                ? []
                : [
                    {
                      element: element.name,
                      rarity: rarity.name,
                      character: character.name,
                      characterPath,
                      metadataPath,
                    },
                  ];
            }),
        ),
    );
}

export function getCharacterBuilds(
  characterPath: string,
  mode: BuildMode = 'default',
) {
  return fs
    .readdirSync(characterPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      mode === 'default'
        ? !isPreAr45BuildSlug(entry.name)
        : isPreAr45BuildSlug(entry.name),
    )
    .map((entry) => ({
      name: entry.name,
      path: path.join(characterPath, entry.name),
    }));
}
