import { initializeFilterSelects } from './filter-selects';

const filters = document.querySelector<HTMLFormElement>(
  '[data-character-filters]',
);
const rosterList = document.querySelector<HTMLElement>('[data-roster-list]');
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
const previewUpdated = Array.from(
  document.querySelectorAll<HTMLElement>('[data-preview-updated]'),
);
const previewUpdatedVersions = Array.from(
  document.querySelectorAll<HTMLElement>('[data-preview-updated-version]'),
);
const previewBuilds = document.querySelector<HTMLUListElement>(
  '[data-preview-builds]',
);
const previewLink = document.querySelector<HTMLAnchorElement>(
  '[data-preview-link]',
);
const lazyPortraits = Array.from(
  document.querySelectorAll<HTMLImageElement>('[data-roster-portrait-src]'),
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

  if (field instanceof HTMLInputElement && field.type === 'checkbox') {
    return field.checked ? field.value : '';
  }

  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    return field.value;
  }

  return '';
}

/**
 * Writes text into an element only when both the element and value exist.
 *
 * @param element Element to update.
 * @param value Text to write.
 */
function setText(element: HTMLElement | null, value: string | undefined) {
  if (element && value) {
    element.textContent = value;
  }
}

/**
 * Replaces a name placeholder in localized alt text templates.
 *
 * @param template Text template containing the `{name}` token.
 * @param name Character name to insert.
 * @returns Template with the character name inserted.
 */
function formatTemplate(template: string | undefined, name: string) {
  return (template ?? '{name} character art').replace('{name}', name);
}

/**
 * Attaches the real image URL to one deferred roster portrait.
 *
 * @param image Portrait image element rendered without a src.
 */
function loadPortrait(image: HTMLImageElement) {
  const src = image.dataset.rosterPortraitSrc;

  if (!src || image.currentSrc || image.getAttribute('src')) {
    return;
  }

  image.src = src;
  delete image.dataset.rosterPortraitSrc;
}

/**
 * Defers roster portrait requests until cards approach the roster scroll area.
 */
function initializePortraitLoading() {
  if (!lazyPortraits.length) {
    return;
  }

  if (!('IntersectionObserver' in window)) {
    lazyPortraits.forEach(loadPortrait);
    return;
  }

  const portraitObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const image = entry.target as HTMLImageElement;
        loadPortrait(image);
        portraitObserver.unobserve(image);
      });
    },
    {
      root: rosterList,
      rootMargin: '320px 0px',
      threshold: 0.01,
    },
  );

  lazyPortraits.forEach((image) => portraitObserver.observe(image));
}

/**
 * Parses the build summaries stored on one roster card.
 *
 * @param card Roster card containing serialized build data.
 * @returns Build summaries, or an empty list when parsing fails.
 */
function getBuilds(card: HTMLElement) {
  try {
    const builds = JSON.parse(card.dataset.builds ?? '[]');

    return Array.isArray(builds) ? (builds as BuildSummary[]) : [];
  } catch {
    return [];
  }
}

/**
 * Replaces the preview build list with the selected character's builds.
 *
 * @param builds Build summaries to render.
 */
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

/**
 * Marks one roster card as selected and syncs the preview panel.
 *
 * @param card Roster card to select, or undefined to hide the preview.
 */
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

  const lastUpdated = card.dataset.lastUpdated;
  previewUpdated.forEach((element) => {
    element.hidden = !lastUpdated;
  });
  previewUpdatedVersions.forEach((element) => {
    element.textContent = lastUpdated
      ? `${element.dataset.versionLabel ?? 'Version'} ${lastUpdated}`
      : '';
  });

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
  const selectedUpdated = getFilterValue('updated');

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
    const matchesUpdated =
      !selectedUpdated || card.dataset.recentUpdated === 'true';

    const isVisible =
      matchesSearch &&
      matchesElement &&
      matchesRarity &&
      matchesWeapon &&
      matchesUpdated;

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

initializeFilterSelects();
applyFilters();
initializePortraitLoading();

export {};
