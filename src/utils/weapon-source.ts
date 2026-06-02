const DEFAULT_WEAPON_SOURCE = 'Wish';

const FREE_WEAPON_SOURCES = new Set(['Craft', 'Fishing', 'Exploration']);

export function getWeaponSource(source?: string) {
  return source || DEFAULT_WEAPON_SOURCE;
}

export function isFreeWeaponSource(source?: string) {
  return FREE_WEAPON_SOURCES.has(source ?? '');
}
