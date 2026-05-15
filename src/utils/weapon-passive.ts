export type WeaponPassiveValue = number | number[];

export type LocalizedPassiveText = {
  en: string;
  [lang: string]: string | undefined;
};

export type WeaponPassiveText = string | LocalizedPassiveText;

export type WeaponRefinementData = {
  passive?: WeaponPassiveText;
  r1?: WeaponPassiveValue[];
  r2?: WeaponPassiveValue[];
  r3?: WeaponPassiveValue[];
  r4?: WeaponPassiveValue[];
  r5?: WeaponPassiveValue[];
};

const REFINEMENT_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5'] as const;

function formatPassiveValue(value: WeaponPassiveValue | undefined) {
	const text = Array.isArray(value) ? value.join('/') : String(value ?? '');

	return `<span class="weapon-popover-passive-value">${text}</span>`;
}

function getPassiveText(passive: WeaponPassiveText | undefined, lang = 'en') {
  if (typeof passive === 'string') {
    return passive;
  }

  return passive?.[lang] ?? passive?.en ?? '';
}

function parseRefinement(refinement?: number | string) {
  const match = String(refinement ?? '').match(/[1-5]/);
  return match ? Number(match[0]) : null;
}

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
) {
  const passive = getPassiveText(info.passive, lang);
  const selectedRefinement = parseRefinement(refinement);
  let valueIndex = 0;

  return passive.replace(/\{\{value\}\}/g, () => {
    const index = valueIndex;
    valueIndex += 1;

    if (selectedRefinement) {
      const refinementKey = `r${selectedRefinement}` as (typeof REFINEMENT_KEYS)[number];
      return formatPassiveValue(info[refinementKey]?.[index]);
    }

    return getCombinedValue(info, index);
  });
}
