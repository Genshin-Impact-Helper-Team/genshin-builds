import fs from 'node:fs';
import path from 'node:path';

export type ContentCharacter = {
  element: string;
  rarity: string;
  character: string;
  characterPath: string;
  metadataPath: string;
};

export function getContentCharacters(
  contentPath = path.resolve('src/content'),
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

              return fs.existsSync(metadataPath)
                ? [
                    {
                      element: element.name,
                      rarity: rarity.name,
                      character: character.name,
                      characterPath,
                      metadataPath,
                    },
                  ]
                : [];
            }),
        ),
    );
}

export function getCharacterBuilds(characterPath: string) {
  return fs
    .readdirSync(characterPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(characterPath, entry.name),
    }));
}
