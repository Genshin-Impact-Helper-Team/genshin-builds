import { initializeFilterSelects } from './filter-selects';

const filters = document.querySelector<HTMLFormElement>(
  '[data-artifact-filters]',
);
const cards = Array.from(
  document.querySelectorAll<HTMLElement>('[data-artifact-card]'),
);
const count = document.querySelector<HTMLElement>('[data-artifact-count]');
const emptyState = document.querySelector<HTMLElement>('[data-artifact-empty]');

function getFilterValue(name: string) {
  const field = filters?.elements.namedItem(name);

  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    return field.value;
  }

  return '';
}

function applyFilters() {
  const search = getFilterValue('search').trim().toLowerCase();
  const selectedRarity = getFilterValue('rarity');
  const selectedBonus = getFilterValue('bonus');
  let visibleCount = 0;

  cards.forEach((card) => {
    const matchesSearch =
      !search || card.dataset.name?.toLowerCase().includes(search);
    const matchesRarity =
      !selectedRarity || card.dataset.rarity === selectedRarity;
    const matchesBonus =
      !selectedBonus ||
      card.dataset.bonuses?.split(' ').includes(selectedBonus);
    const isVisible = matchesSearch && matchesRarity && matchesBonus;

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

filters?.addEventListener('change', applyFilters);
filters?.addEventListener('input', applyFilters);
filters?.addEventListener('submit', (event) => event.preventDefault());

initializeFilterSelects();
applyFilters();

export {};
