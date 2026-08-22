import fs from 'node:fs';
import path from 'node:path';
import { normalizeVersion, readJSONFile } from './content';

export type ContentCharacter = {
  element: string;
  rarity: string;
  character: string;
  characterPath: string;
  metadataPath: string;
};

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

              const metadata = readJSONFile(metadataPath);
              const defaultLastUpdated = normalizeVersion(
                metadata?.last_updated,
              );
              const buildLastUpdatedValues = getCharacterBuilds(
                characterPath,
              ).map((build) => {
                const buildNotesPath = path.join(
                  build.path,
                  'build-notes.json',
                );
                const buildNotes = fs.existsSync(buildNotesPath)
                  ? readJSONFile(buildNotesPath)
                  : null;

                return (
                  normalizeVersion(buildNotes?.last_updated) ||
                  defaultLastUpdated
                );
              });
              const lastUpdatedValues =
                buildLastUpdatedValues.length > 0
                  ? buildLastUpdatedValues
                  : [defaultLastUpdated];
              const isWip = lastUpdatedValues.every(
                (lastUpdated) => lastUpdated.toUpperCase() === 'WIP',
              );

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

export function getCharacterBuilds(characterPath: string) {
  return fs
    .readdirSync(characterPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(characterPath, entry.name),
    }));
}
