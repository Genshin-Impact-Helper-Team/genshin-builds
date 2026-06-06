#!/usr/bin/env node
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const weaponTypes = ['bow', 'catalyst', 'claymore', 'polearm', 'sword'];
const wikiListUrl =
  'https://sg-wiki-api.hoyolab.com/hoyowiki/wapi/get_entry_page_list?lang=en-us';
const wikiSearchUrl =
  'https://sg-wiki-api.hoyolab.com/hoyowiki/wapi/search?lang=en-us&keyword=';
const wikiEntryUrl =
  'https://sg-wiki-api.hoyolab.com/hoyowiki/wapi/entry_page?lang=en-us&entry_page_id=';
const wikiReferer = 'https://wiki.hoyolab.com/pc/genshin/aggregate/weapon';
const weaponMenuId = '4';

const usage = `
Usage:
  npm run download:weapon-assets -- <weapon-key> [weapon-key...]
  npm run download:weapon-assets -- --file weapons.txt
  npm run download:weapon-assets -- --all

Examples:
  npm run download:weapon-assets -- angelos-heptades
  npm run download:weapon-assets -- angelos-heptades golden-frostbound-oath
  npm run download:weapon-assets -- --force disaster-and-remorse=https://example.com/icon.png

Options:
  --all           Download every local weapon key from src/data/weapons.
  --file <path>   Read weapon keys from a whitespace/comma/newline-separated file.
  --force         Overwrite existing .webp files.
  --dry-run       Resolve keys and URLs without writing files.
  --help          Show this help.

Direct URL overrides:
  Pass key=url when HoYoWiki knows the weapon but does not expose an icon URL.
`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(usage.trim());
  process.exit(0);
}

const options = {
  all: false,
  dryRun: false,
  force: false,
  files: [],
  entries: [],
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === '--all') {
    options.all = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--force') {
    options.force = true;
  } else if (arg === '--file') {
    const file = args[index + 1];
    if (!file || file.startsWith('--')) {
      throw new Error('--file requires a path.');
    }
    options.files.push(file);
    index += 1;
  } else if (arg.startsWith('--file=')) {
    options.files.push(arg.slice('--file='.length));
  } else if (arg.startsWith('--')) {
    throw new Error(`Unknown option: ${arg}`);
  } else {
    options.entries.push(arg);
  }
}

const normalizeWeaponName = (name) =>
  name
    .toLowerCase()
    .replaceAll('â', '')
    .replace(/[’']/g, '')
    .replaceAll('&', ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, 'utf8'));

const fetchJson = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      referer: wikiReferer,
      'x-rpc-wiki_app': 'genshin',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.retcode !== 0) {
    throw new Error(`${json.retcode}: ${json.message}`);
  }

  return json.data;
};

const getWebpUrl = (imageUrl) => {
  if (!imageUrl) {
    return '';
  }

  if (imageUrl.includes('x-oss-process=')) {
    return imageUrl;
  }

  if (/bbs(-test)?\.(hoyolab|hoyoverse)\.com/.test(imageUrl)) {
    return `https://wiki.hoyolab.com/_ipx/f_webp/${encodeURI(imageUrl)}`;
  }

  if (/\.webp($|\?)/.test(imageUrl)) {
    return imageUrl;
  }

  const url = new URL(imageUrl);
  url.searchParams.append('x-oss-process', 'image/format,webp');
  return url.href;
};

const fetchAllWikiWeapons = async () => {
  const weapons = [];

  for (let page = 1; page <= 30; page += 1) {
    const data = await fetchJson(wikiListUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        menu_id: weaponMenuId,
        page_num: page,
        page_size: 30,
        use_es: true,
        filters: [],
      }),
    });

    const list = data?.list ?? [];
    if (list.length === 0) {
      break;
    }

    weapons.push(...list);

    if (weapons.length >= Number(data?.total ?? 0)) {
      break;
    }
  }

  return weapons;
};

const findWikiWeaponBySearch = async (key, displayName) => {
  if (!displayName) {
    return undefined;
  }

  const data = await fetchJson(
    `${wikiSearchUrl}${encodeURIComponent(displayName)}`,
  );
  const results = data?.list ?? [];
  const result =
    results.find((item) => normalizeWeaponName(item.name ?? '') === key) ??
    results.find((item) => item.name === displayName);

  if (!result?.entry_page_id || result.icon_url) {
    return result;
  }

  const entryData = await fetchJson(
    `${wikiEntryUrl}${encodeURIComponent(result.entry_page_id)}`,
  );
  return entryData?.page ?? result;
};

const loadLocalWeapons = async () => {
  const weapons = new Map();

  for (const type of weaponTypes) {
    const filePath = path.join('src', 'data', 'weapons', `${type}.json`);
    const data = await readJson(filePath);

    for (const key of Object.keys(data)) {
      if (weapons.has(key)) {
        throw new Error(`Duplicate weapon key across type files: ${key}`);
      }

      weapons.set(key, { key, type });
    }
  }

  return weapons;
};

const loadEnglishNames = async () => {
  const filePath = path.join('src', 'i18n', 'en', 'weapons.json');
  return readJson(filePath);
};

const readEntriesFromFiles = async (files) => {
  const entries = [];

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const tokens = content
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter((token) => token && !token.startsWith('#'));
    entries.push(...tokens);
  }

  return entries;
};

const buildRequestedEntries = async (localWeapons) => {
  const fileEntries = await readEntriesFromFiles(options.files);
  const rawEntries = [...options.entries, ...fileEntries];

  if (options.all) {
    rawEntries.push(...localWeapons.keys());
  }

  if (rawEntries.length === 0) {
    throw new Error('Pass at least one weapon key, --file, or --all.');
  }

  const entries = new Map();

  for (const rawEntry of rawEntries) {
    const separatorIndex = rawEntry.indexOf('=');
    const rawKey =
      separatorIndex === -1 ? rawEntry : rawEntry.slice(0, separatorIndex);
    const key = normalizeWeaponName(rawKey);
    const overrideUrl =
      separatorIndex === -1 ? undefined : rawEntry.slice(separatorIndex + 1);

    if (!localWeapons.has(key)) {
      throw new Error(`Unknown local weapon key: ${rawKey}`);
    }

    entries.set(key, {
      ...localWeapons.get(key),
      overrideUrl,
    });
  }

  return [...entries.values()];
};

const downloadWebp = async (url, outputPath) => {
  const response = await fetch(url, {
    headers: { referer: wikiReferer },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error('Downloaded response is not a WebP file.');
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.${process.pid}.${Date.now()}.download`;

  try {
    await writeFile(tempPath, bytes);
    await rename(tempPath, outputPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
};

const main = async () => {
  const localWeapons = await loadLocalWeapons();
  const englishNames = await loadEnglishNames();
  const requestedEntries = await buildRequestedEntries(localWeapons);
  const wikiWeapons = await fetchAllWikiWeapons();
  const wikiByKey = new Map(
    wikiWeapons.map((weapon) => [
      normalizeWeaponName(weapon.name ?? ''),
      weapon,
    ]),
  );

  const failures = [];
  let downloaded = 0;
  let skipped = 0;

  for (const entry of requestedEntries) {
    const outputPath = path.join(
      'src',
      'data',
      'assets',
      'weapons',
      entry.type,
      `${entry.key}.webp`,
    );

    try {
      const wikiWeapon =
        wikiByKey.get(entry.key) ??
        (await findWikiWeaponBySearch(entry.key, englishNames[entry.key]));
      const sourceUrl = entry.overrideUrl ?? wikiWeapon?.icon_url;
      const webpUrl = getWebpUrl(sourceUrl);

      if (!sourceUrl) {
        const name = englishNames[entry.key] ?? entry.key;
        throw new Error(`HoYoWiki has no icon URL for ${name}.`);
      }

      if (options.dryRun) {
        console.log(`dry-run    ${entry.key} -> ${webpUrl}`);
        continue;
      }

      if (!options.force) {
        try {
          await readFile(outputPath);
          skipped += 1;
          console.log(`skip       ${entry.key}`);
          continue;
        } catch {
          // Missing file is the expected download path.
        }
      }

      await downloadWebp(webpUrl, outputPath);
      downloaded += 1;
      console.log(`downloaded ${entry.key}`);
    } catch (error) {
      failures.push({
        key: entry.key,
        message: error instanceof Error ? error.message : String(error),
      });
      console.error(`failed     ${entry.key}: ${failures.at(-1).message}`);
    }
  }

  console.log(
    `\nDone. downloaded=${downloaded} skipped=${skipped} failed=${failures.length}`,
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
