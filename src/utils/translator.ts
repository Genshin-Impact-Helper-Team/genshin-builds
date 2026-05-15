import { t } from './i18n';
import {
    formatWeaponPassive,
    type WeaponPassiveText,
    type WeaponPassiveValue,
} from './weapon-passive';

type TranslationCategory =
    | 'artifact'
    | 'weapon'
    | 'character'
    | 'stat'
    | 'element'
    | 'ability';

const CATEGORIES: TranslationCategory[] = [
    'artifact',
    'weapon',
    'character',
    'stat',
    'element',
    'ability',
];

type SharedWeaponData = {
    rarity: number;
    passive?: WeaponPassiveText;
    r1?: WeaponPassiveValue[];
    r2?: WeaponPassiveValue[];
    r3?: WeaponPassiveValue[];
    r4?: WeaponPassiveValue[];
    r5?: WeaponPassiveValue[];
    substat?: string;
    level_max?: {
        base_attack?: number;
        substat_value?: string;
    };
    level_1?: {
        base_attack?: number;
        substat_value?: string;
    };
};

type TranslateNoteTextOptions = {
    weaponPopovers?: boolean;
};

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatWeaponStatValue(
    level1Value?: number | string,
    levelMaxValue?: number | string,
) {
    if (level1Value === undefined || level1Value === null || level1Value === '') {
        return '';
    }

    if (
        levelMaxValue === undefined ||
        levelMaxValue === null ||
        levelMaxValue === ''
    ) {
        return String(level1Value);
    }

    return `${level1Value} / ${levelMaxValue}`;
}


/**
 * Helper class for translating structured content IDs and inline note references.
 *
 * Supports:
 * - translating artifact/weapon/character/stat/element IDs
 * - parsing inline note syntax like [[weapon:amos-bow]]
 * - tracking missing translation warnings
 */
export class TranslationHelper {
    // Collected missing translation warnings.
    private warnings: string[] = [];

    // Used to prevent duplicate warnings.
    private warningSet = new Set<string>();

    /**
     * Creates a new translation helper instance.
     *
     * @param locale Current locale object returned by getLocale().
     * @param weaponDataById Shared weapon data keyed by weapon translation ID.
     */
    constructor(
        private locale: any,
        private weaponDataById: Record<string, SharedWeaponData> = {},
        private lang = 'en',
    ) { }

    /**
     * Translates a content ID from a specific category.
     *
     * If the locale-specific translation is missing, a warning is stored while
     * the shared i18n helper falls back to English when available.
     *
     * @param category Translation category.
     * @param id Translation ID.
     * @param sourceFile Optional source file path for debugging.
     * @returns Localized string, English fallback, or original ID if unresolved.
     */
    translate(category: TranslationCategory, id: string, sourceFile?: string) {
        // Check the requested locale directly so fallback translations still warn.
        const hasLocalizedTranslation = this.locale?.[category]?.[id] !== undefined;
        const translation = t(this.locale, category, id, sourceFile);

        if (!hasLocalizedTranslation) {
            this.addWarning(
                `[i18n] Missing translation for id '${id}' in category '${category}'` +
                (sourceFile ? ` (source: ${sourceFile})` : ''),
            );
        }

        return translation;
    }

    /**
     * Parses and translates inline note references.
     *
     * Supported syntax:
     * - [[weapon:amos-bow]]
     * - [[artifact:viridescent-venerer]]
     * - [[character:furina]]
     * - [[stat:er]]
     * - [[element:melt]]
     * - [[ability:burst]]
     * - [[some-id]] (automatic category lookup)
     *
     * Unknown IDs are left unchanged and logged as warnings.
     *
     * @param text Raw note text.
     * @param sourceFile Optional source file path for debugging.
     * @returns Note text with translated inline references.
     */
    translateNoteText(
        text: string,
        sourceFile?: string,
        options: TranslateNoteTextOptions = {},
    ) {
        return text.replace(
            /\[\[(?:(artifact|weapon|character|stat|element|ability):)?([a-z0-9%/-]+)\]\]/g,
            (match, category: TranslationCategory | undefined, id: string) => {
                const translation = this.translateInlineId(
                    id,
                    category,
                    sourceFile,
                    options,
                );

                return translation ?? match;
            },
        );
    }

    /**
     * Translates an inline note ID.
     *
     * If a category is provided, only that category is checked.
     * Otherwise, all known categories are searched.
     *
     * @param id Translation ID found inside an inline note reference.
     * @param category Optional translation category.
     * @param sourceFile Optional source file path for debugging.
     * @returns Localized or fallback string, or null if no translation exists.
     */
    private translateInlineId(
        id: string,
        category?: TranslationCategory,
        sourceFile?: string,
        options: TranslateNoteTextOptions = {},
    ) {
        if (category) {
            const translation = this.translate(category, id, sourceFile);

            if (
                category === 'weapon' &&
                options.weaponPopovers &&
                translation !== id
            ) {
                return this.renderWeaponPopover(id, translation);
            }

            return translation !== id ? translation : null;
        }

        return this.findTranslationInAnyCategory(id, sourceFile);
    }

    private renderWeaponPopover(id: string, name: string) {
        const info = this.weaponDataById[id];

        if (!info) {
            return escapeHtml(name);
        }

        const baseAttackValue = formatWeaponStatValue(
            info.level_1?.base_attack,
            info.level_max?.base_attack,
        );
        const substatValue = formatWeaponStatValue(
            info.level_1?.substat_value,
            info.level_max?.substat_value,
        );
        const refinements = [1, 2, 3, 4, 5] as const;
        const refinementButtons = refinements
            .map((refinement) =>
                [
                    '<button class="weapon-popover-refinement-button" type="button" data-refinement="r',
                    refinement,
                    '" aria-selected="',
                    refinement === 1 ? 'true' : 'false',
                    '">R',
                    refinement,
                    '</button>',
                ].join(''),
            )
            .join('');
        const passivePanels = refinements
            .map((refinement) =>
                [
                    '<span class="weapon-popover-passive-refinement" data-refinement-panel="r',
                    refinement,
                    '"',
                    refinement === 1 ? '' : ' hidden',
                    '>',
                    formatWeaponPassive(info, refinement, this.lang),
                    '</span>',
                ].join(''),
            )
            .join('');
        const substatName = info.substat
            ? t(this.locale, 'stat', info.substat, undefined, false)
            : '';
        const substatRow = substatName
            ? [
                '<span class="weapon-popover-stat"><span>',
                escapeHtml(substatName),
                '</span><strong>',
                escapeHtml(substatValue),
                '</strong></span>',
            ].join('')
            : '';

        return [
            '<span class="weapon-popover">',
            '<button class="weapon-popover-trigger" type="button" aria-expanded="false">',
            escapeHtml(name),
            '</button>',
            '<span class="weapon-popover-card" role="tooltip">',
            '<div class="weapon-popover-header">',
            '<span class="weapon-popover-name">',
            escapeHtml(name),
            '</span>',
            '<span class="weapon-popover-rarity">',
            escapeHtml(info.rarity),
            ' \u2605</span>',
            '</div>',
            '<span class="weapon-popover-stat"><span>Base ATK</span><strong>',
            escapeHtml(baseAttackValue),
            '</strong></span>',
            substatRow,
            '<span class="weapon-popover-refinement">',
            refinementButtons,
            '</span>',
            '<span class="weapon-popover-passive">',
            passivePanels,
            '</span>',
            '</span>',
            '</span>',
        ].join('');
    }

    /**
     * Searches every known translation category for a matching ID.
     *
     * Used by inline note references without an explicit category,
     * such as [[er]] or [[melt]].
     *
     * @param id Translation ID to search for.
     * @param sourceFile Optional source file path for debugging.
     * @returns Localized or fallback string, or null if no category contains it.
     */
    private findTranslationInAnyCategory(id: string, sourceFile?: string) {
        for (const category of CATEGORIES) {
            // Fallback hits are valid display text, but the missing locale still matters.
            const hasLocalizedTranslation =
                this.locale?.[category]?.[id] !== undefined;
            const translation = t(this.locale, category, id, sourceFile, false);

            if (translation !== id) {
                if (!hasLocalizedTranslation) {
                    this.addWarning(
                        `[i18n] Missing translation for id '${id}' in category '${category}'` +
                        (sourceFile ? ` (source: ${sourceFile})` : ''),
                    );
                }

                return translation;
            }
        }

        this.addWarning(
            `[i18n] Missing translation for id '${id}'` +
            (sourceFile ? ` (source: ${sourceFile})` : ''),
        );

        return null;
    }

    /**
     * Stores a warning if it has not already been added.
     *
     * @param warning Warning message to store.
     */
    private addWarning(warning: string) {
        if (!this.warningSet.has(warning)) {
            this.warningSet.add(warning);
            this.warnings.push(warning);
        }
    }

    /**
     * Returns all collected translation warnings.
     *
     * @returns Array of warning strings.
     */
    getWarnings() {
        return this.warnings;
    }
}
