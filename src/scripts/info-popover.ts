const card = document.createElement('span');
card.className = 'info-popover-card';
card.id = 'info-popover-card';
card.setAttribute('popover', 'auto');
card.setAttribute('role', 'dialog');
document.body.append(card);

const NOTE_TRIGGER_SELECTOR = '.note-button[data-note-id]';
const POPOVER_SELECTOR = `.info-popover, ${NOTE_TRIGGER_SELECTOR}`;
const TRIGGER_SELECTOR = `.info-popover-trigger, ${NOTE_TRIGGER_SELECTOR}`;

let activePopover: HTMLElement | null = null;
let pinned = false;

const getPopover = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLElement>(POPOVER_SELECTOR)
    : null;

const getTrigger = (popover: HTMLElement) =>
  popover.matches(TRIGGER_SELECTOR)
    ? popover
    : popover.querySelector<HTMLElement>(TRIGGER_SELECTOR);

function getNotePopoverHtml(noteId: string) {
  const note = Array.from(
    document.querySelectorAll<HTMLElement>('.note-target[data-note-id]'),
  ).find((item) => item.dataset.noteId === noteId);
  if (!note) return '';

  const clone = note.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>('.info-popover').forEach((popover) => {
    const trigger = getTrigger(popover);
    popover.replaceWith(
      document.createTextNode(trigger?.textContent ?? popover.textContent ?? ''),
    );
  });

  return clone.innerHTML;
}

const getPopoverHtml = (popover: HTMLElement) =>
  popover.dataset.noteId
    ? getNotePopoverHtml(popover.dataset.noteId)
    : popover.dataset.infoPopoverHtml;

function positionCard(popover: HTMLElement) {
  const trigger = getTrigger(popover);
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
  const html = getPopoverHtml(popover);
  if (!html) return;

  if (activePopover) {
    getTrigger(activePopover)?.setAttribute('aria-expanded', 'false');
  }
  activePopover = popover;
  pinned = pin;
  card.className = [
    'info-popover-card',
    popover.dataset.infoPopoverCardClass ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  card.innerHTML = html;
  const trigger = getTrigger(popover);
  trigger?.setAttribute('aria-controls', card.id);
  trigger?.setAttribute('aria-expanded', 'true');

  if (!card.matches(':popover-open')) card.showPopover();
  positionCard(popover);
}

function hidePopover() {
  if (activePopover) {
    getTrigger(activePopover)?.setAttribute('aria-expanded', 'false');
  }
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
      item.setAttribute('aria-pressed', String(item === button)),
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
    event.preventDefault();
    event.stopPropagation();
    selectRefinement(refinement);
    return;
  }

  const popover = getPopover(target.closest(TRIGGER_SELECTOR));
  if (!popover) return;

  event.preventDefault();
  if (activePopover === popover && pinned) hidePopover();
  else showPopover(popover, true);
});

card.addEventListener('pointerdown', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const refinement = target.closest<HTMLElement>('[data-refinement]');
  if (!refinement) return;

  pinned = true;
  card.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
  selectRefinement(refinement);
});

document.addEventListener('pointerover', (event) => {
  if ((event as PointerEvent).pointerType === 'touch') return;
  const popover = getPopover(
    event.target instanceof Element
      ? event.target.closest(TRIGGER_SELECTOR)
      : null,
  );
  if (popover && popover !== activePopover && !pinned) {
    showPopover(popover);
  }
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
  const popover = getPopover(
    event.target instanceof Element
      ? event.target.closest(TRIGGER_SELECTOR)
      : null,
  );
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
      ? event.target.closest(TRIGGER_SELECTOR)
      : null,
  );
  if (!popover) return;

  event.preventDefault();
  if (activePopover === popover && pinned) hidePopover();
  else showPopover(popover, true);
});

card.addEventListener('toggle', () => {
  if (!card.matches(':popover-open')) {
    if (activePopover) {
      getTrigger(activePopover)?.setAttribute('aria-expanded', 'false');
    }
    activePopover = null;
    pinned = false;
  }
});

window.addEventListener('resize', () => {
  if (activePopover) positionCard(activePopover);
});
