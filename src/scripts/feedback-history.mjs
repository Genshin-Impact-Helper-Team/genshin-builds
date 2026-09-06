export const feedbackHistoryKey = 'genshin-builds:feedback-history';

export function feedbackIssueUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (
      url.origin !== 'https://github.com' ||
      !/^\/Genshin-Impact-Helper-Team\/genshin-builds\/issues\/\d+$/i.test(url.pathname)
    )
      return '';
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

export function readFeedbackHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(feedbackHistoryKey) ?? '[]');
    return Array.isArray(saved) ? [...new Set(saved.map(feedbackIssueUrl).filter(Boolean))] : [];
  } catch {
    return [];
  }
}

export function saveFeedbackIssue(value) {
  const url = feedbackIssueUrl(value);
  if (!url) return;
  try {
    const history = readFeedbackHistory().filter((saved) => saved !== url);
    localStorage.setItem(feedbackHistoryKey, JSON.stringify([url, ...history]));
    window.dispatchEvent(new Event('feedback-history-updated'));
  } catch {
    // Storage failure
  }
}
