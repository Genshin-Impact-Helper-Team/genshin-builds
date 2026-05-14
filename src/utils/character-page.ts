import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import {
    getPublicCharacterName,
    parsePublicCharacterSlug,
} from './character-slugs';
import { findCharacterPath, loadJSON, toTitleCase } from './content';
import { getLocale, t } from './i18n';
import { collectNotes, collectSectionNotes, collectStatNotes } from './notes';
import { TranslationHelper } from './translator';

type CharacterPathParam = string | string[] | undefined;

type CharacterPageDataOptions = {
    lang?: string;
    characterPath: CharacterPathParam;
    contentBase?: string;
};

type BuildContext = {
    buildPath: string;
    buildName: string;
    lang: string;
    locale: any;
    translator: TranslationHelper;
};

/**
 * Localized editorial note used by build-notes.json.
 *
 * English is required because it is the fallback when the requested language
 * is missing. Any other language key is allowed, for example fr, es, it, or ru.
 */
type LocalizedBuildNote = {
    en: string;
    [lang: string]: string;
};

/**
 * Resolves the expected path for a build-level JSON file.
 *
 * @param buildPath Absolute path to a build directory.
 * @param fileName JSON file name.
 * @returns Absolute file path.
 */
const fileInBuild = (buildPath: string, fileName: string) =>
    path.join(buildPath, fileName);

/**
 * Renders Markdown text to HTML.
 *
 * @param value Markdown source text.
 * @returns Rendered HTML string.
 */
const renderMarkdown = (value: string) => marked.parse(value) as string;

/**
 * Converts Astro's catch-all character param into the stable character slug.
 *
 * Astro may provide `[...character]` as an array, so nested path segments are
 * joined before content lookup.
 */
function normalizeCharacterParam(characterPath: CharacterPathParam) {
    return Array.isArray(characterPath) ? characterPath.join('/') : characterPath;
}

/**
 * Translates a stat ID from either a raw string item or an object item.
 *
 * Stat JSON supports both "er" and `{ "name": "er", ... }` forms.
 */
function translateStatValue(locale: any, value: any, sourceFile: string) {
    return t(
        locale,
        'stat',
        typeof value === 'string' ? value : value.name,
        sourceFile,
        false,
    );
}

/**
 * Normalizes one stat entry into an object with a translated display name.
 */
function translateStatItem(
    locale: any,
    item: any,
    sourceFile: string,
    translator?: TranslationHelper,
) {
    return typeof item === 'string'
        ? { name: translateStatValue(locale, item, sourceFile) }
        : {
            ...item,
            name:
                typeof item.name === 'string' && item.name.includes('[[')
                    ? translator?.translateNoteText(item.name, sourceFile) ?? item.name
                    : translateStatValue(locale, item, sourceFile),
        };
}

/**
 * Normalizes one substat priority row.
 *
 * A row may be a single stat, or an alternative group shaped as
 * `{ "items": ["atk%", "em"] }`. The first item keeps the rank number and
 * later items render as approximate alternatives.
 */
function translateSubstatPriorityItem(
    locale: any,
    item: any,
    sourceFile: string,
    translator: TranslationHelper,
) {
    if (item && Array.isArray(item.items)) {
        return {
            ...item,
            items: item.items.map((stat: any) =>
                translateStatItem(locale, stat, sourceFile, translator),
            ),
        };
    }

    return translateStatItem(locale, item, sourceFile, translator);
}

function translateArtifactSetName(
    translator: TranslationHelper,
    locale: any,
    id: string,
    sourceFile: string,
) {
    const artifactName = t(locale, 'artifact', id, sourceFile, false);

    if (artifactName !== id) {
        return artifactName;
    }

    return translator.translate('stat', id, sourceFile);
}

function translateArtifactSetItem(
    translator: TranslationHelper,
    locale: any,
    item: any,
    sourceFile: string,
) {
    return {
        ...item,
        name: translateArtifactSetName(translator, locale, item.name, sourceFile),
    };
}

function translateArtifactSetGroup(
    translator: TranslationHelper,
    locale: any,
    group: any,
    sourceFile: string,
) {
    return {
        ...group,
        items: group.items.map((item: any) =>
            translateArtifactSetItem(translator, locale, item, sourceFile),
        ),
    };
}

function translateTalentItem(
    translator: TranslationHelper,
    item: any,
    sourceFile: string,
) {
    if (typeof item?.name !== 'string') return item;

    if (item.name.includes('[[')) {
        return {
            ...item,
            name: translator.translateNoteText(item.name, sourceFile),
        };
    }

    // Lowercase slug names are treated as i18n IDs. Existing display strings
    // such as "Normal Attack" remain valid legacy content.
    if (/^[a-z0-9-]+$/.test(item.name)) {
        return {
            ...item,
            name: translator.translate('ability', item.name, sourceFile),
        };
    }

    return item;
}

function getArtifactSetNoteGroups(artifactSets: any) {
    return [
        ...artifactSets.artifact_sets.flatMap((rank: any) => rank.groups),
        ...(artifactSets.conditional ?? []),
    ];
}

/**
 * Translates all artifact main stat slots while preserving their slot groups.
 */
function translateMainStats(
    locale: any,
    mainstats: any,
    sourceFile: string,
    translator: TranslationHelper,
) {
    return {
        sands: mainstats.main_stats.sands.map((item: any) =>
            translateStatItem(locale, item, sourceFile, translator),
        ),
        goblet: mainstats.main_stats.goblet.map((item: any) =>
            translateStatItem(locale, item, sourceFile, translator),
        ),
        circlet: mainstats.main_stats.circlet.map((item: any) =>
            translateStatItem(locale, item, sourceFile, translator),
        ),
    };
}

/**
 * Collects notes from sands, goblet, and circlet into one main-stat note list.
 */
function collectMainStatNotes(
    mainStats: any,
    sourceFile: string,
    lang: string,
    translator: TranslationHelper,
) {
    return ['sands', 'goblet', 'circlet'].flatMap((slot) =>
        collectStatNotes(
            mainStats[slot],
            (stat: { name: any }) => stat.name,
            sourceFile,
            lang,
            translator,
        ),
    );
}

/**
 * Localizes and renders build-level editorial notes.
 *
 * Expected shape:
 * `{ "notes": [{ "en": "...", "fr": "...", "es": "..." }] }`
 *
 * Each note must include `en`; the requested language falls back to English.
 * Note text may contain inline translation tokens and Markdown.
 */
function buildLocalizedNotes(
    buildNoteData: any,
    sourceFile: string,
    lang: string,
    translator: TranslationHelper,
) {
    if (!buildNoteData) return null;

    const notes: LocalizedBuildNote[] = Array.isArray(buildNoteData.notes)
        ? buildNoteData.notes
        : [];

    return {
        ...buildNoteData,
        notes: notes.map((note) => {
            if (!note.en) {
                throw new Error(
                    `Build note is missing required English text (source: ${sourceFile})`,
                );
            }

            return renderMarkdown(
                translator.translateNoteText(note[lang] ?? note.en, sourceFile),
            );
        }),
    };
}

/**
 * Loads and normalizes one build folder for rendering.
 *
 * This keeps file-system content, i18n IDs, localized notes, Markdown, and
 * warning collection out of the Astro route and away from presentation
 * components.
 */
function loadBuildData({
    buildPath,
    buildName,
    lang,
    locale,
    translator,
}: BuildContext) {
    const weaponsFile = fileInBuild(buildPath, 'weapons.json');
    const artifactSetsFile = fileInBuild(buildPath, 'artifacts-sets.json');
    const artifactMainstatsFile = fileInBuild(
        buildPath,
        'artifacts-mainstats.json',
    );
    const artifactSubstatsFile = fileInBuild(
        buildPath,
        'artifacts-substats.json',
    );
    const talentsFile = fileInBuild(buildPath, 'talents.json');
    const buildNotesFile = fileInBuild(buildPath, 'build-notes.json');

    const weapons = loadJSON(buildPath, 'weapons.json');

    /**
     * Translates one weapon item while preserving ranking metadata.
     *
     * @param item Raw weapon item from content JSON.
     * @returns Weapon item with a localized display name.
     */
    const translateWeaponItem = (item: any) => ({
        ...item,
        name: translator.translate('weapon', item.name, weaponsFile),
    });

    weapons.weapons = weapons.weapons.map((position: { items: any[] }) => ({
        ...position,
        items: position.items.map(translateWeaponItem),
    }));
    weapons.conditional = weapons.conditional?.map(translateWeaponItem);

    const artifacts = {
        sets: loadJSON(buildPath, 'artifacts-sets.json'),
        mainstats: loadJSON(buildPath, 'artifacts-mainstats.json'),
        substats: loadJSON(buildPath, 'artifacts-substats.json'),
    };

    // Normalize IDs into display strings before components receive the data.
    artifacts.sets.artifact_sets = artifacts.sets.artifact_sets.map(
        (rank: { groups: any[] }) => ({
            ...rank,
            groups: rank.groups.map((group: any) =>
                translateArtifactSetGroup(translator, locale, group, artifactSetsFile),
            ),
        }),
    );
    artifacts.sets.conditional = artifacts.sets.conditional?.map((group: any) =>
        translateArtifactSetGroup(translator, locale, group, artifactSetsFile),
    );

    artifacts.mainstats.main_stats = translateMainStats(
        locale,
        artifacts.mainstats,
        artifactMainstatsFile,
        translator,
    );

    artifacts.substats.substats_priority =
        artifacts.substats.substats_priority.map((item: any) =>
            translateSubstatPriorityItem(
                locale,
                item,
                artifactSubstatsFile,
                translator,
            ),
        );

    const talents = loadJSON(buildPath, 'talents.json');
    talents.talents = talents.talents.map((priority: { items: any[] }) => ({
        ...priority,
        items: priority.items.map((item) =>
            translateTalentItem(translator, item, talentsFile),
        ),
    }));

    const notes = {
        weapons: {
            global: collectSectionNotes(weapons, weaponsFile, lang, translator),
            items: collectNotes(
                [
                    ...weapons.weapons,
                    ...(weapons.conditional ? [{ items: weapons.conditional }] : []),
                ],
                (weapon: { name: any }) => weapon.name,
                weaponsFile,
                lang,
                translator,
            ),
        },
        artifacts: {
            global: [
                ...collectSectionNotes(
                    artifacts.sets,
                    artifactSetsFile,
                    lang,
                    translator,
                ),
                ...collectSectionNotes(
                    artifacts.mainstats,
                    artifactMainstatsFile,
                    lang,
                    translator,
                ),
                ...collectSectionNotes(
                    artifacts.substats,
                    artifactSubstatsFile,
                    lang,
                    translator,
                ),
            ],
            sets: collectNotes(
                getArtifactSetNoteGroups(artifacts.sets),
                (artifact: { name: any; pieces: any }) =>
                    `${artifact.name} (${artifact.pieces})`,
                artifactSetsFile,
                lang,
                translator,
            ),
            mainstats: collectMainStatNotes(
                artifacts.mainstats.main_stats,
                artifactMainstatsFile,
                lang,
                translator,
            ),
            substats: collectStatNotes(
                artifacts.substats.substats_priority,
                (stat: { name: any }) => stat.name,
                artifactSubstatsFile,
                lang,
                translator,
            ),
        },
        talents: {
            global: collectSectionNotes(talents, talentsFile, lang, translator),
            items: collectNotes(
                talents.talents,
                (talent: { name: any }) => talent.name,
                talentsFile,
                lang,
                translator,
            ),
        },
    };

    const buildNoteData = loadJSON(buildPath, 'build-notes.json');
    const rawBuildName =
        buildNoteData?.name?.[lang] ?? buildNoteData?.name?.en ?? buildName;

    // Build cards only deal with display-ready data and pre-rendered note HTML.
    return {
        name: translator.translateNoteText(rawBuildName, buildNotesFile),
        isBest: buildNoteData?.best === true,
        slug: buildName,
        weapons,
        artifacts,
        talents,
        notes,
        buildNote: buildLocalizedNotes(
            buildNoteData,
            buildNotesFile,
            lang,
            translator,
        ),
    };
}

/**
 * Builds all server-side data needed by the character page route.
 *
 * Resolves the character folder, loads metadata, normalizes every build, and
 * returns accumulated translation warnings so the page can forward them to the
 * browser console.
 */
export function getCharacterPageData({
    lang,
    characterPath,
    contentBase = path.resolve('src/content'),
}: CharacterPageDataOptions) {
    const character = normalizeCharacterParam(characterPath);

    if (!character) {
        throw new Error('Character parameter is required');
    }

    const currentLang = lang ?? 'en';
    const locale = getLocale(currentLang);
    const translator = new TranslationHelper(locale);
    const characterSlug = character.toLowerCase();
    const slugParts = parsePublicCharacterSlug(characterSlug);
    const contentSlug = slugParts.character;
    const foundPath = findCharacterPath(contentBase, characterSlug);

    if (!foundPath) {
        throw new Error('Character not found');
    }

    // Each child directory is treated as one playable build/role.
    const buildNames = fs
        .readdirSync(foundPath.path)
        .filter((fileName) =>
            fs.statSync(path.join(foundPath.path, fileName)).isDirectory(),
        );

    const translatedCharacterName = translator.translate(
        'character',
        contentSlug,
        'metadata.json',
    );

    return {
        characterSlug,
        characterName:
            slugParts.element
                ? getPublicCharacterName(locale, slugParts)
                : translatedCharacterName !== contentSlug
                    ? translatedCharacterName
                    : toTitleCase(contentSlug),
        metadata: loadJSON(foundPath.path, 'metadata.json'),
        element: foundPath.element,
        lang: currentLang,
        locale,
        builds: buildNames.map((buildName) =>
            loadBuildData({
                buildPath: path.join(foundPath.path, buildName),
                buildName,
                lang: currentLang,
                locale,
                translator,
            }),
        ),
        warnings: translator.getWarnings(),
    };
}
