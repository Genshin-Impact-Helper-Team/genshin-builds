const trigger = document.querySelector<HTMLButtonElement>(
    '[data-artifact-set-picker-trigger]',
);
const dialog = document.querySelector<HTMLDialogElement>(
    '[data-artifact-set-picker]',
);
const searchForm = document.querySelector<HTMLFormElement>(
    '#artifact-set-search-filters',
);
const search = searchForm?.querySelector<HTMLInputElement>('input[name="search"]');
const closeButton = document.querySelector<HTMLButtonElement>(
    '[data-close-artifact-picker]',
);
const choices = [...document.querySelectorAll<HTMLButtonElement>(
    '[data-artifact-set-choice]',
)];
const results = [...document.querySelectorAll<HTMLElement>(
    '[data-artifact-set-result]',
)];
const emptyState = document.querySelector<HTMLElement>(
    '[data-artifact-stats-empty]',
);
const noResults = document.querySelector<HTMLElement>(
    '[data-artifact-stats-no-results]',
);

function filterChoices() {
    const query = search?.value.trim().toLocaleLowerCase() ?? '';
    let matches = 0;

    for (const choice of choices) {
        choice.hidden = !choice.dataset.artifactSetName
            ?.toLocaleLowerCase()
            .includes(query);
        if (!choice.hidden) matches += 1;
    }

    if (noResults) noResults.hidden = !query || matches > 0;
}

search?.addEventListener('input', filterChoices);
searchForm?.addEventListener('submit', (event) => event.preventDefault());

trigger?.addEventListener('click', () => {
    if (!dialog) return;
    if (search) search.value = '';
    filterChoices();
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    search?.focus();
});

closeButton?.addEventListener('click', () => dialog?.close());
dialog?.addEventListener('close', () => {
    trigger?.setAttribute('aria-expanded', 'false');
});

dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
});

for (const choice of choices) {
    choice.addEventListener('click', () => {
        const selected = choice.dataset.artifactSetChoice;
        if (!selected) return;

        for (const result of results) {
            result.hidden = result.dataset.artifactSetResult !== selected;
        }
        for (const option of choices) {
            option.setAttribute('aria-pressed', String(option === choice));
        }
        if (emptyState) emptyState.hidden = true;
        dialog?.close();
        trigger?.focus();
    });
}
