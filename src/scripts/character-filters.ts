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
const previewBuilds = document.querySelector<HTMLUListElement>(
  '[data-preview-builds]',
);
const previewLink = document.querySelector<HTMLAnchorElement>(
  '[data-preview-link]',
);
const lazyPortraits = Array.from(
  document.querySelectorAll<HTMLImageElement>('[data-roster-portrait-src]'),
);
const customSelects = Array.from(
  document.querySelectorAll<HTMLElement>('[data-filter-select]'),
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

  return field instanceof HTMLSelectElement || field instanceof HTMLInputElement
    ? field.value
    : '';
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
 * Gets the button that opens one custom select menu.
 *
 * @param select Custom select wrapper.
 * @returns Trigger button, or null when the markup is incomplete.
 */
function getCustomSelectTrigger(select: HTMLElement) {
  return select.querySelector<HTMLButtonElement>(
    '[data-filter-select-trigger]',
  );
}

/**
 * Gets the hidden form field that stores one custom select value.
 *
 * @param select Custom select wrapper.
 * @returns Hidden input, or null when the markup is incomplete.
 */
function getCustomSelectValue(select: HTMLElement) {
  return select.querySelector<HTMLInputElement>('[data-filter-select-value]');
}

/**
 * Gets the visible label that mirrors one custom select value.
 *
 * @param select Custom select wrapper.
 * @returns Label element, or null when the markup is incomplete.
 */
function getCustomSelectLabel(select: HTMLElement) {
  return select.querySelector<HTMLElement>('[data-filter-select-label]');
}

/**
 * Gets all selectable option buttons for one custom select.
 *
 * @param select Custom select wrapper.
 * @returns Option buttons in DOM order.
 */
function getCustomSelectOptions(select: HTMLElement) {
  return Array.from(select.querySelectorAll<HTMLButtonElement>('[data-value]'));
}

/**
 * Closes one custom select and optionally returns focus to its trigger.
 *
 * @param select Custom select wrapper.
 * @param shouldFocus Whether the trigger should receive focus after closing.
 */
function closeCustomSelect(select: HTMLElement, shouldFocus = false) {
  const trigger = getCustomSelectTrigger(select);

  select.removeAttribute('data-open');
  trigger?.setAttribute('aria-expanded', 'false');

  if (shouldFocus) {
    trigger?.focus();
  }
}

/**
 * Closes every custom select except an optional active one.
 *
 * @param except Select wrapper that should stay open.
 */
function closeCustomSelects(except?: HTMLElement) {
  customSelects.forEach((select) => {
    if (select !== except) {
      closeCustomSelect(select);
    }
  });
}

/**
 * Selects an option, updates the hidden form value, and refreshes the label.
 *
 * @param select Custom select wrapper.
 * @param option Option button to select.
 * @param shouldDispatch Whether input/change events should be emitted.
 */
function setCustomSelectOption(
  select: HTMLElement,
  option: HTMLButtonElement,
  shouldDispatch = true,
) {
  const input = getCustomSelectValue(select);
  const label = getCustomSelectLabel(select);
  const options = getCustomSelectOptions(select);

  if (!input) {
    return;
  }

  input.value = option.dataset.value ?? '';

  if (label) {
    label.textContent = option.textContent?.trim() ?? '';
  }

  options.forEach((item) => {
    item.setAttribute('aria-selected', item === option ? 'true' : 'false');
  });

  if (shouldDispatch) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Opens one custom select and optionally focuses the selected option.
 *
 * @param select Custom select wrapper.
 * @param shouldFocusOption Whether the selected option should receive focus.
 */
function openCustomSelect(select: HTMLElement, shouldFocusOption = false) {
  const trigger = getCustomSelectTrigger(select);
  const options = getCustomSelectOptions(select);
  const selectedOption =
    options.find((option) => option.getAttribute('aria-selected') === 'true') ??
    options[0];

  closeCustomSelects(select);
  select.setAttribute('data-open', 'true');
  trigger?.setAttribute('aria-expanded', 'true');

  if (shouldFocusOption) {
    selectedOption?.focus();
  }
}

/**
 * Moves keyboard focus through a custom select option list.
 *
 * @param select Custom select wrapper.
 * @param direction Positive values move forward, negative values move back.
 */
function focusCustomSelectOption(select: HTMLElement, direction: number) {
  const options = getCustomSelectOptions(select);
  const activeIndex = options.indexOf(
    document.activeElement as HTMLButtonElement,
  );
  const selectedIndex = options.findIndex(
    (option) => option.getAttribute('aria-selected') === 'true',
  );
  const baseIndex = activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0);
  const nextIndex = (baseIndex + direction + options.length) % options.length;

  options[nextIndex]?.focus();
}

/**
 * Wires all custom selects to their hidden inputs and keyboard interactions.
 */
function initializeCustomSelects() {
  customSelects.forEach((select) => {
    const trigger = getCustomSelectTrigger(select);
    const input = getCustomSelectValue(select);
    const options = getCustomSelectOptions(select);
    const selectedOption =
      options.find((option) => option.dataset.value === input?.value) ??
      options[0];

    if (!trigger || !input || !selectedOption) {
      return;
    }

    setCustomSelectOption(select, selectedOption, false);

    trigger.addEventListener('click', () => {
      if (select.hasAttribute('data-open')) {
        closeCustomSelect(select);
        return;
      }

      openCustomSelect(select);
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openCustomSelect(select, true);
      }

      if (event.key === 'Escape') {
        closeCustomSelect(select);
      }
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        setCustomSelectOption(select, option);
        closeCustomSelect(select, true);
      });

      option.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusCustomSelectOption(select, 1);
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusCustomSelectOption(select, -1);
        }

        if (event.key === 'Home') {
          event.preventDefault();
          options[0]?.focus();
        }

        if (event.key === 'End') {
          event.preventDefault();
          options[options.length - 1]?.focus();
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setCustomSelectOption(select, option);
          closeCustomSelect(select, true);
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          closeCustomSelect(select, true);
        }

        if (event.key === 'Tab') {
          closeCustomSelect(select);
        }
      });
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    const clickedInsideSelect = customSelects.some((select) =>
      select.contains(target),
    );

    if (!clickedInsideSelect) {
      closeCustomSelects();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCustomSelects();
    }
  });
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

initializeCustomSelects();
applyFilters();
initializePortraitLoading();

export {};
