const infoPopoverWindow = window as typeof window & {
  __infoPopoversReady?: boolean;
};

if (!infoPopoverWindow.__infoPopoversReady) {
  infoPopoverWindow.__infoPopoversReady = true;

  const VIEWPORT_PADDING = 8;
  const POPOVER_GAP = 8;
  let ignoreNextClick = false;
  let lastTouchY = 0;
  let lockedScrollY = 0;

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

  const getOpenPopoverCard = () =>
    document.querySelector<HTMLElement>(
      '.info-popover.is-open .info-popover-card',
    );

  const hasOpenPopover = () =>
    document.querySelector('.info-popover.is-open') !== null;

  const shouldLockPageScroll = () =>
    hasOpenPopover() && window.matchMedia('(max-width: 900px)').matches;

  const lockPageScroll = () => {
    if (document.body.style.position === 'fixed') return;

    lockedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  };

  const unlockPageScroll = () => {
    if (document.body.style.position !== 'fixed') return;

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, lockedScrollY);
  };

  const syncPageScrollLock = () => {
    if (shouldLockPageScroll()) {
      lockPageScroll();
    } else {
      unlockPageScroll();
    }
  };

  const handlePopoverTouchStart = (event: TouchEvent) => {
    if (!getOpenPopoverCard()) return;

    lastTouchY = event.touches[0]?.clientY ?? 0;
  };

  const handlePopoverTouchMove = (event: TouchEvent) => {
    const card = getOpenPopoverCard();

    if (!card) return;

    const touch = event.touches[0];

    if (!touch) return;

    const target = event.target;

    if (!(target instanceof Node) || !card.contains(target)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    const currentTouchY = touch.clientY;
    const deltaY = lastTouchY - currentTouchY;
    lastTouchY = currentTouchY;
    card.scrollTop += deltaY;
  };

  /**
   * Handles opening, closing, and outside-tap behavior for popovers.
   */
  const handlePopoverToggle = (event: Event) => {
    const target = event.target as HTMLElement;
    const noteLink = target.closest('.note-link');
    const trigger = target.closest('.info-popover-trigger');
    const card = target.closest('.info-popover-card');

    if (noteLink) {
      return;
    }

    if (card) {
      return;
    }

    if (!trigger) {
      closeInfoPopovers();
      return;
    }

    event.preventDefault();

    const popover = getClosestPopover(trigger);
    if (!popover) return;

    const isOpen = popover.classList.toggle('is-open');
    setTriggerExpanded(popover, isOpen);
    if (isOpen) {
      positionPopoverCard(popover);
    }
    closeInfoPopovers(popover);
  };

  /**
   * Switches a weapon passive between refinement panels.
   */
  const handleRefinementChange = (event: Event) => {
    const button = (event.target as HTMLElement).closest(
      '.weapon-popover-refinement-button',
    ) as HTMLElement | null;

    if (!button) return;

    event.preventDefault();

    const card = button.closest('.info-popover-card');

    if (!card) return;

    const refinement = button.dataset.refinement;

    if (!refinement) return;

    card
      .querySelectorAll('.weapon-popover-refinement-button')
      .forEach((item) => {
        item.setAttribute('aria-selected', String(item === button));
      });

    card
      .querySelectorAll('.weapon-popover-passive-refinement')
      .forEach((panel) => {
        (panel as HTMLElement).hidden =
          (panel as HTMLElement).dataset.refinementPanel !== refinement;
      });

    const popover = getClosestPopover(button);

    if (popover) {
      positionPopoverCard(popover);
    }
  };

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
    const hasRoomBelow =
      bottomPlacement + cardRect.height <=
      window.innerHeight - VIEWPORT_PADDING;
    const preferredTop =
      hasRoomAbove || !hasRoomBelow ? topPlacement : bottomPlacement;

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
    document
      .querySelectorAll<HTMLElement>('.info-popover.is-open')
      .forEach((popover) => {
        if (popover !== except) {
          popover.classList.remove('is-open');
          setTriggerExpanded(popover, false);
        }
      });

    document.body.classList.toggle('info-popover-locked', hasOpenPopover());
    syncPageScrollLock();
  };

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;

    handleRefinementChange(event);

    if (!event.defaultPrevented) {
      handlePopoverToggle(event);
    }

    if (event.defaultPrevented) {
      ignoreNextClick = true;
    }
  });

  document.addEventListener('click', (event) => {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }

    handlePopoverToggle(event);
  });

  document.addEventListener('touchstart', handlePopoverTouchStart, {
    passive: true,
  });
  document.addEventListener('touchmove', handlePopoverTouchMove, {
    passive: false,
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

  window.addEventListener('resize', () => {
    positionActivePopovers();
    syncPageScrollLock();
  });
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
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest('.note-link')) {
      return;
    }

    if (target.closest('.info-popover-trigger')) {
      handlePopoverToggle(event);
    }
  });

  document.addEventListener('click', handleRefinementChange);
}
