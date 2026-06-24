const infoPopoverWindow = window as typeof window & {
  __infoPopoversReady?: boolean;
};

if (!infoPopoverWindow.__infoPopoversReady) {
  infoPopoverWindow.__infoPopoversReady = true;

  const VIEWPORT_PADDING = 8;
  const POPOVER_GAP = 8;
  const MOBILE_POPOVER_QUERY = '(max-width: 900px)';
  const POPOVER_CARD_ID = 'info-popover-card';
  let ignoreNextClick = false;
  let lastTouchY = 0;
  let lockedScrollY = 0;
  let hoveredPopover: HTMLElement | null = null;
  let focusedPopover: HTMLElement | null = null;
  let openPopover: HTMLElement | null = null;
  let activePopover: HTMLElement | null = null;
  let isCardHovered = false;
  let popoverPositionFrame = 0;
  let isTouchMoveBound = false;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const setTriggerExpanded = (popover: HTMLElement, isExpanded: boolean) => {
    popover
      .querySelector<HTMLElement>('.info-popover-trigger')
      ?.setAttribute('aria-expanded', String(isExpanded));
  };

  const getClosestPopover = (target: EventTarget | null) =>
    target instanceof HTMLElement
      ? target.closest<HTMLElement>('.info-popover')
      : null;

  const isInsidePopoverCard = (target: EventTarget | null) =>
    target instanceof HTMLElement
      ? target.closest<HTMLElement>('.info-popover-card') !== null
      : false;

  const getPopoverCard = () => {
    const existingCard = document.getElementById(POPOVER_CARD_ID);

    if (existingCard) {
      return existingCard;
    }

    const card = document.createElement('span');
    card.id = POPOVER_CARD_ID;
    card.className = 'info-popover-card';
    card.setAttribute('role', 'tooltip');
    card.setAttribute('aria-hidden', 'true');
    document.body.append(card);

    return card;
  };

  const getOpenPopoverCard = () => {
    const card = document.getElementById(POPOVER_CARD_ID);

    return card?.classList.contains('is-visible') ? card : null;
  };

  const hasOpenPopover = () =>
    openPopover?.isConnected === true &&
    openPopover.classList.contains('is-open');

  const isMobilePopoverViewport = () =>
    window.matchMedia(MOBILE_POPOVER_QUERY).matches;

  const shouldLockPageScroll = () =>
    hasOpenPopover() && isMobilePopoverViewport();

  const readPopoverPayload = (popover: HTMLElement) => {
    const html = popover.dataset.infoPopoverHtml;

    if (html === undefined) {
      return null;
    }

    return {
      cardClassName: popover.dataset.infoPopoverCardClass ?? '',
      html,
    };
  };

  const updatePopoverCard = (popover: HTMLElement) => {
    const payload = readPopoverPayload(popover);

    if (!payload) {
      return null;
    }

    const card = getPopoverCard();
    const isVisible = card.classList.contains('is-visible');
    const classNames = [
      'info-popover-card',
      payload.cardClassName,
      isVisible ? 'is-visible' : '',
    ]
      .filter(Boolean)
      .join(' ');

    if (activePopover !== popover) {
      if (activePopover && activePopover !== openPopover) {
        setTriggerExpanded(activePopover, false);
      }

      card.innerHTML = payload.html;
      activePopover = popover;
    }

    card.className = classNames;

    return card;
  };

  const hidePopoverCard = () => {
    const card = document.getElementById(POPOVER_CARD_ID);

    if (activePopover && activePopover !== openPopover) {
      setTriggerExpanded(activePopover, false);
    }

    activePopover = null;
    isCardHovered = false;

    if (!card) {
      return;
    }

    card.classList.remove('is-visible');
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = '';
  };

  const getVisiblePopover = (includeHover = true) => {
    if (hasOpenPopover()) {
      return openPopover;
    }

    if (focusedPopover?.isConnected) {
      return focusedPopover;
    }

    if (includeHover && hoveredPopover?.isConnected) {
      return hoveredPopover;
    }

    if (includeHover && isCardHovered && activePopover?.isConnected) {
      return activePopover;
    }

    return null;
  };

  const positionPopoverCard = (popover: HTMLElement) => {
    const trigger = popover.querySelector<HTMLElement>('.info-popover-trigger');
    const card = updatePopoverCard(popover);

    if (!trigger || !card) return;

    const wasVisible = card.classList.contains('is-visible');
    const previousVisibility = card.style.visibility;

    card.classList.add('is-visible');
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
    const finalLeft = clamp(
      alignedLeft,
      VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, maxLeft),
    );
    const finalTop = clamp(
      preferredTop,
      VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, maxTop),
    );

    card.style.left = `${finalLeft}px`;
    card.style.top = `${finalTop}px`;
    card.style.visibility = previousVisibility;

    if (!wasVisible) {
      card.classList.remove('is-visible');
    }
  };

  const showPopoverCard = (popover: HTMLElement) => {
    const card = updatePopoverCard(popover);

    if (!card) {
      return;
    }

    setTriggerExpanded(popover, true);
    card.classList.add('is-visible');
    card.setAttribute('aria-hidden', 'false');
    positionPopoverCard(popover);
  };

  const syncPopoverVisibility = (includeHover = true) => {
    const visiblePopover = getVisiblePopover(includeHover);

    if (visiblePopover) {
      showPopoverCard(visiblePopover);
    } else {
      hidePopoverCard();
    }
  };

  const positionActivePopover = (includeHover = true) => {
    const visiblePopover = getVisiblePopover(includeHover);

    if (visiblePopover) {
      positionPopoverCard(visiblePopover);
    }
  };

  const scheduleActivePopoverPosition = (includeHover = true) => {
    if (!getVisiblePopover(includeHover) || popoverPositionFrame) {
      return;
    }

    popoverPositionFrame = window.requestAnimationFrame(() => {
      popoverPositionFrame = 0;
      positionActivePopover(includeHover);
    });
  };

  function handlePopoverTouchMove(event: TouchEvent) {
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
  }

  const syncPopoverTouchMoveListener = () => {
    const shouldBind = shouldLockPageScroll();

    if (shouldBind && !isTouchMoveBound) {
      document.addEventListener('touchmove', handlePopoverTouchMove, {
        passive: false,
      });
      isTouchMoveBound = true;
      return;
    }

    if (!shouldBind && isTouchMoveBound) {
      document.removeEventListener('touchmove', handlePopoverTouchMove);
      isTouchMoveBound = false;
    }
  };

  const lockPageScroll = () => {
    lockedScrollY = window.scrollY;
  };

  const unlockPageScroll = () => {
    if (document.body.style.position !== 'fixed') return;

    const previousScrollBehavior =
      document.documentElement.style.scrollBehavior;

    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, lockedScrollY);
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
  };

  const syncPageScrollLock = () => {
    if (shouldLockPageScroll()) {
      lockPageScroll();
    } else {
      unlockPageScroll();
    }

    syncPopoverTouchMoveListener();
  };

  const closeInfoPopovers = (except?: HTMLElement) => {
    document
      .querySelectorAll<HTMLElement>('.info-popover.is-open')
      .forEach((popover) => {
        if (popover !== except) {
          popover.classList.remove('is-open');
          setTriggerExpanded(popover, false);
        }
      });

    if (!except) {
      hoveredPopover = null;
      focusedPopover = null;
      isCardHovered = false;
    }

    openPopover = except?.classList.contains('is-open') ? except : null;
    document.body.classList.toggle('info-popover-locked', hasOpenPopover());
    syncPageScrollLock();
    syncPopoverVisibility();
  };

  const handlePopoverTouchStart = (event: TouchEvent) => {
    if (!getOpenPopoverCard()) return;

    lastTouchY = event.touches[0]?.clientY ?? 0;
  };

  const handlePopoverToggle = (event: Event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      closeInfoPopovers();
      return;
    }

    const noteLink = target.closest('.note-link');
    const trigger = target.closest('.info-popover-trigger');
    const card = target.closest('.info-popover-card');

    if (noteLink || card) {
      return;
    }

    if (!trigger) {
      closeInfoPopovers();
      return;
    }

    const popover = getClosestPopover(trigger);
    if (!popover || !readPopoverPayload(popover)) return;

    event.preventDefault();

    const wasOpen = popover.classList.contains('is-open');
    closeInfoPopovers();

    if (!wasOpen) {
      popover.classList.add('is-open');
      openPopover = popover;
      setTriggerExpanded(popover, true);
      showPopoverCard(popover);
    }

    document.body.classList.toggle('info-popover-locked', hasOpenPopover());
    syncPageScrollLock();
  };

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

    if (activePopover) {
      positionPopoverCard(activePopover);
    }
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

  document.addEventListener('pointerover', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement) || event.pointerType === 'touch') {
      return;
    }

    if (isInsidePopoverCard(target)) {
      isCardHovered = true;
      return;
    }

    const popover = getClosestPopover(target);

    if (popover && readPopoverPayload(popover)) {
      hoveredPopover = popover;
      syncPopoverVisibility();
    }
  });

  document.addEventListener('pointerout', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const nextPopover = getClosestPopover(event.relatedTarget);

    if (isInsidePopoverCard(target)) {
      if (
        !isInsidePopoverCard(event.relatedTarget) &&
        nextPopover !== activePopover
      ) {
        isCardHovered = false;
        syncPopoverVisibility();
      }

      return;
    }

    const popover = getClosestPopover(target);

    if (
      popover &&
      popover !== nextPopover &&
      !isInsidePopoverCard(event.relatedTarget) &&
      hoveredPopover === popover
    ) {
      hoveredPopover = null;
      syncPopoverVisibility();
    }
  });

  document.addEventListener('focusin', (event) => {
    if (isInsidePopoverCard(event.target)) {
      return;
    }

    const popover = getClosestPopover(event.target);

    if (popover && !document.body.classList.contains('info-popover-locked')) {
      focusedPopover = popover;
      closeInfoPopovers(popover);
      syncPopoverVisibility();
    }
  });

  document.addEventListener('focusout', (event) => {
    const popover = getClosestPopover(event.target);
    const nextPopover = getClosestPopover(event.relatedTarget);

    if (
      popover &&
      popover !== nextPopover &&
      !isInsidePopoverCard(event.relatedTarget) &&
      focusedPopover === popover
    ) {
      focusedPopover = null;
      syncPopoverVisibility();
      return;
    }

    if (
      isInsidePopoverCard(event.target) &&
      !isInsidePopoverCard(event.relatedTarget) &&
      nextPopover !== activePopover
    ) {
      focusedPopover = null;
      syncPopoverVisibility();
    }
  });

  window.addEventListener('resize', () => {
    scheduleActivePopoverPosition();
    syncPageScrollLock();
  });

  window.addEventListener(
    'scroll',
    (event) => {
      if (!isInsidePopoverCard(event.target)) {
        scheduleActivePopoverPosition(false);
      }
    },
    true,
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeInfoPopovers();
      hidePopoverCard();
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
