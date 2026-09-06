import { feedbackHistoryKey, readFeedbackHistory } from './feedback-history.mjs';

function renderFeedbackHistory() {
  const history = readFeedbackHistory();
  document.querySelectorAll<HTMLElement>('[data-feedback-history-link]').forEach((link) => {
    link.hidden = history.length === 0;
  });

  const page = document.querySelector<HTMLElement>('[data-feedback-history-page]');
  if (!page) return;
  if (history.length === 0) {
    page.hidden = true;
    window.location.replace(page.dataset.emptyRedirect!);
    return;
  }

  const list = page.querySelector<HTMLUListElement>('[data-feedback-history-list]');
  if (!list) return;
  list.replaceChildren(
    ...history.map((url) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${list.dataset.issueLabel} #${url.split('/').pop()}`;
      item.append(link);
      return item;
    }),
  );
  page.hidden = false;
}

window.addEventListener('feedback-history-updated', renderFeedbackHistory);
window.addEventListener('storage', (event) => {
  if (event.key === feedbackHistoryKey || event.key === null) renderFeedbackHistory();
});
document.addEventListener('astro:after-swap', renderFeedbackHistory);
renderFeedbackHistory();
