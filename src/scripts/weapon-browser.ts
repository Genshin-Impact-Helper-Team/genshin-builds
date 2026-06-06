import { initializeFilterSelects } from './filter-selects';

const filters = document.querySelector<HTMLFormElement>(
  '[data-weapon-filters]',
);
const cards = Array.from(
  document.querySelectorAll<HTMLElement>('[data-weapon-card]'),
);
const count = document.querySelector<HTMLElement>('[data-weapon-count]');
const emptyState = document.querySelector<HTMLElement>('[data-weapon-empty]');
const browser = document.querySelector<HTMLElement>('[data-weapon-browser]');

function getFilterValue(name: string) {
  const field = filters?.elements.namedItem(name);

  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    return field.value;
  }

  return '';
}

function applyFilters() {
  const search = getFilterValue('search').trim().toLowerCase();
  const selectedType = getFilterValue('type');
  const selectedRarity = getFilterValue('rarity');
  const selectedSubstat = getFilterValue('substat');
  let visibleCount = 0;

  cards.forEach((card) => {
    const matchesSearch =
      !search || card.dataset.name?.toLowerCase().includes(search);
    const matchesType = !selectedType || card.dataset.type === selectedType;
    const matchesRarity =
      !selectedRarity || card.dataset.rarity === selectedRarity;
    const matchesSubstat =
      !selectedSubstat || card.dataset.substat === selectedSubstat;
    const isVisible =
      matchesSearch && matchesType && matchesRarity && matchesSubstat;

    card.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
    }
  });

  if (count) {
    count.textContent = `${visibleCount} ${count.dataset.resultsLabel ?? ''}`;
  }

  if (emptyState) {
    emptyState.hidden = visibleCount > 0;
  }
}

function selectRefinement(button: HTMLButtonElement) {
  const refinement = button.dataset.weaponRefinement;
  const card = button.closest<HTMLElement>('[data-weapon-card]');

  if (!refinement || !card) {
    return;
  }

  card
    .querySelectorAll<HTMLButtonElement>('[data-weapon-refinement]')
    .forEach((item) => {
      item.setAttribute(
        'aria-selected',
        String(item.dataset.weaponRefinement === refinement),
      );
    });

  card
    .querySelectorAll<HTMLElement>('[data-weapon-refinement-panel]')
    .forEach((panel) => {
      panel.hidden = panel.dataset.weaponRefinementPanel !== refinement;
    });
}

filters?.addEventListener('change', applyFilters);
filters?.addEventListener('input', applyFilters);
filters?.addEventListener('submit', (event) => event.preventDefault());

browser?.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest<HTMLButtonElement>('[data-weapon-refinement]');

  if (button) {
    selectRefinement(button);
  }
});

initializeFilterSelects();
applyFilters();

export {};
