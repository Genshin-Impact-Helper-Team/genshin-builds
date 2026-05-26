const header = document.querySelector<HTMLElement>('.site-header');
const openButton =
  document.querySelector<HTMLButtonElement>('[data-menu-open]');
const closeButtons =
  document.querySelectorAll<HTMLElement>('[data-menu-close]');

/**
 * Opens or closes the side menu and keeps ARIA state synchronized.
 */
const setMenuOpen = (isOpen: boolean) => {
  header?.classList.toggle('menu-is-open', isOpen);
  openButton?.setAttribute('aria-expanded', String(isOpen));
};

openButton?.addEventListener('click', () => {
  const isOpen = openButton.getAttribute('aria-expanded') === 'true';
  setMenuOpen(!isOpen);
});

closeButtons.forEach((button) => {
  button.addEventListener('click', () => setMenuOpen(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setMenuOpen(false);
  }
});

document
  .querySelectorAll<HTMLDetailsElement>('.side-menu details')
  .forEach((details) => {
    details.addEventListener('toggle', () => {
      if (!details.open) return;

      details.parentElement
        ?.querySelectorAll<HTMLDetailsElement>(':scope > details')
        .forEach((sibling) => {
          if (sibling !== details) {
            sibling.removeAttribute('open');
          }
        });
    });
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
