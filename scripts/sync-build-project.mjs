import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const API_URL = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const PAGE_SIZE = 100;
const RELEASE_AUDIT_START =
  '<!-- genshin-build-project-sync:release-audit:start -->';
const RELEASE_AUDIT_END =
  '<!-- genshin-build-project-sync:release-audit:end -->';
const BUILD_MARKER_PREFIX = '<!-- genshin-build-project-sync:build:';
const PRE_AR_45_BUILD_SLUG = 'pre-ar45';
const CHARACTER_PRIORITY_SCORES = new Map([
  ['very low', 0],
  ['low', 0.25],
  ['normal', 0.5],
  ['high', 0.75],
  ['very high', 1],
]);

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function parsePositiveInteger(value, name, fallback) {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsed;
}

function titleKey(value) {
  return value.trim().toLocaleLowerCase('en-US');
}

function issueNodeId(issue) {
  return issue.node_id ?? issue.id;
}

function isSameIssue(left, right) {
  return Boolean(left && right && issueNodeId(left) === issueNodeId(right));
}

export function uniqueOtherIssues(issue, candidates) {
  return [
    ...new Map(
      candidates
        .filter((candidate) => candidate && !isSameIssue(candidate, issue))
        .map((candidate) => [issueNodeId(candidate), candidate]),
    ).values(),
  ];
}

export function staleBuildIssues(
  issuesByMarker,
  activeMarkers,
  activeIssueIds,
) {
  return [...issuesByMarker]
    .filter(
      ([marker, issue]) =>
        marker.startsWith(BUILD_MARKER_PREFIX) &&
        !activeMarkers.has(marker) &&
        !activeIssueIds.has(issueNodeId(issue)),
    )
    .map(([, issue]) => issue);
}

function issueLabel(issue) {
  return `${issue.title} (#${issue.number})`;
}

function hasIssueLabel(issue, labelName) {
  return (issue.labels ?? []).some((label) => {
    const currentName = typeof label === 'string' ? label : label.name;
    return (
      typeof currentName === 'string' &&
      titleKey(currentName) === titleKey(labelName)
    );
  });
}

function parentTitle(character, element) {
  return character === 'traveler' ? `${element}-traveler` : character;
}

function buildIssueTitle(characterName, buildName) {
  return `${characterName} - ${buildName}`;
}

function automationMarker(kind, sourcePath) {
  return `<!-- genshin-build-project-sync:${kind}:${sourcePath.replaceAll('\\', '/')} -->`;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${filePath}: ${error.message}`);
  }
}

function parseGameVersion(value, context) {
  const match = String(value ?? '').match(/^\s*(\d+)\.(\d+)/);

  if (!match) {
    throw new Error(
      `${context} must start with a numeric game version such as "6.6". Received ${JSON.stringify(value)}.`,
    );
  }

  return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)];
}

function compareGameVersions(left, right) {
  const [leftMajor, leftMinor] = parseGameVersion(left, 'Version');
  const [rightMajor, rightMinor] = parseGameVersion(right, 'Version');

  return leftMajor - rightMajor || leftMinor - rightMinor;
}

function gameVersionIndex(value, context) {
  const [major, minor] = parseGameVersion(value, context);
  return major * 10 + minor;
}

export function rankBuilds(builds, currentVersion) {
  const currentVersionIndex = gameVersionIndex(
    currentVersion,
    'Current game version',
  );
  const scored = builds.map((build) => {
    const characterPriority = titleKey(build.characterPriority ?? 'normal');
    const characterScore = CHARACTER_PRIORITY_SCORES.get(characterPriority);

    if (characterScore === undefined) {
      throw new Error(
        `${build.title} has unsupported character priority ${JSON.stringify(build.characterPriority)}.`,
      );
    }

    return {
      ...build,
      characterScore,
      age: Math.max(
        0,
        currentVersionIndex -
          gameVersionIndex(build.lastUpdated, `${build.title} last_updated`),
      ),
    };
  });
  const maximum = (property) =>
    Math.max(1, ...scored.map((build) => build[property]));
  const maxAge = maximum('age');
  const maxWeapons = maximum('weaponCount');
  const maxArtifactSets = maximum('artifactSetCount');

  return scored
    .map((build) => ({
      ...build,
      score:
        build.characterScore * 0.3 +
        Number(build.bestRole) * 0.2 +
        (build.age / maxAge) * 0.4 +
        (build.weaponCount / maxWeapons) * 0.05 +
        (build.artifactSetCount / maxArtifactSets) * 0.05,
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.title.localeCompare(right.title),
    )
    .map((build, index) => ({ ...build, updatePriority: index + 1 }));
}

function collectKnownIds(value, knownIds, result = new Set()) {
  if (typeof value === 'string') {
    if (knownIds.has(value)) {
      result.add(value);
    }

    for (const match of value.matchAll(
      /\[\[(?:weapon|set|artifact):([^|\]]+)/g,
    )) {
      if (knownIds.has(match[1])) {
        result.add(match[1]);
      }
    }

    return result;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectKnownIds(item, knownIds, result);
    }

    return result;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectKnownIds(item, knownIds, result);
    }
  }

  return result;
}

function loadEffectiveBuildDocuments(characterPath, buildPath) {
  const characterFiles = fs
    .readdirSync(characterPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        entry.name !== 'metadata.json',
    )
    .map((entry) => entry.name);
  const buildFiles = fs
    .readdirSync(buildPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name);
  const effectiveFiles = new Set([...characterFiles, ...buildFiles]);

  return [...effectiveFiles].map((fileName) => {
    const buildFile = path.join(buildPath, fileName);
    const effectiveFile = fs.existsSync(buildFile)
      ? buildFile
      : path.join(characterPath, fileName);

    return readJsonFile(effectiveFile);
  });
}

function makeCatalogItems(entries, translations, context) {
  return Object.entries(entries).map(([id, data]) => {
    parseGameVersion(
      data.version_released,
      `${context} ${id} version_released`,
    );

    return {
      id,
      name: translations[id] ?? id,
      version: data.version_released,
    };
  });
}

export function loadReleaseCatalog(rootDirectory = process.cwd()) {
  const dataDirectory = path.join(rootDirectory, 'src', 'data');
  const localeDirectory = path.join(rootDirectory, 'src', 'i18n', 'en');
  const weaponTranslations = readJsonFile(
    path.join(localeDirectory, 'weapons.json'),
  );
  const artifactTranslations = readJsonFile(
    path.join(localeDirectory, 'artifact-sets.json'),
  );
  const weaponsByType = new Map();
  const weaponsDirectory = path.join(dataDirectory, 'weapons');

  for (const fileName of fs
    .readdirSync(weaponsDirectory)
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const weaponType = path.basename(fileName, '.json');
    const entries = readJsonFile(path.join(weaponsDirectory, fileName));
    weaponsByType.set(
      weaponType,
      makeCatalogItems(entries, weaponTranslations, `${weaponType} weapon`),
    );
  }

  const artifactEntries = readJsonFile(
    path.join(dataDirectory, 'artifacts', 'artifact_sets.json'),
  );

  return {
    weaponsByType,
    artifactSets: makeCatalogItems(
      artifactEntries,
      artifactTranslations,
      'artifact set',
    ),
  };
}

export function latestReleaseVersion(catalog) {
  const releases = [
    ...catalog.artifactSets,
    ...[...catalog.weaponsByType.values()].flat(),
  ];

  if (releases.length === 0) {
    throw new Error('The release catalog is empty.');
  }

  return releases.reduce(
    (latest, item) =>
      compareGameVersions(item.version, latest) > 0 ? item.version : latest,
    releases[0].version,
  );
}

function sortReleaseItems(items) {
  return items.sort(
    (left, right) =>
      compareGameVersions(left.version, right.version) ||
      left.name.localeCompare(right.name),
  );
}

export function addReleaseAudits(inventory, catalog) {
  const artifactIds = new Set(catalog.artifactSets.map((item) => item.id));

  for (const character of inventory) {
    const weaponCatalog = catalog.weaponsByType.get(character.weaponType);

    if (!weaponCatalog) {
      throw new Error(
        `Unknown weapon type ${JSON.stringify(character.weaponType)} for ${character.sourcePath}.`,
      );
    }

    parseGameVersion(
      character.lastUpdated,
      `${character.sourcePath}/metadata.json last_updated`,
    );
    const weaponIds = new Set(weaponCatalog.map((item) => item.id));
    const characterPath = path.resolve(character.sourcePath);

    for (const build of character.builds) {
      const buildPath = path.resolve(build.sourcePath);
      const buildDocuments = loadEffectiveBuildDocuments(
        characterPath,
        buildPath,
      );
      const mentionedWeapons = collectKnownIds(buildDocuments, weaponIds);
      const mentionedArtifactSets = collectKnownIds(
        buildDocuments,
        artifactIds,
      );

      build.releaseAudit = {
        lastUpdated: character.lastUpdated,
        weaponType: character.weaponType,
        weapons: sortReleaseItems(
          weaponCatalog.filter(
            (item) =>
              compareGameVersions(item.version, character.lastUpdated) > 0 &&
              !mentionedWeapons.has(item.id),
          ),
        ),
        artifactSets: sortReleaseItems(
          catalog.artifactSets.filter(
            (item) =>
              compareGameVersions(item.version, character.lastUpdated) > 0 &&
              !mentionedArtifactSets.has(item.id),
          ),
        ),
      };
    }
  }

  return inventory;
}

function renderReleaseList(items) {
  if (items.length === 0) {
    return '_None._';
  }

  return items
    .map((item) => `- **${item.name}**: released in \`${item.version}\``)
    .join('\n');
}

export function renderReleaseAudit(audit) {
  if (!audit) {
    throw new Error('Build release audit data is missing.');
  }

  const weaponType =
    audit.weaponType.charAt(0).toUpperCase() + audit.weaponType.slice(1);

  return [
    RELEASE_AUDIT_START,
    `## Items released after \`${audit.lastUpdated}\``,
    '',
    'These items are not currently mentioned in this build.',
    '',
    `### ${weaponType} weapons`,
    '',
    renderReleaseList(audit.weapons),
    '',
    '### Artifact sets',
    '',
    renderReleaseList(audit.artifactSets),
    RELEASE_AUDIT_END,
  ].join('\n');
}

export function buildIssueBody(currentBody, buildMarker, audit) {
  let body = String(currentBody ?? '')
    .replaceAll('\r\n', '\n')
    .replace(/<!-- genshin-build-project-sync:build:[^>]+ -->\n*/g, '')
    .trim();

  body = [buildMarker, body].filter(Boolean).join('\n\n');

  const section = renderReleaseAudit(audit);
  const startIndex = body.indexOf(RELEASE_AUDIT_START);
  const endIndex = body.indexOf(RELEASE_AUDIT_END);

  const hasDuplicateMarkers =
    startIndex !== body.lastIndexOf(RELEASE_AUDIT_START) ||
    endIndex !== body.lastIndexOf(RELEASE_AUDIT_END);

  if (
    (startIndex === -1) !== (endIndex === -1) ||
    (startIndex !== -1 && endIndex < startIndex) ||
    hasDuplicateMarkers
  ) {
    throw new Error(
      'Build issue body contains invalid managed release-audit markers.',
    );
  }

  if (startIndex === -1) {
    return [body, section].filter(Boolean).join('\n\n');
  }

  const sectionEnd = endIndex + RELEASE_AUDIT_END.length;
  return `${body.slice(0, startIndex)}${section}${body.slice(sectionEnd)}`.trim();
}

/**
 * Reads character metadata and immediate build directories from src/content.
 * Folder names are intentionally used as issue titles because they are stable,
 * language-independent identifiers in this repository.
 */
export function loadBuildInventory(contentDirectory) {
  const characters = [];

  for (const elementEntry of fs
    .readdirSync(contentDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'site')) {
    const elementDirectory = path.join(contentDirectory, elementEntry.name);

    for (const rarityEntry of fs
      .readdirSync(elementDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())) {
      const rarityDirectory = path.join(elementDirectory, rarityEntry.name);

      for (const characterEntry of fs
        .readdirSync(rarityDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())) {
        const characterDirectory = path.join(
          rarityDirectory,
          characterEntry.name,
        );
        const metadataPath = path.join(characterDirectory, 'metadata.json');

        if (!fs.existsSync(metadataPath)) {
          continue;
        }

        const metadata = readJsonFile(metadataPath);

        if (
          typeof metadata.last_updated !== 'string' ||
          metadata.last_updated.trim().length === 0
        ) {
          throw new Error(
            `${metadataPath} must contain a non-empty string named last_updated.`,
          );
        }

        if (typeof metadata.weapon !== 'string' || !metadata.weapon) {
          throw new Error(
            `${metadataPath} must contain a non-empty string named weapon.`,
          );
        }

        const sourcePath = path
          .relative(process.cwd(), characterDirectory)
          .replaceAll('\\', '/');
        const builds = fs
          .readdirSync(characterDirectory, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isDirectory() && entry.name !== PRE_AR_45_BUILD_SLUG,
          )
          .map((entry) => {
            const buildPath = path.join(characterDirectory, entry.name);
            const buildNotesPath = path.join(buildPath, 'build-notes.json');
            const buildNotes = fs.existsSync(buildNotesPath)
              ? readJsonFile(buildNotesPath)
              : {};

            return {
              name: entry.name,
              sourcePath: `${sourcePath}/${entry.name}`,
              bestRole: buildNotes.best === true,
            };
          })
          .sort((left, right) => left.name.localeCompare(right.name));

        characters.push({
          name: parentTitle(characterEntry.name, elementEntry.name),
          sourcePath,
          lastUpdated: metadata.last_updated,
          weaponType: metadata.weapon,
          builds,
        });
      }
    }
  }

  characters.sort((left, right) => left.name.localeCompare(right.name));

  return characters;
}

class GitHubClient {
  constructor({ token, mutationDelayMs, maxRateLimitRetries }) {
    this.token = token;
    this.mutationDelayMs = mutationDelayMs;
    this.maxRateLimitRetries = maxRateLimitRetries;
    this.lastMutationStartedAt = 0;
  }

  async paceMutation() {
    const elapsed = Date.now() - this.lastMutationStartedAt;
    const remainingDelay = this.mutationDelayMs - elapsed;

    if (remainingDelay > 0) {
      await sleep(remainingDelay);
    }

    this.lastMutationStartedAt = Date.now();
  }

  rateLimitDelay(response, attempt) {
    const retryAfter = Number.parseInt(
      response.headers.get('retry-after') ?? '',
      10,
    );

    if (Number.isInteger(retryAfter)) {
      return retryAfter * 1_000;
    }

    if (response.headers.get('x-ratelimit-remaining') === '0') {
      const resetAt = Number.parseInt(
        response.headers.get('x-ratelimit-reset') ?? '',
        10,
      );

      if (Number.isInteger(resetAt)) {
        return Math.max(resetAt * 1_000 - Date.now() + 1_000, 1_000);
      }
    }

    return 60_000 * 2 ** Math.min(attempt, 5);
  }

  async request(endpoint, { method = 'GET', body, mutation = false } = {}) {
    for (let attempt = 0; ; attempt += 1) {
      if (mutation) {
        await this.paceMutation();
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'genshin-build-project-sync',
          'X-GitHub-Api-Version': API_VERSION,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const responseText = await response.text();
      let payload = null;

      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = responseText;
        }
      }

      const errorText =
        typeof payload === 'string'
          ? payload
          : [
              payload?.message,
              ...(payload?.errors ?? []).map((error) => error.message),
            ]
              .filter(Boolean)
              .join(' ');
      const isRateLimited =
        response.status === 429 ||
        ((response.status === 403 || endpoint === '/graphql') &&
          /rate limit|abuse/i.test(errorText));

      if (isRateLimited && attempt < this.maxRateLimitRetries) {
        const waitMilliseconds = this.rateLimitDelay(response, attempt);
        console.warn(
          `GitHub rate limit reached; retrying in ${Math.ceil(waitMilliseconds / 1_000)} seconds.`,
        );
        await sleep(waitMilliseconds);
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `${method} ${endpoint} failed (${response.status}): ${errorText || 'Unknown GitHub API error'}`,
        );
      }

      return { payload, headers: response.headers };
    }
  }

  async graphql(query, variables = {}, { mutation = false } = {}) {
    const { payload, headers } = await this.request('/graphql', {
      method: 'POST',
      body: { query, variables },
      mutation,
    });

    if (payload.errors?.length) {
      const errorText = payload.errors.map((error) => error.message).join('; ');

      throw new Error(`GitHub GraphQL error: ${errorText}`);
    }

    return { data: payload.data, headers };
  }
}

async function listRepositoryIssues(client, repository) {
  const issues = [];

  for (let page = 1; ; page += 1) {
    const { payload } = await client.request(
      `/repos/${repository}/issues?state=all&per_page=${PAGE_SIZE}&page=${page}`,
    );
    issues.push(...payload.filter((issue) => !issue.pull_request));

    if (payload.length < PAGE_SIZE) {
      return issues;
    }
  }
}

async function listSubIssues(client, repository, parentNumber) {
  const subIssues = [];

  for (let page = 1; ; page += 1) {
    const { payload } = await client.request(
      `/repos/${repository}/issues/${parentNumber}/sub_issues?per_page=${PAGE_SIZE}&page=${page}`,
    );
    subIssues.push(...payload);

    if (payload.length < PAGE_SIZE) {
      return subIssues;
    }
  }
}

async function createIssue(client, repository, title, body, labelName) {
  const { payload } = await client.request(`/repos/${repository}/issues`, {
    method: 'POST',
    body: { title, body, labels: [labelName] },
    mutation: true,
  });

  return payload;
}

async function addIssueLabel(client, repository, issueNumber, labelName) {
  await client.request(`/repos/${repository}/issues/${issueNumber}/labels`, {
    method: 'POST',
    body: { labels: [labelName] },
    mutation: true,
  });
}

async function updateIssue(client, repository, issueNumber, changes) {
  const { payload } = await client.request(
    `/repos/${repository}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      body: changes,
      mutation: true,
    },
  );

  return payload;
}

async function removeSubIssue(client, repository, parentNumber, subIssueId) {
  await client.request(
    `/repos/${repository}/issues/${parentNumber}/sub_issue`,
    {
      method: 'DELETE',
      body: { sub_issue_id: subIssueId },
      mutation: true,
    },
  );
}

async function deleteIssue(client, issueId) {
  await client.graphql(
    `
      mutation DeleteIssue($issueId: ID!) {
        deleteIssue(input: { issueId: $issueId }) {
          repository {
            id
          }
        }
      }
    `,
    { issueId },
    { mutation: true },
  );
}

async function loadProject(client, owner, projectNumber) {
  const { data } = await client.graphql(
    `
      query Project($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            title
            fields(first: 100) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2IterationField {
                  id
                  name
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      }
    `,
    { owner, number: projectNumber },
  );

  return data.organization?.projectV2;
}

async function createProjectField(client, projectId, fieldName, dataType) {
  const { data } = await client.graphql(
    `
      mutation CreateProjectField(
        $projectId: ID!
        $name: String!
        $dataType: ProjectV2CustomFieldType!
      ) {
        createProjectV2Field(
          input: {
            projectId: $projectId
            dataType: $dataType
            name: $name
          }
        ) {
          projectV2Field {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
          }
        }
      }
    `,
    { projectId, name: fieldName, dataType },
    { mutation: true },
  );

  return data.createProjectV2Field.projectV2Field;
}

async function createBestRoleField(client, projectId, fieldName) {
  const { data } = await client.graphql(
    `
      mutation CreateBestRoleField($projectId: ID!, $name: String!) {
        createProjectV2Field(
          input: {
            projectId: $projectId
            dataType: SINGLE_SELECT
            name: $name
            singleSelectOptions: [
              {
                name: "true"
                color: GREEN
                description: "Build notes mark this as a best role"
              }
              {
                name: "false"
                color: GRAY
                description: "Build notes do not mark this as a best role"
              }
            ]
          }
        ) {
          projectV2Field {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    `,
    { projectId, name: fieldName },
    { mutation: true },
  );

  return data.createProjectV2Field.projectV2Field;
}

async function listProjectItems(client, projectId, fieldNames) {
  const items = [];
  let after = null;

  do {
    const { data } = await client.graphql(
      `
        query ProjectItems(
          $projectId: ID!
          $lastUpdatedFieldName: String!
          $weaponCountFieldName: String!
          $artifactSetCountFieldName: String!
          $bestRoleFieldName: String!
          $characterPriorityFieldName: String!
          $updatePriorityFieldName: String!
          $after: String
        ) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $after) {
                nodes {
                  id
                  content {
                    ... on Issue {
                      id
                      number
                      title
                      url
                      repository {
                        nameWithOwner
                      }
                    }
                  }
                  lastUpdatedValue: fieldValueByName(
                    name: $lastUpdatedFieldName
                  ) {
                    ... on ProjectV2ItemFieldTextValue {
                      text
                    }
                  }
                  weaponCountValue: fieldValueByName(
                    name: $weaponCountFieldName
                  ) {
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                    }
                  }
                  artifactSetCountValue: fieldValueByName(
                    name: $artifactSetCountFieldName
                  ) {
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                    }
                  }
                  bestRoleValue: fieldValueByName(
                    name: $bestRoleFieldName
                  ) {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      optionId
                      name
                    }
                  }
                  characterPriorityValue: fieldValueByName(
                    name: $characterPriorityFieldName
                  ) {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      optionId
                      name
                    }
                  }
                  updatePriorityValue: fieldValueByName(
                    name: $updatePriorityFieldName
                  ) {
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      `,
      {
        projectId,
        lastUpdatedFieldName: fieldNames.lastUpdated,
        weaponCountFieldName: fieldNames.weaponCount,
        artifactSetCountFieldName: fieldNames.artifactSetCount,
        bestRoleFieldName: fieldNames.bestRole,
        characterPriorityFieldName: fieldNames.characterPriority,
        updatePriorityFieldName: fieldNames.updatePriority,
        after,
      },
    );
    const connection = data.node?.items;

    if (!connection) {
      throw new Error(`Could not read items for project node ${projectId}.`);
    }

    items.push(...connection.nodes);
    after = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (after);

  return items;
}

async function addProjectItem(client, projectId, contentId) {
  const { data } = await client.graphql(
    `
      mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(
          input: { projectId: $projectId, contentId: $contentId }
        ) {
          item {
            id
          }
        }
      }
    `,
    { projectId, contentId },
    { mutation: true },
  );

  return data.addProjectV2ItemById.item;
}

async function updateTextField(client, projectId, itemId, fieldId, value) {
  await client.graphql(
    `
      mutation UpdateTextField(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $value: String!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { text: $value }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `,
    { projectId, itemId, fieldId, value },
    { mutation: true },
  );
}

async function updateNumberField(client, projectId, itemId, fieldId, value) {
  await client.graphql(
    `
      mutation UpdateNumberField(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $value: Float!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { number: $value }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `,
    { projectId, itemId, fieldId, value },
    { mutation: true },
  );
}

async function updateSingleSelectField(
  client,
  projectId,
  itemId,
  fieldId,
  optionId,
) {
  await client.graphql(
    `
      mutation UpdateSingleSelectField(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $optionId: String!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { singleSelectOptionId: $optionId }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `,
    { projectId, itemId, fieldId, optionId },
    { mutation: true },
  );
}

function chooseIssue(candidates, description) {
  if (!candidates?.length) {
    return null;
  }

  const sorted = [...candidates].sort(
    (left, right) =>
      Number(right.state === 'open') - Number(left.state === 'open') ||
      left.number - right.number,
  );

  if (sorted.length > 1) {
    console.warn(
      `Multiple issues match ${description}; using ${issueLabel(sorted[0])}.`,
    );
  }

  return sorted[0];
}

function groupIssuesByTitle(issues) {
  const grouped = new Map();

  for (const issue of issues) {
    const key = titleKey(issue.title);
    grouped.set(key, [...(grouped.get(key) ?? []), issue]);
  }

  return grouped;
}

function indexIssuesByMarker(issues) {
  const indexed = new Map();

  for (const issue of issues) {
    const markers = issue.body?.match(
      /<!-- genshin-build-project-sync:[^>]+ -->/g,
    );

    for (const marker of markers ?? []) {
      indexed.set(marker, issue);
    }
  }

  return indexed;
}

function printInventory(inventory) {
  const buildCount = inventory.reduce(
    (total, character) => total + character.builds.length,
    0,
  );

  console.log(
    JSON.stringify(
      {
        characterCount: inventory.length,
        buildCount,
        characters: inventory,
      },
      null,
      2,
    ),
  );
}

export async function synchronize({
  client,
  inventory,
  repository,
  projectOwner,
  projectNumber,
  fieldName,
  weaponCountFieldName,
  artifactSetCountFieldName,
  bestRoleFieldName,
  characterPriorityFieldName,
  updatePriorityFieldName,
  currentVersion,
  labelName,
  dryRun,
}) {
  const stats = {
    issuesCreated: 0,
    issuesRenamed: 0,
    issuesDeleted: 0,
    issueBodiesUpdated: 0,
    labelsAdded: 0,
    subIssueRelationshipsRemoved: 0,
    projectItemsAdded: 0,
    fieldValuesUpdated: 0,
    unchangedFieldValues: 0,
    plannedChanges: 0,
  };
  const project = await loadProject(client, projectOwner, projectNumber);
  const expectedPriorityOptions = [...CHARACTER_PRIORITY_SCORES.keys()];
  const supportsCharacterPriorities = (field) => {
    const options = new Set(
      (field?.options ?? []).map((option) => titleKey(option.name)),
    );
    return expectedPriorityOptions.every((name) => options.has(name));
  };
  let characterPriorityField = project.fields.nodes.find(
    (field) =>
      typeof field?.name === 'string' &&
      titleKey(field.name) === titleKey(characterPriorityFieldName),
  );

  if (!characterPriorityField) {
    const compatibleFields = project.fields.nodes.filter(
      supportsCharacterPriorities,
    );
    if (compatibleFields.length === 1) {
      [characterPriorityField] = compatibleFields;
    }
  }

  if (!supportsCharacterPriorities(characterPriorityField)) {
    throw new Error(
      `Project field "${characterPriorityFieldName}" must be a single-select with Very low, Low, Normal, High, and Very high options.`,
    );
  }

  const requestedFieldNames = [
    fieldName,
    weaponCountFieldName,
    artifactSetCountFieldName,
    bestRoleFieldName,
    characterPriorityField.name,
    updatePriorityFieldName,
  ];

  if (
    requestedFieldNames.some(
      (name) => typeof name !== 'string' || name.trim().length === 0,
    ) ||
    new Set(requestedFieldNames.map(titleKey)).size !==
      requestedFieldNames.length
  ) {
    throw new Error('Project field names must be non-empty and distinct.');
  }

  const ensureProjectField = async (name, dataType) => {
    let projectField = project.fields.nodes.find(
      (candidate) =>
        candidate &&
        typeof candidate.name === 'string' &&
        titleKey(candidate.name) === titleKey(name),
    );

    if (projectField && projectField.dataType !== dataType) {
      throw new Error(
        `Project field "${projectField.name}" must have type ${dataType}, but it has type ${projectField.dataType ?? 'unknown'}.`,
      );
    }

    if (!projectField) {
      if (dryRun) {
        console.log(
          `[dry-run] Create ${dataType.toLowerCase()} project field "${name}".`,
        );
        stats.plannedChanges += 1;
        projectField = { id: null, name, dataType };
      } else {
        projectField = await createProjectField(
          client,
          project.id,
          name,
          dataType,
        );
        console.log(
          `Created ${dataType.toLowerCase()} project field "${name}".`,
        );
      }
    }

    return projectField;
  };

  const lastUpdatedField = await ensureProjectField(fieldName, 'TEXT');
  const weaponCountField = await ensureProjectField(
    weaponCountFieldName,
    'NUMBER',
  );
  const artifactSetCountField = await ensureProjectField(
    artifactSetCountFieldName,
    'NUMBER',
  );
  const updatePriorityField = await ensureProjectField(
    updatePriorityFieldName,
    'NUMBER',
  );
  let bestRoleField = project.fields.nodes.find(
    (candidate) =>
      candidate &&
      typeof candidate.name === 'string' &&
      titleKey(candidate.name) === titleKey(bestRoleFieldName),
  );

  if (bestRoleField && !Array.isArray(bestRoleField.options)) {
    throw new Error(
      `Project field "${bestRoleField.name}" must be a single-select field.`,
    );
  }

  if (!bestRoleField) {
    if (dryRun) {
      console.log(
        `[dry-run] Create single-select project field "${bestRoleFieldName}" with true/false options.`,
      );
      stats.plannedChanges += 1;
      bestRoleField = {
        id: null,
        name: bestRoleFieldName,
        options: [
          { id: null, name: 'true' },
          { id: null, name: 'false' },
        ],
      };
    } else {
      bestRoleField = await createBestRoleField(
        client,
        project.id,
        bestRoleFieldName,
      );
      console.log(
        `Created single-select project field "${bestRoleFieldName}".`,
      );
    }
  }

  const bestRoleOptions = new Map(
    bestRoleField.options.map((option) => [titleKey(option.name), option]),
  );

  if (!bestRoleOptions.has('true') || !bestRoleOptions.has('false')) {
    throw new Error(
      `Project field "${bestRoleField.name}" must contain true and false options.`,
    );
  }

  const [repositoryIssues, projectItems] = await Promise.all([
    listRepositoryIssues(client, repository),
    listProjectItems(client, project.id, {
      lastUpdated: fieldName,
      weaponCount: weaponCountFieldName,
      artifactSetCount: artifactSetCountFieldName,
      bestRole: bestRoleFieldName,
      characterPriority: characterPriorityField.name,
      updatePriority: updatePriorityFieldName,
    }),
  ]);
  const issuesByTitle = groupIssuesByTitle(repositoryIssues);
  const issuesByMarker = indexIssuesByMarker(repositoryIssues);
  const projectItemsByContentId = new Map(
    projectItems
      .filter((item) => item?.content?.id)
      .map((item) => [item.content.id, item]),
  );

  const ensureIssueLabel = async (issue) => {
    if (hasIssueLabel(issue, labelName)) {
      return;
    }

    if (dryRun) {
      console.log(
        `[dry-run] Add label "${labelName}" to ${issueLabel(issue)}.`,
      );
      stats.plannedChanges += 1;
      return;
    }

    await addIssueLabel(client, repository, issue.number, labelName);
    issue.labels = [...(issue.labels ?? []), { name: labelName }];
    stats.labelsAdded += 1;
    console.log(`Added label "${labelName}" to ${issueLabel(issue)}.`);
  };

  const ensureBuildIssue = async (issue, desiredTitle, buildMarker, audit) => {
    const currentBody = String(issue.body ?? '').replaceAll('\r\n', '\n');
    const desiredBody = buildIssueBody(currentBody, buildMarker, audit);
    const titleChanged = issue.title !== desiredTitle;
    const bodyChanged = currentBody.trim() !== desiredBody;

    if (!titleChanged && !bodyChanged) {
      return;
    }

    if (dryRun) {
      console.log(
        `[dry-run] Update ${issueLabel(issue)}${titleChanged ? ` title to "${desiredTitle}"` : ''}${bodyChanged ? ` body with ${audit.weapons.length} newer weapon(s) and ${audit.artifactSets.length} newer artifact set(s)` : ''}.`,
      );
      stats.plannedChanges += 1;
      return;
    }

    const updatedIssue = await updateIssue(client, repository, issue.number, {
      ...(titleChanged ? { title: desiredTitle } : {}),
      ...(bodyChanged ? { body: desiredBody } : {}),
    });
    issue.title = updatedIssue.title ?? desiredTitle;
    issue.body = updatedIssue.body ?? desiredBody;
    stats.issuesRenamed += Number(titleChanged);
    stats.issueBodiesUpdated += Number(bodyChanged);
    console.log(`Updated ${issueLabel(issue)}.`);
  };

  const ensureProjectItem = async (issue) => {
    const contentId = issueNodeId(issue);
    let item = projectItemsByContentId.get(contentId);

    if (item) {
      return item;
    }

    if (dryRun) {
      console.log(`[dry-run] Add ${issueLabel(issue)} to project.`);
      stats.plannedChanges += 1;
      return {
        id: null,
        content: { id: contentId },
        lastUpdatedValue: null,
        weaponCountValue: null,
        artifactSetCountValue: null,
        bestRoleValue: null,
        characterPriorityValue: null,
        updatePriorityValue: null,
      };
    }

    item = await addProjectItem(client, project.id, contentId);
    item.content = { id: contentId };
    item.lastUpdatedValue = null;
    item.weaponCountValue = null;
    item.artifactSetCountValue = null;
    item.bestRoleValue = null;
    item.characterPriorityValue = null;
    item.updatePriorityValue = null;
    projectItemsByContentId.set(contentId, item);
    stats.projectItemsAdded += 1;
    console.log(`Added ${issueLabel(issue)} to project.`);
    return item;
  };

  const ensureTextFieldValue = async (issue, item, value) => {
    const currentValue = item?.lastUpdatedValue?.text ?? null;

    if (currentValue === value) {
      stats.unchangedFieldValues += 1;
      return;
    }

    if (dryRun) {
      console.log(
        `[dry-run] Set ${issueLabel(issue)} field "${fieldName}" from ${JSON.stringify(currentValue)} to ${JSON.stringify(value)}.`,
      );
      stats.plannedChanges += 1;
      return;
    }

    await updateTextField(
      client,
      project.id,
      item.id,
      lastUpdatedField.id,
      value,
    );
    item.lastUpdatedValue = { text: value };
    stats.fieldValuesUpdated += 1;
    console.log(
      `Set ${issueLabel(issue)} field "${fieldName}" to ${JSON.stringify(value)}.`,
    );
  };

  const ensureNumberFieldValue = async (
    issue,
    item,
    projectField,
    itemValueName,
    value,
  ) => {
    const currentValue = item?.[itemValueName]?.number ?? null;

    if (currentValue === value) {
      stats.unchangedFieldValues += 1;
      return;
    }

    if (dryRun) {
      console.log(
        `[dry-run] Set ${issueLabel(issue)} field "${projectField.name}" from ${JSON.stringify(currentValue)} to ${value}.`,
      );
      stats.plannedChanges += 1;
      return;
    }

    await updateNumberField(
      client,
      project.id,
      item.id,
      projectField.id,
      value,
    );
    item[itemValueName] = { number: value };
    stats.fieldValuesUpdated += 1;
    console.log(
      `Set ${issueLabel(issue)} field "${projectField.name}" to ${value}.`,
    );
  };

  const ensureBestRoleValue = async (issue, item, value) => {
    const desiredName = String(value);
    const option = bestRoleOptions.get(desiredName);
    const currentName = item?.bestRoleValue?.name ?? null;

    if (titleKey(currentName ?? '') === desiredName) {
      stats.unchangedFieldValues += 1;
      return;
    }

    if (dryRun) {
      console.log(
        `[dry-run] Set ${issueLabel(issue)} field "${bestRoleField.name}" from ${JSON.stringify(currentName)} to "${desiredName}".`,
      );
      stats.plannedChanges += 1;
      return;
    }

    await updateSingleSelectField(
      client,
      project.id,
      item.id,
      bestRoleField.id,
      option.id,
    );
    item.bestRoleValue = { optionId: option.id, name: desiredName };
    stats.fieldValuesUpdated += 1;
    console.log(
      `Set ${issueLabel(issue)} field "${bestRoleField.name}" to "${desiredName}".`,
    );
  };

  const detachedIssueIds = new Set();
  const deletedIssueIds = new Set();
  const activeBuildMarkers = new Set();
  const activeBuildIssueIds = new Set();
  const synchronizedBuilds = [];

  const detachIssue = async (parentIssue, subIssue) => {
    if (detachedIssueIds.has(subIssue.id)) return;

    if (dryRun) {
      console.log(
        `[dry-run] Detach ${issueLabel(subIssue)} from ${issueLabel(parentIssue)}.`,
      );
      stats.plannedChanges += 1;
    } else {
      await removeSubIssue(client, repository, parentIssue.number, subIssue.id);
      stats.subIssueRelationshipsRemoved += 1;
      console.log(
        `Detached ${issueLabel(subIssue)} from ${issueLabel(parentIssue)}.`,
      );
    }

    detachedIssueIds.add(subIssue.id);
  };

  const deleteManagedIssue = async (issue) => {
    const nodeId = issueNodeId(issue);
    if (deletedIssueIds.has(nodeId)) return;

    if (dryRun) {
      console.log(`[dry-run] Delete ${issueLabel(issue)}.`);
      stats.plannedChanges += 1;
    } else {
      await deleteIssue(client, nodeId);
      stats.issuesDeleted += 1;
      console.log(`Deleted ${issueLabel(issue)}.`);
    }

    deletedIssueIds.add(nodeId);
  };

  for (const character of inventory) {
    const parentMarker = automationMarker('parent', character.sourcePath);
    const parentIssue =
      issuesByMarker.get(parentMarker) ??
      chooseIssue(
        (issuesByTitle.get(titleKey(character.name)) ?? []).filter((issue) =>
          hasIssueLabel(issue, labelName),
        ),
        `managed character title "${character.name}"`,
      );
    const subIssues = parentIssue
      ? await listSubIssues(client, repository, parentIssue.number)
      : [];
    const subIssuesByTitle = groupIssuesByTitle(subIssues);
    const parentSubIssueIds = new Set(subIssues.map((issue) => issue.id));

    for (const build of character.builds) {
      const desiredTitle = buildIssueTitle(character.name, build.name);
      const buildMarker = automationMarker('build', build.sourcePath);
      activeBuildMarkers.add(buildMarker);
      const markerIssue = issuesByMarker.get(buildMarker) ?? null;
      const legacySubIssue = chooseIssue(
        subIssuesByTitle.get(titleKey(build.name)),
        `legacy sub-issue title "${build.name}" under "${character.name}"`,
      );
      let buildIssue =
        chooseIssue(
          issuesByTitle.get(titleKey(desiredTitle)),
          `build title "${desiredTitle}"`,
        ) ??
        markerIssue ??
        legacySubIssue;

      const duplicates = uniqueOtherIssues(buildIssue, [
        markerIssue,
        legacySubIssue,
      ]);

      for (const duplicate of duplicates) {
        if (parentIssue && parentSubIssueIds.has(duplicate.id)) {
          await detachIssue(parentIssue, duplicate);
        }
        await deleteManagedIssue(duplicate);
      }

      if (!buildIssue) {
        if (dryRun) {
          console.log(
            `[dry-run] Create standalone issue "${desiredTitle}" with label "${labelName}" and its release audit.`,
          );
          stats.plannedChanges += 1;
          buildIssue = {
            id: `dry-run:${build.sourcePath}`,
            node_id: `dry-run:${build.sourcePath}`,
            number: 'new',
            title: desiredTitle,
            body: buildIssueBody('', buildMarker, build.releaseAudit),
            labels: [{ name: labelName }],
          };
        } else {
          buildIssue = await createIssue(
            client,
            repository,
            desiredTitle,
            buildIssueBody('', buildMarker, build.releaseAudit),
            labelName,
          );
          repositoryIssues.push(buildIssue);
          issuesByTitle.set(titleKey(desiredTitle), [buildIssue]);
          issuesByMarker.set(buildMarker, buildIssue);
          stats.issuesCreated += 1;
          stats.labelsAdded += 1;
          console.log(
            `Created standalone build issue ${issueLabel(buildIssue)}.`,
          );
        }
      }

      if (parentIssue && parentSubIssueIds.has(buildIssue.id)) {
        await detachIssue(parentIssue, buildIssue);
      }

      activeBuildIssueIds.add(issueNodeId(buildIssue));
      await ensureBuildIssue(
        buildIssue,
        desiredTitle,
        buildMarker,
        build.releaseAudit,
      );
      await ensureIssueLabel(buildIssue);
      const item = await ensureProjectItem(buildIssue);
      await ensureTextFieldValue(buildIssue, item, character.lastUpdated);
      await ensureNumberFieldValue(
        buildIssue,
        item,
        weaponCountField,
        'weaponCountValue',
        build.releaseAudit.weapons.length,
      );
      await ensureNumberFieldValue(
        buildIssue,
        item,
        artifactSetCountField,
        'artifactSetCountValue',
        build.releaseAudit.artifactSets.length,
      );
      await ensureBestRoleValue(buildIssue, item, build.bestRole);
      const characterPriority = item.characterPriorityValue?.name ?? 'normal';

      if (!item.characterPriorityValue?.name) {
        console.warn(
          `${issueLabel(buildIssue)} has no "${characterPriorityField.name}" value; ranking it as Normal.`,
        );
      }

      synchronizedBuilds.push({
        issue: buildIssue,
        item,
        title: desiredTitle,
        characterPriority,
        bestRole: build.bestRole,
        lastUpdated: character.lastUpdated,
        weaponCount: build.releaseAudit.weapons.length,
        artifactSetCount: build.releaseAudit.artifactSets.length,
      });
    }

    if (parentIssue) {
      for (const subIssue of subIssues) {
        if (!deletedIssueIds.has(issueNodeId(subIssue))) {
          await detachIssue(parentIssue, subIssue);
        }
      }
      await deleteManagedIssue(parentIssue);
    }
  }

  for (const staleIssue of staleBuildIssues(
    issuesByMarker,
    activeBuildMarkers,
    activeBuildIssueIds,
  )) {
    await deleteManagedIssue(staleIssue);
  }

  for (const build of rankBuilds(synchronizedBuilds, currentVersion)) {
    await ensureNumberFieldValue(
      build.issue,
      build.item,
      updatePriorityField,
      'updatePriorityValue',
      build.updatePriority,
    );
  }

  console.log(
    `${dryRun ? 'Dry-run' : 'Sync'} complete for project "${project.title}": ${JSON.stringify(stats)}.`,
  );

  return stats;
}

async function main() {
  const argumentsSet = new Set(process.argv.slice(2));
  const knownArguments = new Set(['--dry-run', '--apply', '--print-plan']);
  const unknownArguments = [...argumentsSet].filter(
    (argument) => !knownArguments.has(argument),
  );

  if (unknownArguments.length > 0) {
    throw new Error(`Unknown options: ${unknownArguments.join(', ')}`);
  }

  const catalog = loadReleaseCatalog(process.cwd());
  const inventory = addReleaseAudits(
    loadBuildInventory(path.join(process.cwd(), 'src', 'content')),
    catalog,
  );

  if (argumentsSet.has('--print-plan')) {
    printInventory(inventory);
    return;
  }

  const dryRun = argumentsSet.has('--dry-run');
  const apply = argumentsSet.has('--apply');

  if (dryRun === apply) {
    throw new Error('Pass exactly one of --dry-run or --apply.');
  }

  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error(
      'GH_TOKEN is required. Use --print-plan to inspect local data without GitHub access.',
    );
  }

  const client = new GitHubClient({
    token,
    mutationDelayMs: parsePositiveInteger(
      process.env.MUTATION_DELAY_MS,
      'MUTATION_DELAY_MS',
      1_000,
    ),
    maxRateLimitRetries: parsePositiveInteger(
      process.env.MAX_RATE_LIMIT_RETRIES,
      'MAX_RATE_LIMIT_RETRIES',
      7,
    ),
  });

  await synchronize({
    client,
    inventory,
    repository:
      process.env.ISSUE_REPOSITORY ??
      'Genshin-Impact-Helper-Team/genshin-builds',
    projectOwner: process.env.PROJECT_OWNER ?? 'Genshin-Impact-Helper-Team',
    projectNumber: parsePositiveInteger(
      process.env.PROJECT_NUMBER,
      'PROJECT_NUMBER',
      1,
    ),
    fieldName: process.env.PROJECT_FIELD_NAME ?? 'Last Updated',
    weaponCountFieldName: process.env.WEAPON_COUNT_FIELD_NAME ?? 'Weapon Count',
    artifactSetCountFieldName:
      process.env.ARTIFACT_SET_COUNT_FIELD_NAME ?? 'Artifact Count',
    bestRoleFieldName: process.env.BEST_ROLE_FIELD_NAME ?? 'Best Role',
    characterPriorityFieldName:
      process.env.CHARACTER_PRIORITY_FIELD_NAME ?? 'Character Priority',
    updatePriorityFieldName:
      process.env.UPDATE_PRIORITY_FIELD_NAME ?? 'Update Priority',
    currentVersion: latestReleaseVersion(catalog),
    labelName: 'Auto Sync',
    dryRun,
  });
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
