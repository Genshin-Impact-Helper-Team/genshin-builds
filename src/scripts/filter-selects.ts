let initialized = false;

function getOptions(select: HTMLSelectElement) {
  return Array.from(select.options);
}

function closeSelect(container: HTMLElement) {
  const button = container.querySelector<HTMLElement>('[data-filter-select]');
  const list = container.querySelector<HTMLElement>('[data-filter-options]');

  container.classList.remove('select-is-open');
  button?.setAttribute('aria-expanded', 'false');
  list?.setAttribute('hidden', '');
}

function closeOtherSelects(currentContainer?: HTMLElement) {
  document
    .querySelectorAll<HTMLElement>('.home-select-filter.select-is-open')
    .forEach((container) => {
      if (container !== currentContainer) {
        closeSelect(container);
      }
    });
}

function focusOption(options: HTMLElement[], index: number) {
  options[Math.max(0, Math.min(index, options.length - 1))]?.focus();
}

function updateCustomSelect(select: HTMLSelectElement, container: HTMLElement) {
  const button = container.querySelector<HTMLElement>('[data-filter-select]');
  const options = Array.from(
    container.querySelectorAll<HTMLElement>('[data-filter-option]'),
  );
  const selectedOption = select.selectedOptions[0] ?? select.options[0];

  if (button && selectedOption) {
    button.textContent = selectedOption.textContent ?? '';
  }

  options.forEach((option) => {
    option.setAttribute(
      'aria-selected',
      String(option.dataset.value === select.value),
    );
  });
}

function openSelect(container: HTMLElement) {
  const button = container.querySelector<HTMLElement>('[data-filter-select]');
  const list = container.querySelector<HTMLElement>('[data-filter-options]');
  const options = Array.from(
    container.querySelectorAll<HTMLElement>('[data-filter-option]'),
  );
  const selectedIndex = options.findIndex(
    (option) => option.getAttribute('aria-selected') === 'true',
  );

  closeOtherSelects(container);
  container.classList.add('select-is-open');
  button?.setAttribute('aria-expanded', 'true');
  list?.removeAttribute('hidden');
  focusOption(options, selectedIndex >= 0 ? selectedIndex : 0);
}

function toggleSelect(container: HTMLElement) {
  if (container.classList.contains('select-is-open')) {
    closeSelect(container);
    return;
  }

  openSelect(container);
}

function chooseOption(
  select: HTMLSelectElement,
  container: HTMLElement,
  option: HTMLElement,
) {
  select.value = option.dataset.value ?? '';
  updateCustomSelect(select, container);
  closeSelect(container);
  container.querySelector<HTMLElement>('[data-filter-select]')?.focus();
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function handleButtonKeydown(event: KeyboardEvent, container: HTMLElement) {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Spacebar'].includes(event.key)) {
    return;
  }

  event.preventDefault();
  openSelect(container);
}

function handleOptionKeydown(
  event: KeyboardEvent,
  select: HTMLSelectElement,
  container: HTMLElement,
  option: HTMLElement,
) {
  const options = Array.from(
    container.querySelectorAll<HTMLElement>('[data-filter-option]'),
  );
  const index = options.indexOf(option);

  if (event.key === 'Escape') {
    event.preventDefault();
    closeSelect(container);
    container.querySelector<HTMLElement>('[data-filter-select]')?.focus();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusOption(options, index + 1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusOption(options, index - 1);
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    focusOption(options, 0);
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    focusOption(options, options.length - 1);
    return;
  }

  if (['Enter', ' ', 'Spacebar'].includes(event.key)) {
    event.preventDefault();
    chooseOption(select, container, option);
  }
}

function createCustomSelect(select: HTMLSelectElement) {
  if (select.dataset.filterSelectReady === 'true') {
    return;
  }

  const container = select.closest<HTMLElement>('.home-select-filter');

  if (!container) {
    return;
  }

  const listId = `${select.name || 'filter'}-options-${Math.random()
    .toString(36)
    .slice(2)}`;
  const button = document.createElement('button');
  const list = document.createElement('div');

  button.type = 'button';
  button.className = 'filter-select-button';
  button.dataset.filterSelect = '';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', listId);

  list.id = listId;
  list.className = 'filter-select-options';
  list.dataset.filterOptions = '';
  list.setAttribute('role', 'listbox');
  list.setAttribute('hidden', '');

  getOptions(select).forEach((nativeOption) => {
    const option = document.createElement('div');

    option.className = 'filter-select-option';
    option.dataset.filterOption = '';
    option.dataset.value = nativeOption.value;
    option.setAttribute('role', 'option');
    option.tabIndex = -1;
    option.textContent = nativeOption.textContent ?? '';
    option.addEventListener('click', () =>
      chooseOption(select, container, option),
    );
    option.addEventListener('keydown', (event) =>
      handleOptionKeydown(event, select, container, option),
    );
    list.append(option);
  });

  button.addEventListener('click', () => toggleSelect(container));
  button.addEventListener('keydown', (event) =>
    handleButtonKeydown(event, container),
  );
  select.addEventListener('change', () =>
    updateCustomSelect(select, container),
  );

  container.classList.add('is-custom-select');
  container.append(button, list);
  select.dataset.filterSelectReady = 'true';
  updateCustomSelect(select, container);
}

export function initializeFilterSelects() {
  document
    .querySelectorAll<HTMLSelectElement>('.home-native-select')
    .forEach(createCustomSelect);

  if (initialized) {
    return;
  }

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (
      target instanceof Element &&
      target.closest('.home-select-filter.select-is-open')
    ) {
      return;
    }

    closeOtherSelects();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeOtherSelects();
    }
  });

  initialized = true;
}
