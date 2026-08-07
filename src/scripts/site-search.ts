import { modal, type ModalInstance } from 'webcoreui';

const MODAL_SELECTOR = '#site-search-modal';
const OPEN_SELECTOR = `.speed-dial a[href="${MODAL_SELECTOR}"]`;
const BANNER_TOGGLE_SELECTOR = '[data-search-banner-toggle]';
const searchShortcutBannerDismissedStorageKey =
  'genshin-builds:search-shortcut-banner-dismissed';
const searchShortcutBannerDisabledStorageKey =
  'genshin-builds:search-shortcut-banner-disabled';

let searchModal: ModalInstance | undefined;
let boundModal: Element | null = null;

function getSearchModal() {
  const modalElement = document.querySelector(MODAL_SELECTOR);
  if (!modalElement) return undefined;

  if (modalElement !== boundModal) {
    searchModal?.remove();
    searchModal = modal(MODAL_SELECTOR);
    boundModal = modalElement;
  }

  return searchModal;
}

function focusSearch() {
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(
      `${MODAL_SELECTOR} .pf-searchbox-input`,
    );
    input?.focus();
  });
}

function isTypingTarget(target: EventTarget | null) {
  const searchModalElement = document.querySelector(MODAL_SELECTOR);
  if (
    target instanceof HTMLElement &&
    searchModalElement?.contains(target) &&
    !searchModalElement.getAttribute('data-show')
  ) {
    return false;
  }

  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
}

function openSearch() {
  getSearchModal()?.open();
  focusSearch();
}

function searchShortcutBannerDisabled() {
  try {
    return (
      localStorage.getItem(searchShortcutBannerDisabledStorageKey) === 'true'
    );
  } catch {
    return false;
  }
}

function setSearchShortcutBannerDisabled(disabled: boolean) {
  try {
    if (disabled) {
      localStorage.setItem(searchShortcutBannerDisabledStorageKey, 'true');
    } else {
      localStorage.removeItem(searchShortcutBannerDisabledStorageKey);
      sessionStorage.removeItem(searchShortcutBannerDismissedStorageKey);
    }
  } catch {
    // Ignore storage faliure
  }

  if (disabled) {
    document.documentElement.dataset.searchShortcutBannerDismissed = 'true';
  } else {
    delete document.documentElement.dataset.searchShortcutBannerDismissed;
  }
}

function bindSiteSearch() {
  getSearchModal();

  const bannerToggle = document.querySelector<HTMLInputElement>(
    BANNER_TOGGLE_SELECTOR,
  );
  if (bannerToggle) {
    bannerToggle.checked = searchShortcutBannerDisabled();

    if (bannerToggle.dataset.searchBannerToggleBound !== 'true') {
      bannerToggle.dataset.searchBannerToggleBound = 'true';
      bannerToggle.addEventListener('change', () => {
        setSearchShortcutBannerDisabled(bannerToggle.checked);
      });
    }
  }

  document.querySelectorAll<HTMLElement>(OPEN_SELECTOR).forEach((target) => {
    if (target.dataset.searchOpenBound === 'true') return;

    target.dataset.searchOpenBound = 'true';
    target.setAttribute('aria-label', 'Open character search');
    target.setAttribute('title', 'Search');
    target.addEventListener('click', (event) => {
      event.preventDefault();
      openSearch();
    });
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || isTypingTarget(event.target)) return;
  event.preventDefault();
  openSearch();
});

document.addEventListener('astro:after-swap', bindSiteSearch);
bindSiteSearch();
