import fs from 'fs';
import path from 'path';
import artifactSets from '../data/artifacts/artifact_sets.json';
import { getLocale, t } from './i18n';
import { readJSONFile } from './content';
import { resolveArtifactAssetUrl, resolveWeaponAssetUrlById } from './item-assets';
import {
  formatWeaponPassive,
  type WeaponPassiveText,
  type WeaponPassiveValue,
} from './weapon-passive';
import { getWeaponSource } from './weapon-source';

type WeaponData = {
  rarity: number;
  source?: string;
  passive?: WeaponPassiveText;
  r1?: WeaponPassiveValue[];
  r2?: WeaponPassiveValue[];
  r3?: WeaponPassiveValue[];
  r4?: WeaponPassiveValue[];
  r5?: WeaponPassiveValue[];
  substat?: string;
  level_1?: { base_attack?: number; substat_value?: string };
  level_max?: { base_attack?: number; substat_value?: string };
};

type LocalizedEffect = { en?: string; [lang: string]: string | undefined };
type ArtifactSetData = {
  rarity: number;
  '1p'?: LocalizedEffect;
  '2p'?: LocalizedEffect;
  '4p'?: LocalizedEffect;
};

type PopoverData = Record<string, { html: string; cardClass?: string }>;

const weaponDataPath = path.resolve('src/data/weapons');
const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatStatValue = (
  level1?: number | string,
  levelMax?: number | string,
) => {
  if (level1 === undefined || level1 === null || level1 === '') return '';
  if (levelMax === undefined || levelMax === null || levelMax === '') {
    return String(level1);
  }
  return `${level1} / ${levelMax}`;
};

function weaponPopoverHtml(
  id: string,
  info: WeaponData,
  locale: any,
  lang: string,
) {
  const name = t(locale, 'weapon', id, undefined, false);
  const imageUrl = resolveWeaponAssetUrlById(id);
  const source = getWeaponSource(info.source);
  const sourceKey = `Weapon source ${source}`;
  const translatedSource = t(locale, 'ui', sourceKey, undefined, false);
  const sourceName = translatedSource === sourceKey ? source : translatedSource;
  const substatName = info.substat
    ? t(locale, 'stat', info.substat, undefined, false)
    : '';
  const passivePanels = [1, 2, 3, 4, 5]
    .map(
      (refinement) =>
        `<span class="weapon-popover-passive-refinement" data-refinement-panel="r${refinement}"${refinement === 1 ? '' : ' hidden'}>${formatWeaponPassive(info, refinement, lang)}</span>`,
    )
    .join('');

  return [
    `<span class="info-popover-header${imageUrl ? ' has-image' : ''}">`,
    imageUrl
      ? `<span class="info-popover-image weapon-popover-image"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async"></span>`
      : '',
    `<span class="info-popover-name">${escapeHtml(name)}</span>`,
    `<span class="info-popover-rarity">${escapeHtml(info.rarity)} \u2605</span>`,
    '</span>',
    `<span class="info-popover-stat"><span>Base ATK</span><strong>${escapeHtml(formatStatValue(info.level_1?.base_attack, info.level_max?.base_attack))}</strong></span>`,
    substatName
      ? `<span class="info-popover-stat"><span>${escapeHtml(substatName)}</span><strong>${escapeHtml(formatStatValue(info.level_1?.substat_value, info.level_max?.substat_value))}</strong></span>`
      : '',
    '<span class="weapon-popover-refinement">',
    [1, 2, 3, 4, 5]
      .map(
        (refinement) =>
          `<button class="weapon-popover-refinement-button" type="button" data-refinement="r${refinement}" aria-pressed="${refinement === 1}">R${refinement}</button>`,
      )
      .join(''),
    '</span>',
    `<span class="weapon-popover-passive">${passivePanels}</span>`,
    `<span class="weapon-popover-source"><span>${escapeHtml(t(locale, 'ui', 'Source', undefined, false))}</span><strong>${escapeHtml(sourceName)}</strong></span>`,
  ].join('');
}

function artifactPopoverHtml(
  id: string,
  info: ArtifactSetData,
  locale: any,
  lang: string,
) {
  const translatedName = t(locale, 'artifact', id, undefined, false);
  const name =
    translatedName === id
      ? t(locale, 'stat', id, undefined, false)
      : translatedName;
  const imageUrl = resolveArtifactAssetUrl(id);
  const effects = (['1p', '2p', '4p'] as const)
    .map((key) => ({
      label: key.toUpperCase(),
      value: info[key]?.[lang] ?? info[key]?.en ?? '',
    }))
    .filter((effect) => effect.value);

  return [
    `<span class="info-popover-header${imageUrl ? ' has-image' : ''}">`,
    imageUrl
      ? `<span class="info-popover-image artifact-popover-image"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async"></span>`
      : '',
    `<span class="info-popover-name">${escapeHtml(name)}</span>`,
    `<span class="info-popover-rarity">${escapeHtml(info.rarity)} \u2605</span>`,
    '</span>',
    ...effects.map(
      (effect) =>
        `<span class="info-popover-stat artifact-popover-effect"><span>${effect.label}</span><strong>${escapeHtml(effect.value).replace(/&lt;br\s*\/?&gt;/gi, '<br>')}</strong></span>`,
    ),
  ].join('');
}

export function getPopoverData(lang: string): PopoverData {
  const locale = getLocale(lang);
  const weaponData = fs
    .readdirSync(weaponDataPath)
    .filter((fileName) => fileName.endsWith('.json'))
    .reduce<Record<string, WeaponData>>((all, fileName) => {
      Object.assign(all, readJSONFile(path.join(weaponDataPath, fileName)));
      return all;
    }, {});
  const popovers: PopoverData = {};

  for (const [id, info] of Object.entries(weaponData)) {
    popovers[`weapon:${id}`] = { html: weaponPopoverHtml(id, info, locale, lang) };
  }
  for (const [id, info] of Object.entries(
    artifactSets as Record<string, ArtifactSetData>,
  )) {
    popovers[`artifact:${id}`] = {
      html: artifactPopoverHtml(id, info, locale, lang),
      cardClass: 'artifact-popover-card',
    };
  }

  return popovers;
}
