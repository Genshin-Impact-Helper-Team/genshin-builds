const cards = document.querySelectorAll<HTMLElement>('.build-card');

/**
 * Opens exactly one build card by ID.
 *
 * Passing null closes every card, keeping the build query parameter and visual
 * state in sync.
 *
 * @param targetId Build slug to open, or null to close all.
 */
function openCard(targetId: string | null) {
  cards.forEach((card) => {
    const isTarget = card.dataset.id === targetId;
    card.classList.toggle('open', isTarget);
  });
}

cards.forEach((card) => {
  const button = card.querySelector<HTMLButtonElement>('.build-header');

  if (!button) return;

  button.addEventListener('click', () => {
    const id = card.dataset.id;
    const isOpen = card.classList.contains('open');
    const newState = isOpen ? null : id;

    const url = new URL(window.location.href);

    // Store the opened build in the URL so direct links restore the same panel.
    if (newState) {
      url.searchParams.set('build', newState);
    } else {
      url.searchParams.delete('build');
    }

    window.history.pushState({}, '', url);
    openCard(newState ?? null);
  });
});

// Honor links like /en/xiangling?build=off-field-dps on first load.
const initial = new URLSearchParams(window.location.search).get('build');

if (initial) {
  openCard(initial);
}
