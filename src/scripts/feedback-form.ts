import { closeModal, modal, toast } from 'webcoreui';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: 'auto';
          size: 'flexible';
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const FORM_SELECTOR = '[data-feedback-form]';
const MODAL_SELECTOR = '#feedback-modal';
const PAGE_SELECTOR = '[data-feedback-page]';
const LANGUAGE_SELECTOR = '[data-feedback-language]';
const STATUS_SELECTOR = '[data-feedback-status]';
const CAPTCHA_SELECTOR = '[data-feedback-captcha]';
const SUCCESS_TOAST_SELECTOR = '#feedback-success-toast';
const FEEDBACK_ISSUE_PATH_PATTERN =
  /^\/Genshin-Impact-Helper-Team\/genshin-builds\/issues\/\d+$/i;
const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileLoad: Promise<void> | null = null;

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

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  turnstileLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Captcha failed to load.')),
      {
        once: true,
      },
    );
    document.head.append(script);
  });
  return turnstileLoad;
}

async function renderCaptcha(widget: HTMLElement) {
  const container = widget.querySelector<HTMLElement>(CAPTCHA_SELECTOR);
  const sitekey = container?.dataset.sitekey;
  if (!container || !sitekey || container.dataset.turnstileWidget) return;

  await loadTurnstile();
  const widgetId = window.turnstile?.render(container, {
    sitekey,
    action: 'feedback',
    theme: 'auto',
    size: 'flexible',
  });
  if (widgetId) container.dataset.turnstileWidget = widgetId;
}

function resetCaptcha(widget: HTMLElement) {
  const widgetId =
    widget.querySelector<HTMLElement>(CAPTCHA_SELECTOR)?.dataset
      .turnstileWidget;
  window.turnstile?.reset?.(widgetId);
}

function feedbackIssueUrl(value: unknown) {
  if (typeof value !== 'string') return '';

  try {
    const url = new URL(value);
    if (
      url.origin !== 'https://github.com' ||
      !FEEDBACK_ISSUE_PATH_PATTERN.test(url.pathname)
    ) {
      return '';
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

function successToastContent(issueUrl: unknown) {
  const url = feedbackIssueUrl(issueUrl);
  const message = 'Your feedback has been sent properly.';
  if (!url) return message;

  return `${message}<br><a href="${url}" target="_blank" rel="noopener noreferrer">You can follow its progress on GitHub.</a>`;
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
    target.addEventListener('click', async (event) => {
      event.preventDefault();
      if (pageInput && !pageInput.value.trim()) pageInput.value = currentPage();
      if (languageInput) languageInput.value = currentLanguage(widget);
      modalInstance?.open();
      try {
        await renderCaptcha(widget);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Captcha failed to load.';
        setStatus(status, message, 'error');
      }
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
        const message = result.error || 'Could not send feedback.';
        const details = result.details ? ` ${result.details}` : '';
        throw new Error(
          result.issueUrl
            ? `${message}${details} Issue: ${result.issueUrl}`
            : `${message}${details}`,
        );
      }

      form.reset();
      setStatus(status, '');
      closeModal(MODAL_SELECTOR);
      toast({
        element: SUCCESS_TOAST_SELECTOR,
        content: successToastContent(result.issueUrl),
        position: 'bottom-left',
        timeout: 10000,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not send feedback.';
      setStatus(status, message, 'error');
    } finally {
      resetCaptcha(widget);
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
