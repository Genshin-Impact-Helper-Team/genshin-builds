const panels = Array.from(
  document.querySelectorAll<HTMLElement>('[data-build-panel]'),
);
const buildButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-build-tab]'),
);
const calculationPanels = Array.from(
  document.querySelectorAll<HTMLElement>('[data-build-calculation-panel]'),
);
const buildsLayout = document.querySelector<HTMLElement>(
  '.character-builds-layout',
);

const availableBuildIds = new Set(
  panels
    .map((panel) => panel.dataset.id)
    .filter((id): id is string => Boolean(id)),
);

const layoutDefaultBuild = buildsLayout?.dataset.defaultBuild;
const defaultBuild =
  layoutDefaultBuild && availableBuildIds.has(layoutDefaultBuild)
    ? layoutDefaultBuild
    : panels[0]?.dataset.id;

function getBuildUrl(targetId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('build', targetId);

  return url;
}

/**
 * Finds a valid build id, falling back to the default build when needed.
 */
function normalizeBuildId(targetId: string | null) {
  if (targetId && availableBuildIds.has(targetId)) {
    return targetId;
  }

  return defaultBuild ?? null;
}

/**
 * Selects exactly one build panel and marks the matching side button as active.
 */
function selectBuild(targetId: string | null, updateUrl = true) {
  const activeId = normalizeBuildId(targetId);

  if (!activeId) {
    return;
  }

  panels.forEach((panel) => {
    const isActive = panel.dataset.id === activeId;

    panel.classList.toggle('open', isActive);
    panel.hidden = !isActive;
    panel.setAttribute('aria-hidden', String(!isActive));
  });

  buildButtons.forEach((button) => {
    const isActive = button.dataset.id === activeId;

    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  calculationPanels.forEach((panel) => {
    const isActive = panel.dataset.id === activeId;

    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
    panel.setAttribute('aria-hidden', String(!isActive));
  });

  if (updateUrl) {
    window.history.pushState({}, '', getBuildUrl(activeId));
  }
}

buildButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectBuild(button.dataset.id ?? null);
  });
});

// Honor links like /en/xiangling?build=off-field-dps on first load.
const initial = new URLSearchParams(window.location.search).get('build');

selectBuild(initial ?? defaultBuild ?? null, false);

window.addEventListener('popstate', () => {
  const build = new URLSearchParams(window.location.search).get('build');
  selectBuild(build ?? defaultBuild ?? null, false);
});

export {};
