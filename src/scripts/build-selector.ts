const panels = Array.from(
  document.querySelectorAll<HTMLElement>('[data-build-panel]'),
);
const tabs = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-build-tab]'),
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

  tabs.forEach((tab) => {
    const isActive = tab.dataset.id === activeId;

    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });

  if (updateUrl) {
    window.history.pushState({}, '', getBuildUrl(activeId));
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    selectBuild(tab.dataset.id ?? null);
  });

  tab.addEventListener('keydown', (event) => {
    const currentIndex = tabs.indexOf(tab);
    const lastIndex = tabs.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    }

    if (event.key === 'Home') {
      nextIndex = 0;
    }

    if (event.key === 'End') {
      nextIndex = lastIndex;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    tabs[nextIndex]?.focus();
    selectBuild(tabs[nextIndex]?.dataset.id ?? null);
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
