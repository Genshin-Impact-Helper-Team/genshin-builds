const card = document.createElement('span');
card.className = 'info-popover-card';
card.id = 'info-popover-card';
card.setAttribute('popover', 'auto');
card.setAttribute('role', 'dialog');
document.body.append(card);

let activePopover: HTMLElement | null = null;
let pinned = false;

const getPopover = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLElement>('.info-popover')
    : null;

function positionCard(popover: HTMLElement) {
  const trigger = popover.querySelector<HTMLElement>('.info-popover-trigger');
  if (!trigger) return;

  const triggerRect = trigger.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const padding = 8;
  const top =
    triggerRect.top >= cardRect.height + padding
      ? triggerRect.top - cardRect.height - padding
      : triggerRect.bottom + padding;

  card.style.left = `${Math.min(
    Math.max(triggerRect.left, padding),
    window.innerWidth - cardRect.width - padding,
  )}px`;
  card.style.top = `${Math.min(
    Math.max(top, padding),
    window.innerHeight - cardRect.height - padding,
  )}px`;
}

function showPopover(popover: HTMLElement, pin = false) {
  const html = popover.dataset.infoPopoverHtml;
  if (!html) return;

  activePopover
    ?.querySelector<HTMLElement>('.info-popover-trigger')
    ?.setAttribute('aria-expanded', 'false');
  activePopover = popover;
  pinned = pin;
  card.className = [
    'info-popover-card',
    popover.dataset.infoPopoverCardClass ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  card.innerHTML = html;
  const trigger = popover.querySelector<HTMLElement>('.info-popover-trigger');
  trigger?.setAttribute('aria-controls', card.id);
  trigger?.setAttribute('aria-expanded', 'true');

  if (!card.matches(':popover-open')) card.showPopover();
  positionCard(popover);
}

function hidePopover() {
  activePopover
    ?.querySelector<HTMLElement>('.info-popover-trigger')
    ?.setAttribute('aria-expanded', 'false');
  activePopover = null;
  pinned = false;
  if (card.matches(':popover-open')) card.hidePopover();
}

function selectRefinement(button: HTMLElement) {
  const refinement = button.dataset.refinement;
  if (!refinement) return;

  card
    .querySelectorAll<HTMLElement>('[data-refinement]')
    .forEach((item) =>
      item.setAttribute('aria-selected', String(item === button)),
    );
  card
    .querySelectorAll<HTMLElement>('[data-refinement-panel]')
    .forEach((panel) => {
      panel.hidden = panel.dataset.refinementPanel !== refinement;
    });
  if (activePopover) positionCard(activePopover);
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const refinement = target.closest<HTMLElement>('[data-refinement]');
  if (refinement && card.contains(refinement)) {
    selectRefinement(refinement);
    return;
  }

  if (target.closest('.note-link')) {
    hidePopover();
    return;
  }

  const popover = getPopover(target.closest('.info-popover-trigger'));
  if (!popover) return;

  event.preventDefault();
  if (activePopover === popover && pinned) hidePopover();
  else showPopover(popover, true);
});

document.addEventListener('pointerover', (event) => {
  if ((event as PointerEvent).pointerType === 'touch') return;
  const popover = getPopover(event.target);
  if (popover && popover !== activePopover && !pinned) showPopover(popover);
});

document.addEventListener('pointerout', (event) => {
  if (pinned || !activePopover) return;
  const next = event.relatedTarget;
  if (
    next instanceof Node &&
    (activePopover.contains(next) || card.contains(next))
  ) {
    return;
  }
  hidePopover();
});

document.addEventListener('focusin', (event) => {
  const popover = getPopover(event.target);
  if (popover && !pinned) showPopover(popover);
});

document.addEventListener('focusout', (event) => {
  if (pinned || !activePopover) return;
  const next = event.relatedTarget;
  if (
    next instanceof Node &&
    (activePopover.contains(next) || card.contains(next))
  ) {
    return;
  }
  hidePopover();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  const popover = getPopover(
    event.target instanceof Element
      ? event.target.closest('.info-popover-trigger')
      : null,
  );
  if (!popover) return;

  event.preventDefault();
  if (activePopover === popover && pinned) hidePopover();
  else showPopover(popover, true);
});

card.addEventListener('toggle', () => {
  if (!card.matches(':popover-open')) {
    activePopover
      ?.querySelector<HTMLElement>('.info-popover-trigger')
      ?.setAttribute('aria-expanded', 'false');
    activePopover = null;
    pinned = false;
  }
});

window.addEventListener('resize', () => {
  if (activePopover) positionCard(activePopover);
});
