import { closeModal, modal } from 'webcoreui';

const FORM_SELECTOR = '[data-feedback-form]';
const MODAL_SELECTOR = '#feedback-modal';
const PAGE_SELECTOR = '[data-feedback-page]';
const LANGUAGE_SELECTOR = '[data-feedback-language]';
const STATUS_SELECTOR = '[data-feedback-status]';

function currentPage() {
  return window.location.href;
}

function currentLanguage(widget: HTMLElement) {
  return (
    document.documentElement.lang ||
    widget.dataset.feedbackLang ||
    'en'
  ).trim();
}

function setStatus(
  status: HTMLElement | null,
  message: string,
  state: 'success' | 'error' | '' = '',
) {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function bindFeedbackWidget(widget: HTMLElement) {
  if (widget.dataset.feedbackBound === 'true') return;
  widget.dataset.feedbackBound = 'true';

  const form = widget.querySelector<HTMLFormElement>(FORM_SELECTOR);
  const pageInput = widget.querySelector<HTMLTextAreaElement>(PAGE_SELECTOR);
  const languageInput =
    widget.querySelector<HTMLInputElement>(LANGUAGE_SELECTOR);
  const status = widget.querySelector<HTMLElement>(STATUS_SELECTOR);
  const modalInstance = modal(MODAL_SELECTOR);
  const speedDialTrigger = widget.querySelector<HTMLElement>(
    '.speed-dial[data-id="w-speed-dial"] > button',
  );
  const openTargets = [
    widget.querySelector('.speed-dial a[href="#feedback-modal"]'),
    ...document.querySelectorAll('[data-feedback-open]'),
  ].filter((target): target is HTMLElement => target instanceof HTMLElement);

  speedDialTrigger?.setAttribute('aria-label', 'Open quick actions');
  speedDialTrigger?.setAttribute('title', 'Quick actions');

  for (const target of openTargets) {
    if (target.dataset.feedbackOpenBound === 'true') continue;
    target.dataset.feedbackOpenBound = 'true';
    target.setAttribute('aria-label', 'Open feedback form');
    target.setAttribute('title', 'Feedback');
    target.addEventListener('click', (event) => {
      event.preventDefault();
      if (pageInput && !pageInput.value.trim()) pageInput.value = currentPage();
      if (languageInput) languageInput.value = currentLanguage(widget);
      modalInstance?.open();
    });
  }

  widget
    .querySelector('[data-feedback-close]')
    ?.addEventListener('click', () => {
      closeModal(MODAL_SELECTOR);
    });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (pageInput && !pageInput.value.trim()) pageInput.value = currentPage();
    if (languageInput) languageInput.value = currentLanguage(widget);

    form.dataset.busy = 'true';
    setStatus(status, 'Sending feedback...');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Could not send feedback.');
      }

      form.reset();
      setStatus(status, 'Feedback sent. Thank you!', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not send feedback.';
      setStatus(status, message, 'error');
    } finally {
      delete form.dataset.busy;
    }
  });
}

function bindFeedbackWidgets() {
  document
    .querySelectorAll<HTMLElement>('[data-feedback-widget]')
    .forEach(bindFeedbackWidget);
}

document.addEventListener('astro:after-swap', bindFeedbackWidgets);
bindFeedbackWidgets();
