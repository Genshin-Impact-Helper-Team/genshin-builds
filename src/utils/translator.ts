import { t } from './i18n';
import translationAliases from '../data/translation-aliases.json';
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
type InlineTranslationCategory = TranslationCategory | 'set';

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

type LocalizedArtifactEffect = {
  en?: string;
  [lang: string]: string | undefined;
};

type SharedArtifactSetData = {
  rarity: number;
  '1p'?: LocalizedArtifactEffect;
  '2p'?: LocalizedArtifactEffect;
  '4p'?: LocalizedArtifactEffect;
};

type TranslateNoteTextOptions = {
  weaponPopovers?: boolean;
  artifactPopovers?: boolean;
};

type TranslationAliasCategory = Partial<
  Record<InlineTranslationCategory, Record<string, string>>
>;

const aliases = translationAliases as TranslationAliasCategory;

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
 * - translating artifact set/weapon/character/stat/element IDs
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
    private artifactSetDataById: Record<string, SharedArtifactSetData> = {},
  ) {}

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
   * - [[set:viridescent-venerer]]
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
      /\[\[(?:(set|weapon|character|stat|element|ability):)?([a-z0-9%/-]+)\]\]/g,
      (match, category: InlineTranslationCategory | undefined, id: string) => {
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
    category?: InlineTranslationCategory,
    sourceFile?: string,
    options: TranslateNoteTextOptions = {},
  ) {
    if (category) {
      const translationCategory = this.toTranslationCategory(category);
      const canonicalId = this.resolveAlias(translationCategory, id);
      const translation = this.translate(
        translationCategory,
        canonicalId,
        sourceFile,
      );

      if (translation === canonicalId) {
        return null;
      }

      if (translationCategory === 'weapon' && options.weaponPopovers) {
        return this.renderWeaponPopover(canonicalId, translation);
      }

      if (translationCategory === 'artifact' && options.artifactPopovers) {
        return this.renderArtifactPopover(canonicalId, translation);
      }

      return translation;
    }

    return this.findTranslationInAnyCategory(id, sourceFile);
  }

  private toTranslationCategory(category: InlineTranslationCategory) {
    return category === 'set' ? 'artifact' : category;
  }

  resolveAlias(category: TranslationCategory, id: string) {
    const aliasCategory = category === 'artifact' ? 'set' : category;

    return aliases[aliasCategory]?.[id] ?? id;
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
          '<span class="info-popover-stat"><span>',
          escapeHtml(substatName),
          '</span><strong>',
          escapeHtml(substatValue),
          '</strong></span>',
        ].join('')
      : '';

    return [
      '<span class="info-popover weapon-popover">',
      '<button class="info-popover-trigger" type="button" aria-expanded="false">',
      escapeHtml(name),
      '</button>',
      '<span class="info-popover-card" role="tooltip">',
      '<span class="info-popover-header">',
      '<span class="info-popover-name">',
      escapeHtml(name),
      '</span>',
      '<span class="info-popover-rarity">',
      escapeHtml(info.rarity),
      ' \u2605</span>',
      '</span>',
      '<span class="info-popover-stat"><span>Base ATK</span><strong>',
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

  private getLocalizedArtifactEffect(effect?: LocalizedArtifactEffect) {
    if (!effect) return '';

    return effect[this.lang] ?? effect.en ?? '';
  }

  private renderArtifactPopover(id: string, name: string) {
    const info = this.artifactSetDataById[id];

    if (!info) {
      return escapeHtml(name);
    }

    const effectRows = [
      { label: '1P', value: this.getLocalizedArtifactEffect(info['1p']) },
      { label: '2P', value: this.getLocalizedArtifactEffect(info['2p']) },
      { label: '4P', value: this.getLocalizedArtifactEffect(info['4p']) },
    ].filter((row) => row.value);

    return [
      '<span class="info-popover artifact-popover">',
      '<button class="info-popover-trigger artifact-popover-trigger" type="button" aria-expanded="false">',
      escapeHtml(name),
      '</button>',
      '<span class="info-popover-card artifact-popover-card" role="tooltip">',
      '<span class="info-popover-header">',
      '<span class="info-popover-name">',
      escapeHtml(name),
      '</span>',
      '<span class="info-popover-rarity">',
      escapeHtml(info.rarity),
      ' \u2605</span>',
      '</span>',
      effectRows
        .map((row) =>
          [
            '<span class="info-popover-stat artifact-popover-effect"><span>',
            escapeHtml(row.label),
            '</span><strong>',
            escapeHtml(row.value),
            '</strong></span>',
          ].join(''),
        )
        .join(''),
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
      const canonicalId = this.resolveAlias(category, id);
      // Fallback hits are valid display text, but the missing locale still matters.
      const hasLocalizedTranslation =
        this.locale?.[category]?.[canonicalId] !== undefined;
      const translation = t(
        this.locale,
        category,
        canonicalId,
        sourceFile,
        false,
      );

      if (translation !== canonicalId) {
        if (!hasLocalizedTranslation) {
          this.addWarning(
            `[i18n] Missing translation for id '${canonicalId}' in category '${category}'` +
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
