export type WeaponPassiveValue = number | number[];

type LocalizedPassiveText = {
  en: string;
  [lang: string]: string | undefined;
};

export type WeaponPassiveText = string | LocalizedPassiveText;

type WeaponRefinementData = {
  passive?: WeaponPassiveText;
  r1?: WeaponPassiveValue[];
  r2?: WeaponPassiveValue[];
  r3?: WeaponPassiveValue[];
  r4?: WeaponPassiveValue[];
  r5?: WeaponPassiveValue[];
};

const REFINEMENT_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5'] as const;

/**
 * Wraps one passive value so popovers can style substituted numbers.
 */
function formatPassiveValue(
  value: WeaponPassiveValue | undefined,
  index?: number,
) {
  const text = Array.isArray(value) ? value.join('/') : String(value ?? '');
  const indexAttribute =
    index === undefined ? '' : ` data-refinement-value-index="${index}"`;

  return `<span class="weapon-popover-passive-value"${indexAttribute}>${text}</span>`;
}

/**
 * Selects the localized passive template with English fallback.
 */
function getPassiveText(passive: WeaponPassiveText | undefined, lang = 'en') {
  if (typeof passive === 'string') {
    return passive;
  }

  return passive?.[lang] ?? passive?.en ?? '';
}

export function getWeaponPassiveValueCount(
  passive: WeaponPassiveText | undefined,
  lang = 'en',
) {
  return getPassiveText(passive, lang).match(/\{\{value\}\}/g)?.length ?? 0;
}

/**
 * Extracts a valid refinement number from content values like `1` or `R1`.
 */
function parseRefinement(refinement?: number | string) {
  const match = String(refinement ?? '').match(/[1-5]/);
  return match ? Number(match[0]) : null;
}

/**
 * Builds a compact all-refinement value string for one placeholder.
 */
function getCombinedValue(info: WeaponRefinementData, valueIndex: number) {
  const values = REFINEMENT_KEYS.map((key) => info[key]?.[valueIndex]);
  const separator = values.some(Array.isArray) ? ' / ' : '/';

  return values
    .map((value) =>
      Array.isArray(value)
        ? `(${formatPassiveValue(value)})`
        : formatPassiveValue(value),
    )
    .join(separator);
}

/**
 * Replaces passive placeholders with either one refinement's values or all
 * refinement values when no specific refinement is available.
 */
export function formatWeaponPassive(
  info: WeaponRefinementData,
  refinement?: number | string,
  lang = 'en',
  trackValues = false,
) {
  const passive = getPassiveText(info.passive, lang);
  const selectedRefinement = parseRefinement(refinement);
  let valueIndex = 0;

  return passive.replace(/\{\{value\}\}/g, () => {
    const index = valueIndex;
    valueIndex += 1;

    if (selectedRefinement) {
      const refinementKey = `r${selectedRefinement}` as (typeof REFINEMENT_KEYS)[number];
      return formatPassiveValue(
        info[refinementKey]?.[index],
        trackValues ? index : undefined,
      );
    }

    return getCombinedValue(info, index);
  });
}
