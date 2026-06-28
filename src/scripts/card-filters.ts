import { compareCharacterCards } from './character-sort.mjs';

type FilterKind = 'character' | 'weapon' | 'artifact';
const characterSortStorageKey = 'genshin-builds:character-sort';

const selectors = {
  character: {
    form: '[data-character-filters]',
    card: '[data-character-card]',
    count: '[data-character-count]',
    empty: '[data-character-empty]',
  },
  weapon: {
    form: '[data-weapon-filters]',
    card: '[data-weapon-card]',
    count: '[data-weapon-count]',
    empty: '[data-weapon-empty]',
  },
  artifact: {
    form: '[data-artifact-filters]',
    card: '[data-artifact-card]',
    count: '[data-artifact-count]',
    empty: '[data-artifact-empty]',
  },
} as const;

const kind = (Object.keys(selectors) as FilterKind[]).find((candidate) =>
  document.querySelector(selectors[candidate].form),
);

if (kind) {
  const selector = selectors[kind];
  const form = document.querySelector<HTMLFormElement>(selector.form);
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(selector.card),
  );
  const count = document.querySelector<HTMLElement>(selector.count);
  const empty = document.querySelector<HTMLElement>(selector.empty);
  const sortSelect =
    kind === 'character' ? form?.elements.namedItem('sort') : null;

  if (sortSelect instanceof HTMLSelectElement) {
    try {
      const savedSort = localStorage.getItem(characterSortStorageKey);
      if (
        savedSort &&
        [...sortSelect.options].some((option) => option.value === savedSort)
      ) {
        sortSelect.value = savedSort;
      }
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }

    sortSelect.addEventListener('change', () => {
      try {
        localStorage.setItem(characterSortStorageKey, sortSelect.value);
      } catch {
        // Sorting still works for the current visit without persistence.
      }
    });
  }

  const applyFilters = () => {
    if (!form) return;

    const values = Object.fromEntries(new FormData(form));
    const search = String(values.search ?? '')
      .trim()
      .toLowerCase();
    let visibleCount = 0;

    if (kind === 'character') {
      cards[0]?.parentElement?.append(
        ...[...cards].sort((left, right) =>
          compareCharacterCards(left, right, String(values.sort ?? 'element')),
        ),
      );
    }

    cards.forEach((card) => {
      const matches = Object.entries(values).every(([name, value]) => {
        const selected = String(value);
        if (!selected || name === 'search' || name === 'sort') return true;

        const key =
          name === 'updated'
            ? 'recentUpdated'
            : name === 'bonus'
              ? 'bonuses'
              : name;
        const cardValue = card.dataset[key] ?? '';
        return name === 'bonus'
          ? cardValue.split(' ').includes(selected)
          : cardValue === selected;
      });
      const visible =
        matches &&
        (!search || card.dataset.name?.toLowerCase().includes(search));

      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (count) {
      count.textContent = `${visibleCount} ${count.dataset.resultsLabel ?? ''}`;
    }
    if (empty) empty.hidden = visibleCount > 0;
  };

  form?.addEventListener('change', applyFilters);
  form?.addEventListener('input', applyFilters);
  form?.addEventListener('submit', (event) => event.preventDefault());
  if (sortSelect instanceof HTMLSelectElement) {
    sortSelect.addEventListener('change', applyFilters);
  }
  applyFilters();
}

document
  .querySelector<HTMLElement>('[data-weapon-browser]')
  ?.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-weapon-refinement]')
        : null;
    const refinement = button?.dataset.weaponRefinement;
    const card = button?.closest<HTMLElement>('[data-weapon-card]');
    if (!button || !refinement || !card) return;

    card
      .querySelectorAll<HTMLElement>('[data-weapon-refinement]')
      .forEach((item) =>
        item.setAttribute(
          'aria-selected',
          String(item.dataset.weaponRefinement === refinement),
        ),
      );
    card
      .querySelectorAll<HTMLElement>('[data-weapon-refinement-panel]')
      .forEach((panel) => {
        panel.hidden = panel.dataset.weaponRefinementPanel !== refinement;
      });
  });
