const highlightClass = 'note-highlight';
const highlightDuration = 1400;

/**
 * Briefly highlights a note target.
 *
 * The forced reflow restarts the CSS animation when the same note is clicked
 * repeatedly.
 *
 * @param target Element to highlight.
 */
function highlightNote(target: Element | null) {
  if (!(target instanceof HTMLElement)) return;

  target.classList.remove(highlightClass);
  void target.offsetWidth;
  target.classList.add(highlightClass);

  window.setTimeout(() => {
    target.classList.remove(highlightClass);
  }, highlightDuration);
}

/**
 * Resolves a URL hash into its target element.
 *
 * @param hash Hash string including the leading `#`.
 * @returns Matching element, or null when the hash is empty/missing.
 */
function findHashTarget(hash: string) {
  if (!hash) return null;

  return document.getElementById(decodeURIComponent(hash.slice(1)));
}

/**
 * Scrolls to a note target, updates the URL hash, and runs the highlight.
 *
 * Native hash scrolling can pick the wrong element when old duplicated IDs are
 * present in cached markup, so this keeps the target resolution explicit.
 *
 * @param hash Hash string from a note link.
 */
function scrollToNote(hash: string) {
  const target = findHashTarget(hash);

  if (!target) return;

  history.pushState(null, '', hash);
  target.scrollIntoView({ block: 'start' });
  highlightNote(target);
}

document.querySelectorAll<HTMLAnchorElement>('.note-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    scrollToNote(link.hash);
  });
});

// Browser back/forward between note hashes should also refresh the highlight.
window.addEventListener('hashchange', () => {
  highlightNote(findHashTarget(window.location.hash));
});

if (window.location.hash) {
  highlightNote(findHashTarget(window.location.hash));
}
