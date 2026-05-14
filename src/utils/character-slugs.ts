const TRAVELER_SLUG = 'traveler';

type CharacterSlugParts = {
  character: string;
  element?: string;
};

/**
 * Converts content folder names into public URL slugs.
 *
 * Traveler is the only character with one folder per element, so their public
 * slug includes the element to keep each page addressable.
 */
export function getPublicCharacterSlug({
  character,
  element,
}: CharacterSlugParts) {
  if (character === TRAVELER_SLUG && element) {
    return `${element}-${TRAVELER_SLUG}`;
  }

  return character;
}

/**
 * Converts a public URL slug back into the content folder lookup parts.
 */
export function parsePublicCharacterSlug(slug: string): CharacterSlugParts {
  const normalizedSlug = slug.toLowerCase();

  if (normalizedSlug.endsWith(`-${TRAVELER_SLUG}`)) {
    return {
      character: TRAVELER_SLUG,
      element: normalizedSlug.slice(0, -`-${TRAVELER_SLUG}`.length),
    };
  }

  return { character: normalizedSlug };
}

/**
 * Builds the display name that matches a public character slug.
 */
export function getPublicCharacterName(
  locale: any,
  { character, element }: CharacterSlugParts,
) {
  const characterName = locale?.character?.[character] ?? character;

  if (character === TRAVELER_SLUG && element) {
    const elementName = locale?.element?.[element] ?? element;
    return `${elementName} ${characterName}`;
  }

  return characterName;
}
