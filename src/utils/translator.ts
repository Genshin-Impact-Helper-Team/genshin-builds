import { formatMissingTranslationWarning, t } from './i18n';
import translationAliases from '../data/translation-aliases.json';
import {
  formatWeaponPassive,
  type WeaponPassiveText,
  type WeaponPassiveValue,
} from './weapon-passive';
import { getWeaponSource } from './weapon-source';
import {
  resolveArtifactAssetUrl,
  resolveWeaponAssetUrlById,
} from './item-assets';

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
  source?: string;
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
  rotationPopovers?: boolean;
};

type TranslationAliasCategory = Partial<
  Record<InlineTranslationCategory, Record<string, string>>
>;

const aliases = translationAliases as TranslationAliasCategory;

const INLINE_TRANSLATION_TOKEN_PATTERN =
  /\[\[(?:(set|weapon|character|stat|element|ability):)?([a-z0-9%/-]+)(?:\|([^\]\n]+))?\]\]/g;
const ROTATION_POPOVER_INTRO_ID = 'Rotation notation intro';
const ROTATION_POPOVER_NUMBER_INTRO_ID = 'Rotation notation number intro';
const ROTATION_POPOVER_EXAMPLE_ID = 'Rotation notation example';
const ROTATION_POPOVER_ACTION_ROWS = [
  { key: 'N/NA', valueId: 'Rotation notation N/NA' },
  { key: 'E', valueId: 'Rotation notation E' },
  { key: 'Q/Ult/A', valueId: 'Rotation notation Q/Ult' },
  { key: 'C/CA', valueId: 'Rotation notation C/CA' },
  { key: 'P', valueId: 'Rotation notation P' },
  { key: 'D', valueId: 'Rotation notation D' },
  { key: 'J', valueId: 'Rotation notation J' },
  { key: 'W', valueId: 'Rotation notation W' },
  { key: '(text)', valueId: 'Rotation notation text' },
] as const;
const ROTATION_POPOVER_NUMBER_ROWS = [
  { key: 'N#', valueId: 'Rotation notation N#' },
  { key: '#[combo]', valueId: 'Rotation notation #[combo]' },
] as const;

/**
 * Escapes dynamic text before inserting it into generated popover HTML.
 */
function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats weapon stat values as level 1 / max when both are available.
 */
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
 * Translates a weapon source enum while falling back to the stored value.
 */
function translateWeaponSource(locale: any, source?: string) {
  const sourceName = getWeaponSource(source);
  const translationKey = `Weapon source ${sourceName}`;
  const translatedSource = t(locale, 'ui', translationKey, undefined, false);

  return translatedSource === translationKey ? sourceName : translatedSource;
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
        formatMissingTranslationWarning(this.lang, id, category, sourceFile),
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
   * - [[weapon:the-catch|custom visible text]]
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
    const translatedText = text.replace(
      INLINE_TRANSLATION_TOKEN_PATTERN,
      (
        match,
        category: InlineTranslationCategory | undefined,
        id: string,
        label: string | undefined,
      ) => {
        const translation = this.translateInlineId(
          id,
          category,
          sourceFile,
          options,
          label,
        );

        return translation ?? match;
      },
    );

    return options.rotationPopovers
      ? this.renderRotationPopovers(translatedText)
      : translatedText;
  }

  /**
   * Replaces rotation notation markers with inline popovers.
   *
   * Contributors can write `{rot:N2C}` or `{rot:Q > N2 E}` in note text. The
   * notation inside the marker remains visible, and the popover always shows
   * the localized rotation legend.
   */
  private renderRotationPopovers(text: string) {
    return text.replace(/\{rot:([^}\n]+)\}/g, (match, notation: string) => {
      const trimmedNotation = notation.trim();

      return trimmedNotation
        ? this.renderRotationPopover(trimmedNotation)
        : match;
    });
  }

  /**
   * Builds the inline HTML for one rotation notation popover.
   */
  private renderRotationPopover(notation: string) {
    return [
      '<span class="info-popover rotation-popover">',
      '<button class="info-popover-trigger rotation-popover-trigger" type="button" aria-expanded="false">',
      escapeHtml(notation),
      '</button>',
      '<span class="info-popover-card rotation-popover-card" role="tooltip">',
      '<span class="rotation-popover-intro">',
      escapeHtml(
        t(this.locale, 'ui', ROTATION_POPOVER_INTRO_ID, undefined, false),
      ),
      '</span>',
      '<span class="rotation-popover-legend">',
      this.renderRotationPopoverRows(ROTATION_POPOVER_ACTION_ROWS),
      '</span>',
      '<span class="rotation-popover-note">',
      escapeHtml(
        t(
          this.locale,
          'ui',
          ROTATION_POPOVER_NUMBER_INTRO_ID,
          undefined,
          false,
        ),
      ),
      '</span>',
      '<span class="rotation-popover-legend">',
      this.renderRotationPopoverRows(ROTATION_POPOVER_NUMBER_ROWS),
      '</span>',
      '<span class="rotation-popover-note">',
      escapeHtml(
        t(this.locale, 'ui', ROTATION_POPOVER_EXAMPLE_ID, undefined, false),
      ),
      '</span>',
      '</span>',
      '</span>',
    ].join('');
  }

  /**
   * Builds the formatted key/value rows used inside the rotation legend.
   */
  private renderRotationPopoverRows(
    rows: readonly { key: string; valueId: string }[],
  ) {
    return rows
      .map((row) =>
        [
          '<span class="rotation-popover-row">',
          '<strong class="rotation-popover-key">',
          escapeHtml(row.key),
          '</strong>',
          ' = ',
          escapeHtml(t(this.locale, 'ui', row.valueId, undefined, false)),
          '</span>',
        ].join(''),
      )
      .join('');
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
   * @param label Optional text to show instead of the localized dictionary value.
   * @returns Localized or fallback string, or null if no translation exists.
   */
  private translateInlineId(
    id: string,
    category?: InlineTranslationCategory,
    sourceFile?: string,
    options: TranslateNoteTextOptions = {},
    label?: string,
  ) {
    const displayLabel = label?.trim();

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

      const displayName = displayLabel || translation;

      if (translationCategory === 'weapon' && options.weaponPopovers) {
        return this.renderWeaponPopover(canonicalId, translation, displayName);
      }

      if (translationCategory === 'artifact' && options.artifactPopovers) {
        return this.renderArtifactPopover(
          canonicalId,
          translation,
          displayName,
        );
      }

      return displayLabel ? escapeHtml(displayLabel) : translation;
    }

    return this.findTranslationInAnyCategory(id, sourceFile, displayLabel);
  }

  /**
   * Maps inline token category aliases to real translation dictionaries.
   */
  private toTranslationCategory(category: InlineTranslationCategory) {
    return category === 'set' ? 'artifact' : category;
  }

  /**
   * Resolves a short alias into its canonical translation ID.
   */
  resolveAlias(category: TranslationCategory, id: string) {
    const aliasCategory = category === 'artifact' ? 'set' : category;

    return aliases[aliasCategory]?.[id] ?? id;
  }

  /**
   * Builds the inline HTML for a weapon translation token popover.
   */
  private renderWeaponPopover(id: string, name: string, label = name) {
    const info = this.weaponDataById[id];

    if (!info) {
      return escapeHtml(label);
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
    const sourceName = translateWeaponSource(this.locale, info.source);
    const sourceFooter = sourceName
      ? [
          '<span class="weapon-popover-source"><span>',
          escapeHtml(t(this.locale, 'ui', 'Source', undefined, false)),
          '</span><strong>',
          escapeHtml(sourceName),
          '</strong></span>',
        ].join('')
      : '';
    const imageUrl = resolveWeaponAssetUrlById(id);
    const imageMarkup = imageUrl
      ? [
          '<span class="info-popover-image weapon-popover-image"><img src="',
          escapeHtml(imageUrl),
          '" alt="" loading="lazy" decoding="async"></span>',
        ].join('')
      : '';

    return [
      '<span class="info-popover weapon-popover">',
      '<button class="info-popover-trigger" type="button" aria-expanded="false">',
      escapeHtml(label),
      '</button>',
      '<span class="info-popover-card" role="tooltip">',
      '<span class="info-popover-header',
      imageUrl ? ' has-image' : '',
      '">',
      imageMarkup,
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
      sourceFooter,
      '</span>',
      '</span>',
    ].join('');
  }

  /**
   * Selects a localized artifact set effect with English fallback.
   */
  private getLocalizedArtifactEffect(effect?: LocalizedArtifactEffect) {
    if (!effect) return '';

    return effect[this.lang] ?? effect.en ?? '';
  }

  /**
   * Builds the inline HTML for an artifact set translation token popover.
   */
  private renderArtifactPopover(id: string, name: string, label = name) {
    const info = this.artifactSetDataById[id];

    if (!info) {
      return escapeHtml(label);
    }

    const effectRows = [
      { label: '1P', value: this.getLocalizedArtifactEffect(info['1p']) },
      { label: '2P', value: this.getLocalizedArtifactEffect(info['2p']) },
      { label: '4P', value: this.getLocalizedArtifactEffect(info['4p']) },
    ].filter((row) => row.value);
    const imageUrl = resolveArtifactAssetUrl(id);
    const imageMarkup = imageUrl
      ? [
          '<span class="info-popover-image artifact-popover-image"><img src="',
          escapeHtml(imageUrl),
          '" alt="" loading="lazy" decoding="async"></span>',
        ].join('')
      : '';

    return [
      '<span class="info-popover artifact-popover">',
      '<button class="info-popover-trigger artifact-popover-trigger" type="button" aria-expanded="false">',
      escapeHtml(label),
      '</button>',
      '<span class="info-popover-card artifact-popover-card" role="tooltip">',
      '<span class="info-popover-header',
      imageUrl ? ' has-image' : '',
      '">',
      imageMarkup,
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
   * @param label Optional text to show instead of the localized dictionary value.
   * @returns Localized or fallback string, or null if no category contains it.
   */
  private findTranslationInAnyCategory(
    id: string,
    sourceFile?: string,
    label?: string,
  ) {
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
            formatMissingTranslationWarning(
              this.lang,
              canonicalId,
              category,
              sourceFile,
            ),
          );
        }

        return label ? escapeHtml(label) : translation;
      }
    }

    this.addWarning(
      formatMissingTranslationWarning(this.lang, id, undefined, sourceFile),
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
