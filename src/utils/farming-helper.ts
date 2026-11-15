import path from 'node:path';
import translationAliases from '../data/translation-aliases.json';
import {
    getPublicCharacterName,
    getPublicCharacterSlug,
} from './character-slugs';
import {
    getCharacterBuilds,
    getContentCharacters,
} from './content-tree';
import { loadJSON, readJSONFile } from './content';
import { getLocale, t } from './i18n';
import { resolveArtifactAssetImage } from './item-assets';
import { localizedPath } from './paths';

const MINIMUM_CHARACTER_SHARE = 0.01;
const artifactSets = readJSONFile(
    path.resolve('src/data/artifacts/artifact_sets.json'),
) as Record<string, ArtifactSetInfo>;
const setAliases =
    (translationAliases as { set?: Record<string, string> }).set ?? {};
const setIdsByTag = new Map<string, string[]>();

for (const [setId, artifactSet] of Object.entries(artifactSets)) {
    for (const tag of artifactSet.tags ?? []) {
        const setIds = setIdsByTag.get(tag) ?? [];
        setIds.push(setId);
        setIdsByTag.set(tag, setIds);
    }
}

type ArtifactSetInfo = {
    rarity?: number;
    tags?: string[];
    '2p'?: Record<string, string | undefined>;
    '4p'?: Record<string, string | undefined>;
};

type ArtifactSetItem = {
    name?: string;
    pieces?: number | string;
};

type ArtifactSetGroup = {
    items?: ArtifactSetItem[];
    choices?: { items?: ArtifactSetItem[] }[];
};

type ArtifactSetRecommendations = {
    artifact_sets?: { groups?: ArtifactSetGroup[] }[];
    conditional?: (ArtifactSetGroup & { groups?: ArtifactSetGroup[] })[];
};

type ArtifactStat = string | { name?: string };

type SubstatPriority = ArtifactStat | { items: ArtifactStat[] };

type BuildArtifactStats = {
    main_stats?: Partial<Record<MainStatSlot, ArtifactStat[]>>;
    substats_priority?: SubstatPriority[];
};

type MainStatSlot = 'sands' | 'goblet' | 'circlet';

type CharacterSummary = {
    name: string;
    href: string;
    rarity: string;
};

type CharacterSetUsage = CharacterSummary & {
    pieces: Set<number>;
};

type StatUsage = Map<string, Map<string, CharacterSetUsage>>;

type ArtifactSetUsage = {
    characters: Set<string>;
    pieces: Set<number>;
    mainStats: Record<MainStatSlot, StatUsage>;
    substats: StatUsage;
};

function createEmptySetUsage(): ArtifactSetUsage {
    return {
        characters: new Set(),
        pieces: new Set(),
        mainStats: {
            sands: new Map(),
            goblet: new Map(),
            circlet: new Map(),
        },
        substats: new Map(),
    };
}

function saveRecomendedStat(
    statUsage: StatUsage,
    stat: ArtifactStat,
    characterId: string,
    character: CharacterSummary,
    pieces: Set<number>,
): void {
    const statId = typeof stat === 'string' ? stat : stat.name;
    if (!statId) return;

    const statIds = statId === 'cr/cd' ? ['cr', 'cd'] : [statId];
    for (const id of statIds) {
        const characterUsages = statUsage.get(id) ?? new Map<string, CharacterSetUsage>();
        const existingUsage = characterUsages.get(characterId);

        if (existingUsage) {
            existingUsage.href = character.href;
            for (const piece of pieces) existingUsage.pieces.add(piece);
        } else {
            characterUsages.set(characterId, {
                ...character,
                pieces: new Set(pieces),
            });
        }

        statUsage.set(id, characterUsages);
    }
}

function getRecommendedSets(
    recommendations: ArtifactSetRecommendations | null,
): Map<string, Set<number>> {
    const matchedSets = new Map<string, Set<number>>();
    const rankedGroups =
        recommendations?.artifact_sets
            ?.slice(0, 2)
            .flatMap((rank) => rank.groups ?? []) ?? [];
    const conditionalGroups =
        recommendations?.conditional?.flatMap((recommendation) =>
            recommendation.groups ?? [{
                items: recommendation.items,
                choices: recommendation.choices,
            }],
        ) ?? [];
    const groups = [...rankedGroups, ...conditionalGroups];

    for (const group of groups) {
        const items = [
            ...(group.items ?? []),
            ...(group.choices?.flatMap((choice) => choice.items ?? []) ?? []),
        ];

        for (const item of items) {
            const pieceCount = Number(item.pieces);
            if (pieceCount !== 2 && pieceCount !== 4) continue;

            if (!item.name) continue;
            const setName = setAliases[item.name] ?? item.name;
            const setIds = artifactSets[setName]
                ? [setName]
                : setIdsByTag.get(setName) ?? [];

            for (const setId of setIds) {
                if (pieceCount === 2 && (artifactSets[setId].rarity ?? 5) < 5) {
                    continue;
                }

                const pieces = matchedSets.get(setId) ?? new Set<number>();
                pieces.add(pieceCount);
                matchedSets.set(setId, pieces);
            }
        }
    }

    return matchedSets;
}

function addBuildStatsToSet(
    usage: ArtifactSetUsage,
    characterId: string,
    character: CharacterSummary,
    pieces: Set<number>,
    mainStats: BuildArtifactStats | null,
    substats: BuildArtifactStats | null,
): void {
    usage.characters.add(characterId);

    for (const slot of ['sands', 'goblet', 'circlet'] as const) {
        for (const stat of mainStats?.main_stats?.[slot] ?? []) {
            saveRecomendedStat(
                usage.mainStats[slot],
                stat,
                characterId,
                character,
                pieces,
            );
        }
    }

    for (const priority of substats?.substats_priority ?? []) {
        const recommendedStats =
            typeof priority === 'object' && priority !== null && 'items' in priority
                ? priority.items ?? []
                : [priority];

        for (const stat of recommendedStats) {
            saveRecomendedStat(
                usage.substats,
                stat,
                characterId,
                character,
                pieces,
            );
        }
    }
}

function getSetStatRecommendations(
    statUsage: StatUsage,
    characterCount: number,
    locale: ReturnType<typeof getLocale>,
) {
    if (characterCount === 0) return [];

    return [...statUsage.entries()]
        .map(([id, characterUsages]) => ({
            id,
            name: t(locale, 'stat', id, undefined, false),
            users: [...characterUsages.values()].sort((a, b) =>
                a.name.localeCompare(b.name),
            ),
            count: characterUsages.size,
            percent: Math.round((characterUsages.size / characterCount) * 100),
        }))
        .filter((stat) => stat.count / characterCount >= MINIMUM_CHARACTER_SHARE)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getArtifactStatsData(lang = 'en') {
    const locale = getLocale(lang);
    const usageBySet = new Map<string, ArtifactSetUsage>();

    for (const contentCharacter of getContentCharacters()) {
        const characterId = getPublicCharacterSlug(contentCharacter);
        const character: CharacterSummary = {
            name: getPublicCharacterName(locale, contentCharacter),
            href: localizedPath(lang, characterId),
            rarity: contentCharacter.rarity,
        };

        for (const build of getCharacterBuilds(contentCharacter.characterPath)) {
            const buildCharacter = {
                ...character,
                href: `${character.href}?build=${encodeURIComponent(build.name)}`,
            };
            const recommendations = loadJSON(
                build.path,
                'artifacts-sets.json',
            ) as ArtifactSetRecommendations | null;
            const recommendedSets = getRecommendedSets(recommendations);

            if (recommendedSets.size === 0) continue;

            const mainStats = loadJSON(
                build.path,
                'artifacts-mainstats.json',
            ) as BuildArtifactStats | null;
            const substats = loadJSON(
                build.path,
                'artifacts-substats.json',
            ) as BuildArtifactStats | null;

            for (const [setId, pieces] of recommendedSets) {
                const usage = usageBySet.get(setId) ?? createEmptySetUsage();
                for (const piece of pieces) usage.pieces.add(piece);

                addBuildStatsToSet(
                    usage,
                    characterId,
                    buildCharacter,
                    pieces,
                    mainStats,
                    substats,
                );
                usageBySet.set(setId, usage);
            }
        }
    }

    const sets = Object.entries(artifactSets)
        .filter(([, artifactSet]) => (artifactSet.rarity ?? 0) >= 4)
        .map(([setId, artifactSet]) => {
            const usage = usageBySet.get(setId) ?? createEmptySetUsage();
            const characterCount = usage.characters.size;

            return {
                id: setId,
                name: t(locale, 'artifact', setId, undefined, false),
                image: resolveArtifactAssetImage(setId),
                rarity: artifactSet.rarity ?? 0,
                bonuses: ([2, 4] as const)
                    .map((pieces) => ({
                        pieces,
                        description:
                            artifactSet[`${pieces}p`]?.[lang] ??
                            artifactSet[`${pieces}p`]?.en ??
                            '',
                    }))
                    .filter((bonus) => bonus.description),
                usage: characterCount,
                pieces: [...usage.pieces].sort((a, b) => a - b),
                mainStats: {
                    sands: getSetStatRecommendations(
                        usage.mainStats.sands,
                        characterCount,
                        locale,
                    ),
                    goblet: getSetStatRecommendations(
                        usage.mainStats.goblet,
                        characterCount,
                        locale,
                    ),
                    circlet: getSetStatRecommendations(
                        usage.mainStats.circlet,
                        characterCount,
                        locale,
                    ),
                },
                substats: getSetStatRecommendations(
                    usage.substats,
                    characterCount,
                    locale,
                ),
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    return { lang, locale, sets };
}
