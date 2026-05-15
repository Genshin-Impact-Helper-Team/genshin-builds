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
    const trigger = target.closest<HTMLButtonElement>('.weapon-popover-trigger');

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
