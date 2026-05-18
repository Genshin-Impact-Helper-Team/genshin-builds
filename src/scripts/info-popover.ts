const infoPopoverWindow = window as typeof window & {
    __infoPopoversReady?: boolean;
};

if (!infoPopoverWindow.__infoPopoversReady) {
    infoPopoverWindow.__infoPopoversReady = true;

    const VIEWPORT_PADDING = 8;
    const POPOVER_GAP = 8;

    /**
     * Keeps a coordinate inside a min/max viewport range.
     */
    const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max);

    /**
     * Updates a popover trigger's expanded state.
     */
    const setTriggerExpanded = (popover: HTMLElement, isExpanded: boolean) => {
        popover
            .querySelector<HTMLElement>('.info-popover-trigger')
            ?.setAttribute('aria-expanded', String(isExpanded));
    };

    /**
     * Finds the popover wrapper for an event target.
     */
    const getClosestPopover = (target: EventTarget | null) =>
        target instanceof HTMLElement
            ? target.closest<HTMLElement>('.info-popover')
            : null;

    /**
     * Checks whether an event happened inside a popover card.
     */
    const isInsidePopoverCard = (target: EventTarget | null) =>
        target instanceof HTMLElement
            ? target.closest<HTMLElement>('.info-popover-card') !== null
            : false;

    /**
     * Positions a popover card so it remains fully inside the viewport.
     */
    const positionPopoverCard = (popover: HTMLElement) => {
        const trigger = popover.querySelector<HTMLElement>('.info-popover-trigger');
        const card = popover.querySelector<HTMLElement>('.info-popover-card');

        if (!trigger || !card) return;

        const previousDisplay = card.style.display;
        const previousVisibility = card.style.visibility;

        card.style.display = 'block';
        card.style.visibility = 'hidden';

        const triggerRect = trigger.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const maxLeft = window.innerWidth - cardRect.width - VIEWPORT_PADDING;
        const maxTop = window.innerHeight - cardRect.height - VIEWPORT_PADDING;
        const alignedLeft = triggerRect.left;
        const topPlacement = triggerRect.top - cardRect.height - POPOVER_GAP;
        const bottomPlacement = triggerRect.bottom + POPOVER_GAP;
        const hasRoomAbove = topPlacement >= VIEWPORT_PADDING;
        const hasRoomBelow = bottomPlacement + cardRect.height <= window.innerHeight - VIEWPORT_PADDING;
        const preferredTop = hasRoomAbove || !hasRoomBelow ? topPlacement : bottomPlacement;

        card.style.left = `${clamp(alignedLeft, VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, maxLeft))}px`;
        card.style.top = `${clamp(preferredTop, VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, maxTop))}px`;
        card.style.display = previousDisplay;
        card.style.visibility = previousVisibility;
    };

    /**
     * Repositions every popover that is currently visible or interactive.
     */
    const positionActivePopovers = () => {
        document
            .querySelectorAll<HTMLElement>(
                '.info-popover:hover, .info-popover:focus-within, .info-popover.is-open',
            )
            .forEach(positionPopoverCard);
    };

    /**
     * Closes open popovers except for the one currently being interacted with.
     */
    const closeInfoPopovers = (except?: HTMLElement) => {
        document.querySelectorAll<HTMLElement>('.info-popover.is-open').forEach((popover) => {
            if (popover !== except) {
                popover.classList.remove('is-open');
                setTriggerExpanded(popover, false);
            }
        });

        document.body.classList.toggle(
            'info-popover-locked',
            document.querySelector('.info-popover.is-open') !== null,
        );
    };

    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const trigger = target.closest('.info-popover-trigger');
        const card = target.closest('.info-popover-card');

        if (card) {
            return;
        }

        if (!trigger) {
            closeInfoPopovers();
            return;
        }

        const popover = getClosestPopover(trigger);
        if (!popover) return;

        const isOpen = popover.classList.toggle('is-open');
        setTriggerExpanded(popover, isOpen);
        if (isOpen) {
            positionPopoverCard(popover);
        }
        closeInfoPopovers(popover);
    });

    document.addEventListener('pointerover', (event) => {
        const popover = getClosestPopover(event.target);

        if (popover) {
            positionPopoverCard(popover);
        }
    });

    document.addEventListener('focusin', (event) => {
        const popover = getClosestPopover(event.target);

        if (popover && !document.body.classList.contains('info-popover-locked')) {
            positionPopoverCard(popover);
            closeInfoPopovers(popover);
        }
    });

    window.addEventListener('resize', positionActivePopovers);
    window.addEventListener(
        'scroll',
        (event) => {
            if (!isInsidePopoverCard(event.target)) {
                positionActivePopovers();
            }
        },
        true,
    );

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeInfoPopovers();
        }
    });

    document.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest(
            '.weapon-popover-refinement-button',
        ) as HTMLElement | null;

        if (!button) return;

        const card = button.closest('.info-popover-card');

        if (!card) return;

        const refinement = button.dataset.refinement;

        if (!refinement) return;

        card.querySelectorAll('.weapon-popover-refinement-button').forEach((item) => {
            item.setAttribute('aria-selected', String(item === button));
        });

        card.querySelectorAll('.weapon-popover-passive-refinement').forEach((panel) => {
            (panel as HTMLElement).hidden =
                (panel as HTMLElement).dataset.refinementPanel !== refinement;
        });

        const popover = button.closest<HTMLElement>('.info-popover');

        if (popover) {
            positionPopoverCard(popover);
        }
    });
}
