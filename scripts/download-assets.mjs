#!/usr/bin/env node
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const kind = process.argv[2];
const weaponTypes = ['bow', 'catalyst', 'claymore', 'polearm', 'sword'];
const configs = {
  weapon: {
    menuId: '4',
    noun: 'weapon',
    plural: 'weapons',
    referer: 'https://wiki.hoyolab.com/pc/genshin/aggregate/weapon',
    namesFile: path.join('src', 'i18n', 'en', 'weapons.json'),
    pageLimit: 30,
    icon: (entry) => entry?.icon_url ?? '',
    async loadLocal() {
      const entries = new Map();
      for (const type of weaponTypes) {
        const data = await readJson(
          path.join('src', 'data', 'weapons', `${type}.json`),
        );
        for (const key of Object.keys(data)) {
          if (entries.has(key)) throw new Error(`Duplicate weapon key: ${key}`);
          entries.set(key, { key, type });
        }
      }
      return entries;
    },
    output(entry) {
      return path.join(
        'public',
        'item-assets',
        'weapons',
        entry.type,
        `${entry.key}.webp`,
      );
    },
  },
  artifact: {
    menuId: '5',
    noun: 'artifact set',
    plural: 'artifact sets',
    referer: 'https://wiki.hoyolab.com/pc/genshin/aggregate/artifact',
    namesFile: path.join('src', 'i18n', 'en', 'artifact-sets.json'),
    pageLimit: 10,
    icon(entry) {
      return (
        entry?.display_field?.flower_of_life_icon_url ?? entry?.icon_url ?? ''
      );
    },
    async loadLocal() {
      const data = await readJson(
        path.join('src', 'data', 'artifacts', 'artifact_sets.json'),
      );
      return new Map(Object.keys(data).map((key) => [key, { key }]));
    },
    output(entry) {
      return path.join(
        'public',
        'item-assets',
        'artifacts',
        `${entry.key}.webp`,
      );
    },
  },
};

const config = configs[kind];
if (!config) {
  throw new Error('Expected asset kind: weapon or artifact.');
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(3),
  allowPositionals: true,
  options: {
    all: { type: 'boolean', default: false },
    file: { type: 'string', multiple: true, default: [] },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const usage = `Usage:
  npm run download:${kind}-assets -- <key> [key...]
  npm run download:${kind}-assets -- --file keys.txt
  npm run download:${kind}-assets -- --all

Options:
  --all           Download every local ${config.noun}.
  --file <path>   Read keys from a whitespace/comma/newline-separated file.
  --force         Overwrite existing files.
  --dry-run       Resolve keys and URLs without writing files.
  --help          Show this help.

Pass key=url to override HoYoWiki's icon URL.`;

if (values.help) {
  console.log(usage);
  process.exit(0);
}

const listUrl =
  'https://sg-wiki-api.hoyolab.com/hoyowiki/wapi/get_entry_page_list?lang=en-us';
const searchUrl =
  'https://sg-wiki-api.hoyolab.com/hoyowiki/wapi/search?lang=en-us&keyword=';
const entryUrl =
  'https://sg-wiki-api.hoyolab.com/hoyowiki/wapi/entry_page?lang=en-us&entry_page_id=';

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\u00e2\u0080\u0099/g, '')
    .replace(/[\u2019']/g, '')
    .replaceAll('&', ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      referer: config.referer,
      'x-rpc-wiki_app': 'genshin',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);

  const json = await response.json();
  if (json.retcode !== 0) throw new Error(`${json.retcode}: ${json.message}`);
  return json.data;
}

function getWebpUrl(imageUrl) {
  if (!imageUrl || imageUrl.includes('x-oss-process=')) return imageUrl ?? '';
  if (/bbs(-test)?\.(hoyolab|hoyoverse)\.com/.test(imageUrl)) {
    return `https://wiki.hoyolab.com/_ipx/f_webp/${encodeURI(imageUrl)}`;
  }
  if (/\.webp($|\?)/.test(imageUrl)) return imageUrl;

  const url = new URL(imageUrl);
  url.searchParams.append('x-oss-process', 'image/format,webp');
  return url.href;
}

async function fetchAllWikiEntries() {
  const entries = [];
  for (let page = 1; page <= config.pageLimit; page += 1) {
    const data = await fetchJson(listUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        menu_id: config.menuId,
        page_num: page,
        page_size: 30,
        use_es: true,
        filters: [],
      }),
    });
    const list = data?.list ?? [];
    if (!list.length) break;
    entries.push(...list);
    if (entries.length >= Number(data?.total ?? 0)) break;
  }
  return entries;
}

async function findBySearch(key, displayName) {
  if (!displayName) return undefined;

  const data = await fetchJson(
    `${searchUrl}${encodeURIComponent(displayName)}`,
  );
  const results = data?.list ?? [];
  const result =
    results.find((item) => normalizeName(item.name ?? '') === key) ??
    results.find((item) => item.name === displayName);
  if (!result?.entry_page_id || config.icon(result)) return result;

  const dataEntry = await fetchJson(
    `${entryUrl}${encodeURIComponent(result.entry_page_id)}`,
  );
  return dataEntry?.page ?? result;
}

async function requestedEntries(localEntries) {
  const rawEntries = [...positionals];
  for (const file of values.file) {
    rawEntries.push(
      ...(await readFile(file, 'utf8'))
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter((token) => token && !token.startsWith('#')),
    );
  }
  if (values.all) rawEntries.push(...localEntries.keys());
  if (!rawEntries.length) throw new Error(`Pass a key, --file, or --all.`);

  const entries = new Map();
  for (const rawEntry of rawEntries) {
    const separator = rawEntry.indexOf('=');
    const rawKey = separator === -1 ? rawEntry : rawEntry.slice(0, separator);
    const key = normalizeName(rawKey);
    if (!localEntries.has(key)) {
      throw new Error(`Unknown local ${config.noun} key: ${rawKey}`);
    }
    entries.set(key, {
      ...localEntries.get(key),
      overrideUrl: separator === -1 ? undefined : rawEntry.slice(separator + 1),
    });
  }
  return [...entries.values()];
}

async function downloadWebp(url, outputPath) {
  const response = await fetch(url, { headers: { referer: config.referer } });
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);

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
}

async function main() {
  const localEntries = await config.loadLocal();
  const names = await readJson(config.namesFile);
  const requested = await requestedEntries(localEntries);
  const wikiEntries = await fetchAllWikiEntries();
  const wikiByKey = new Map(
    wikiEntries.map((entry) => [normalizeName(entry.name ?? ''), entry]),
  );
  const failures = [];
  let downloaded = 0;
  let skipped = 0;

  for (const entry of requested) {
    const outputPath = config.output(entry);
    try {
      const wikiEntry =
        wikiByKey.get(entry.key) ??
        (await findBySearch(entry.key, names[entry.key]));
      const sourceUrl = entry.overrideUrl ?? config.icon(wikiEntry);
      const webpUrl = getWebpUrl(sourceUrl);
      if (!sourceUrl) throw new Error(`HoYoWiki has no icon URL.`);

      if (values['dry-run']) {
        console.log(`dry-run    ${entry.key} -> ${webpUrl}`);
        continue;
      }
      if (!values.force) {
        try {
          await readFile(outputPath);
          skipped += 1;
          console.log(`skip       ${entry.key}`);
          continue;
        } catch {
          // Download missing files.
        }
      }

      await downloadWebp(webpUrl, outputPath);
      downloaded += 1;
      console.log(`downloaded ${entry.key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ key: entry.key, message });
      console.error(`failed     ${entry.key}: ${message}`);
    }
  }

  console.log(
    `\nDone. downloaded=${downloaded} skipped=${skipped} failed=${failures.length}`,
  );
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
