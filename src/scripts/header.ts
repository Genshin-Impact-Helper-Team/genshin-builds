const header = document.querySelector<HTMLElement>('.site-header');
const navToggle = header?.querySelector<HTMLButtonElement>('[data-nav-toggle]');
const navDropdown = header?.querySelector<HTMLDetailsElement>('.nav-dropdown');
const searchShortcutBannerDismissedStorageKey =
  'genshin-builds:search-shortcut-banner-dismissed';
const searchShortcutBannerDisabledStorageKey =
  'genshin-builds:search-shortcut-banner-disabled';

function searchShortcutBannerDismissed() {
  try {
    return (
      sessionStorage.getItem(searchShortcutBannerDismissedStorageKey) ===
        'true' ||
      localStorage.getItem(searchShortcutBannerDisabledStorageKey) === 'true'
    );
  } catch {
    return false;
  }
}

function hideDismissedSearchShortcutBanner() {
  if (!searchShortcutBannerDismissed()) return;

  document.documentElement.dataset.searchShortcutBannerDismissed = 'true';
}

/** Keeps the compact navigation and its ARIA state synchronized. */
const setNavOpen = (isOpen: boolean) => {
  header?.classList.toggle('nav-is-open', isOpen);
  navToggle?.setAttribute('aria-expanded', String(isOpen));
  navToggle?.setAttribute(
    'aria-label',
    isOpen ? 'Close navigation' : 'Open navigation',
  );

  if (!isOpen) navDropdown?.removeAttribute('open');
};

navToggle?.addEventListener('click', () => {
  setNavOpen(navToggle.getAttribute('aria-expanded') !== 'true');
});

header?.querySelectorAll<HTMLAnchorElement>('.nav-panel a').forEach((link) => {
  link.addEventListener('click', () => setNavOpen(false));
});

document.addEventListener('click', (event) => {
  if (event.target instanceof Node && !header?.contains(event.target)) {
    setNavOpen(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setNavOpen(false);
    navToggle?.focus();
  }
});

document.addEventListener(
  'click',
  (event) => {
    if (
      !(event.target instanceof Element) ||
      !event.target.closest(
        '.search-shortcut-banner [data-id="w-banner-close"]',
      )
    ) {
      return;
    }

    try {
      sessionStorage.setItem(searchShortcutBannerDismissedStorageKey, 'true');
    } catch {
      // ignore storage failure
    }
    document.documentElement.dataset.searchShortcutBannerDismissed = 'true';
  },
  true,
);

hideDismissedSearchShortcutBanner();

window.matchMedia('(min-width: 981px)').addEventListener('change', (event) => {
  if (event.matches) setNavOpen(false);
});

const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const languageSelect =
  document.querySelector<HTMLSelectElement>('#language-select');

languageSelect?.addEventListener('change', () => {
  const lang = languageSelect.value;
  const character = languageSelect.dataset.character;
  const page = languageSelect.dataset.page;
  const suffix = character
    ? `${lang}/${character}`
    : page
      ? `${lang}/${page}`
      : lang;

  window.location.href = `${baseUrl}${suffix}`;
});
