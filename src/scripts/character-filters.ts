const filters = document.querySelector<HTMLFormElement>(
  '[data-character-filters]',
);
const cards = Array.from(
  document.querySelectorAll<HTMLElement>('[data-character-card]'),
);
const count = document.querySelector<HTMLElement>('[data-character-count]');
const emptyState = document.querySelector<HTMLElement>(
  '[data-character-empty]',
);
const preview = document.querySelector<HTMLElement>('[data-character-preview]');
const previewImage = document.querySelector<HTMLImageElement>(
  '[data-preview-image]',
);
const previewName = document.querySelector<HTMLElement>('[data-preview-name]');
const previewRarity = document.querySelector<HTMLElement>(
  '[data-preview-rarity]',
);
const previewBuilds = document.querySelector<HTMLUListElement>(
  '[data-preview-builds]',
);
const previewLink = document.querySelector<HTMLAnchorElement>(
  '[data-preview-link]',
);

type BuildSummary = {
  name?: string;
};

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

function setText(element: HTMLElement | null, value: string | undefined) {
  if (element && value) {
    element.textContent = value;
  }
}

function formatTemplate(template: string | undefined, name: string) {
  return (template ?? '{name} character art').replace('{name}', name);
}

function getBuilds(card: HTMLElement) {
  try {
    const builds = JSON.parse(card.dataset.builds ?? '[]');

    return Array.isArray(builds) ? (builds as BuildSummary[]) : [];
  } catch {
    return [];
  }
}

function setBuildList(builds: BuildSummary[]) {
  if (!previewBuilds) {
    return;
  }

  previewBuilds.replaceChildren(
    ...builds.map((build) => {
      const item = document.createElement('li');
      item.textContent = build.name ?? '';

      return item;
    }),
  );
}

function setSelectedCard(card: HTMLElement | undefined) {
  if (!card) {
    cards.forEach((item) => item.setAttribute('aria-current', 'false'));
    preview?.setAttribute('hidden', '');
    return;
  }

  preview?.removeAttribute('hidden');
  cards.forEach((item) => item.setAttribute('aria-current', 'false'));
  card.setAttribute('aria-current', 'true');

  const name = card.dataset.name;
  const element = card.dataset.element;

  if (preview && element) {
    preview.className = `roster-preview ${element}`;
  }

  if (previewImage && card.dataset.image) {
    previewImage.src = card.dataset.image;
    previewImage.alt = name
      ? formatTemplate(previewImage.dataset.previewAltTemplate, name)
      : '';
  }

  if (previewLink && card.dataset.href) {
    previewLink.href = card.dataset.href;
  }

  setText(previewName, name);
  setText(previewRarity, card.dataset.rarityLabel);
  setBuildList(getBuilds(card));
}

/**
 * Applies all selected filters to the character roster.
 *
 * Cards stay in the DOM for fast filtering; unmatched cards are hidden with the
 * native `hidden` attribute.
 */
function applyFilters() {
  const search = getFilterValue('search').trim().toLowerCase();
  const selectedElement = getFilterValue('element');
  const selectedRarity = getFilterValue('rarity');
  const selectedWeapon = getFilterValue('weapon');

  let firstVisibleCard: HTMLElement | undefined;
  let visibleCount = 0;

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

    const isVisible =
      matchesSearch && matchesElement && matchesRarity && matchesWeapon;

    card.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
      firstVisibleCard ??= card;
    }
  });

  if (count) {
    count.textContent = `${visibleCount} ${count.dataset.resultsLabel ?? ''}`;
  }

  if (emptyState) {
    emptyState.hidden = visibleCount > 0;
  }

  const selectedCard = cards.find(
    (card) => card.getAttribute('aria-current') === 'true' && !card.hidden,
  );

  setSelectedCard(selectedCard ?? firstVisibleCard);
}

// One handler covers selects and the text search input.
filters?.addEventListener('change', applyFilters);
filters?.addEventListener('input', applyFilters);
filters?.addEventListener('submit', (event) => event.preventDefault());

cards.forEach((card) => {
  card.addEventListener('click', () => setSelectedCard(card));
  card.addEventListener('focus', () => setSelectedCard(card));
});

export {};
