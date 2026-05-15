const weaponPopoverWindow = window as typeof window & {
    __weaponPopoversReady?: boolean;
};

if (!weaponPopoverWindow.__weaponPopoversReady) {
    weaponPopoverWindow.__weaponPopoversReady = true;

    const closeWeaponPopovers = (except?: HTMLElement) => {
        document.querySelectorAll<HTMLElement>('.weapon-popover.is-open').forEach((popover) => {
            if (popover !== except) {
                popover.classList.remove('is-open');
                popover
                    .querySelector<HTMLButtonElement>('.weapon-popover-trigger')
                    ?.setAttribute('aria-expanded', 'false');
            }
        });

        document.body.classList.toggle(
            'weapon-popover-locked',
            document.querySelector('.weapon-popover.is-open') !== null,
        );
    };

    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const trigger = target.closest('.weapon-popover-trigger');
        const card = target.closest('.weapon-popover-card');

        if (card) {
            return;
        }

        if (!trigger) {
            closeWeaponPopovers();
            return;
        }

        const popover = trigger.closest<HTMLElement>('.weapon-popover');
        if (!popover) return;

        const isOpen = popover.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', String(isOpen));
        closeWeaponPopovers(popover);
    });

    document.addEventListener('focusin', (event) => {
        const target = event.target as HTMLElement;
        const popover = target.closest<HTMLElement>('.weapon-popover');

        if (popover && !document.body.classList.contains('weapon-popover-locked')) {
            closeWeaponPopovers(popover);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeWeaponPopovers();
        }
    });
}

document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest(
        '.weapon-popover-refinement-button',
    ) as HTMLElement | null;

    if (!button) return;

    const card = button.closest('.weapon-popover-card');

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
});