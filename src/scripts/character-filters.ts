const filters = document.querySelector<HTMLFormElement>(
  '[data-character-filters]',
);
const cards = document.querySelectorAll<HTMLElement>('[data-character-card]');

/**
 * Reads one filter control value from the home page form.
 *
 * @param name Form control name.
 * @returns Current control value, or an empty string when missing.
 */
function getFilterValue(name: string) {
  const field = filters?.elements.namedItem(name);

  return field instanceof HTMLSelectElement || field instanceof HTMLInputElement
    ? field.value
    : '';
}

/**
 * Applies all selected filters to the character grid.
 *
 * Cards stay in the DOM for fast filtering; unmatched cards are hidden with the
 * native `hidden` attribute.
 */
function applyFilters() {
  const search = getFilterValue('search').trim().toLowerCase();
  const selectedElement = getFilterValue('element');
  const selectedRarity = getFilterValue('rarity');
  const selectedWeapon = getFilterValue('weapon');

  cards.forEach((card) => {
    // Dataset values are written by the Astro page when rendering each card.
    const matchesSearch =
      !search || card.dataset.name?.toLowerCase().includes(search);
    const matchesElement =
      !selectedElement || card.dataset.element === selectedElement;
    const matchesRarity =
      !selectedRarity || card.dataset.rarity === selectedRarity;
    const matchesWeapon =
      !selectedWeapon || card.dataset.weapon === selectedWeapon;

    card.hidden = !(
      matchesSearch &&
      matchesElement &&
      matchesRarity &&
      matchesWeapon
    );
  });
}

// One handler covers selects and the text search input.
filters?.addEventListener('change', applyFilters);
filters?.addEventListener('input', applyFilters);
