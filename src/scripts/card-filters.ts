import { compareCharacterCards } from './character-sort.mjs';

type FilterKind = 'character' | 'weapon' | 'artifact';
const sortStorageKeys = {
    character: 'genshin-builds:character-sort',
    weapon: 'genshin-builds:weapon-sort',
    artifact: 'genshin-builds:artifact-sort',
} as const;
const highPriorityImageCount = 4;

const selectors = {
    character: {
        form: '[data-character-filters]',
        card: '[data-character-card]',
        count: '[data-character-count]',
        empty: '[data-character-empty]',
    },
    weapon: {
        form: '[data-weapon-filters]',
        card: '[data-weapon-card]',
        count: '[data-weapon-count]',
        empty: '[data-weapon-empty]',
    },
    artifact: {
        form: '[data-artifact-filters]',
        card: '[data-artifact-card]',
        count: '[data-artifact-count]',
        empty: '[data-artifact-empty]',
    },
} as const;

const kind = (Object.keys(selectors) as FilterKind[]).find((candidate) =>
    document.querySelector(selectors[candidate].form),
);

const cardValue = (card: HTMLElement, name: string) => card.dataset[name] ?? '';

function compareCatalogCards(
    left: HTMLElement,
    right: HTMLElement,
    sort: string,
) {
    const byName = cardValue(left, 'name').localeCompare(cardValue(right, 'name'));

    if (sort === 'release') {
        return (
            Number.parseFloat(cardValue(right, 'versionReleased')) -
            Number.parseFloat(cardValue(left, 'versionReleased')) || byName
        );
    }

    return byName;
}

if (kind) {
    const selector = selectors[kind];
    const form = document.querySelector<HTMLFormElement>(selector.form);
    const cards = Array.from(
        document.querySelectorAll<HTMLElement>(selector.card),
    );
    const count = document.querySelector<HTMLElement>(selector.count);
    const empty = document.querySelector<HTMLElement>(selector.empty);
    const sortSelect = form?.elements.namedItem('sort');
    const sortStorageKey = sortStorageKeys[kind];

    const getElementYPosition = (element: HTMLElement) => {
        let currentElement: HTMLElement | null = element;
        let elementYPosition = 0;

        while (currentElement) {
            elementYPosition += currentElement.offsetTop;
            currentElement = currentElement.offsetParent as HTMLElement | null;
        }

        return elementYPosition;
    };

    const updateVisibleImageLoading = () => {
        const orderedCards = cards[0]?.parentElement
            ? Array.from(
                cards[0].parentElement.querySelectorAll<HTMLElement>(selector.card),
            )
            : cards;
        let highPriorityCount = 0;

        orderedCards.forEach((card) => {
            const image = card.querySelector<HTMLImageElement>('img');
            if (!image) return;

            const isAboveFold =
                !card.hidden && getElementYPosition(image) <= window.innerHeight;

            image.setAttribute('loading', isAboveFold ? 'eager' : 'lazy');
            if (isAboveFold && highPriorityCount < highPriorityImageCount) {
                image.setAttribute('fetchpriority', 'high');
                highPriorityCount += 1;
            } else {
                image.removeAttribute('fetchpriority');
            }
        });
    };

    if (sortSelect instanceof HTMLSelectElement) {
        try {
            const savedSort = localStorage.getItem(sortStorageKey);
            if (
                savedSort &&
                [...sortSelect.options].some((option) => option.value === savedSort)
            ) {
                sortSelect.value = savedSort;
            }
        } catch {
            // Storage can be unavailable in private or restricted browser contexts.
        }

        sortSelect.addEventListener('change', () => {
            try {
                localStorage.setItem(sortStorageKey, sortSelect.value);
            } catch {
                // Sorting still works for the current visit without persistence.
            }
        });
    }

    const applyFilters = () => {
        if (!form) return;

        const values = Object.fromEntries(new FormData(form));
        const search = String(values.search ?? '')
            .trim()
            .toLowerCase();
        let visibleCount = 0;

        if (sortSelect instanceof HTMLSelectElement) {
            const sort = String(values.sort ?? sortSelect.value);

            cards[0]?.parentElement?.append(
                ...[...cards].sort((left, right) =>
                    kind === 'character'
                        ? compareCharacterCards(left, right, sort)
                        : compareCatalogCards(left, right, sort),
                ),
            );
        }

        cards.forEach((card) => {
            const matches = Object.entries(values).every(([name, value]) => {
                const selected = String(value);
                if (!selected || name === 'search' || name === 'sort') return true;

                const key = name === 'updated' ? 'recentUpdated' : name;
                const cardValue = card.dataset[key] ?? '';
                return name === 'tagGroups'
                    ? cardValue.split(' ').includes(selected)
                    : cardValue === selected;
            });
            const visible =
                matches &&
                (!search || card.dataset.name?.toLowerCase().includes(search));

            card.hidden = !visible;
            if (visible) visibleCount += 1;
        });

        if (count) {
            count.textContent = `${visibleCount} ${count.dataset.resultsLabel ?? ''}`;
        }
        if (empty) empty.hidden = visibleCount > 0;
        updateVisibleImageLoading();
    };

    form?.addEventListener('change', applyFilters);
    form?.addEventListener('input', applyFilters);
    form?.addEventListener('submit', (event) => event.preventDefault());
    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.addEventListener('change', applyFilters);
    }
    window.addEventListener('resize', updateVisibleImageLoading);
    applyFilters();
}

document
    .querySelector<HTMLElement>('[data-weapon-browser]')
    ?.addEventListener('click', (event) => {
        const button =
            event.target instanceof Element
                ? event.target.closest<HTMLButtonElement>('[data-weapon-refinement]')
                : null;
        const refinement = button?.dataset.weaponRefinement;
        const card = button?.closest<HTMLElement>('[data-weapon-card]');
        if (!button || !refinement || !card) return;

        card
            .querySelectorAll<HTMLElement>('[data-weapon-refinement]')
            .forEach((item) =>
                item.setAttribute(
                    'aria-pressed',
                    String(item.dataset.weaponRefinement === refinement),
                ),
            );
        card
            .querySelectorAll<HTMLElement>('[data-weapon-refinement-panel]')
            .forEach((panel) => {
                panel.hidden = panel.dataset.weaponRefinementPanel !== refinement;
            });
    });
