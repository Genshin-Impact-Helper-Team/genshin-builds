const cards = document.querySelectorAll<HTMLElement>('.build-card');
const buildNavItems =
  document.querySelectorAll<HTMLButtonElement>('[data-build-nav]');
const buildsLayout = document.querySelector<HTMLElement>(
  '.character-builds-layout',
);

function getBuildUrl(targetId: string | null) {
  const url = new URL(window.location.href);

  if (targetId) {
    url.searchParams.set('build', targetId);
  } else {
    url.searchParams.delete('build');
  }

  return url;
}

/**
 * Opens exactly one build card by ID.
 *
 * Passing null closes every card, keeping the build query parameter and visual
 * state in sync.
 *
 * @param targetId Build slug to open, or null to close all.
 */
function openCard(targetId: string | null, updateUrl = true) {
  cards.forEach((card) => {
    const isTarget = card.dataset.id === targetId;
    const button = card.querySelector<HTMLButtonElement>('.build-header');

    card.classList.toggle('open', isTarget);
    button?.setAttribute('aria-expanded', String(isTarget));
  });

  buildNavItems.forEach((item) => {
    item.setAttribute(
      'aria-current',
      String(item.dataset.buildNav === targetId),
    );
  });

  if (updateUrl) {
    window.history.pushState({}, '', getBuildUrl(targetId));
  }
}

cards.forEach((card) => {
  const button = card.querySelector<HTMLButtonElement>('.build-header');

  if (!button) return;

  button.addEventListener('click', () => {
    const id = card.dataset.id;
    const isOpen = card.classList.contains('open');
    const newState = isOpen ? null : id;

    // Store the opened build in the URL so direct links restore the same panel.
    openCard(newState ?? null);
  });
});

buildNavItems.forEach((item) => {
  item.addEventListener('click', () => {
    openCard(item.dataset.buildNav ?? null);
  });
});

// Honor links like /en/xiangling?build=off-field-dps on first load.
const initial = new URLSearchParams(window.location.search).get('build');
const defaultBuild = buildsLayout?.dataset.defaultBuild ?? null;

openCard(initial ?? defaultBuild, false);

window.addEventListener('popstate', () => {
  const build = new URLSearchParams(window.location.search).get('build');
  openCard(build ?? defaultBuild, false);
});

export {};
