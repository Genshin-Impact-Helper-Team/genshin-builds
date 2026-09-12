function initializeTips() {
    document.querySelectorAll<HTMLElement>('[data-build-tips]').forEach((section, sectionIndex) => {
        const buttons = section.querySelectorAll<HTMLButtonElement>('button[data-toggle]');
        const sync = () => buttons.forEach((button, index) => {
            const panel = button.nextElementSibling as HTMLElement;
            panel.id = `build-tip-${sectionIndex}-${index}`;
            const expanded = button.dataset.open === 'true';
            button.setAttribute('aria-controls', panel.id);
            button.setAttribute('aria-expanded', String(expanded));
            panel.inert = !expanded;
            panel.setAttribute('aria-hidden', String(!expanded));
        });
        sync();
        if (!section.dataset.tipsInitialized) {
            section.addEventListener('click', (event) => {
                const clicked = event.target instanceof Element
                    ? event.target.closest<HTMLButtonElement>('button[data-toggle]')
                    : null;
                queueMicrotask(() => {
                    if (clicked?.dataset.open === 'true') {
                        buttons.forEach((button) => {
                            if (button !== clicked) button.dataset.open = 'false';
                        });
                    }
                    sync();
                });
            });
            section.dataset.tipsInitialized = 'true';
        }
    });
}
initializeTips();
document.addEventListener('astro:page-load', initializeTips);
