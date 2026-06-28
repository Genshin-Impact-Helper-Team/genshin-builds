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

function issueLabel(issue) {
  return `${issue.title} (#${issue.number})`;
}

function parentTitle(character, element) {
  return character === 'traveler' ? `${element}-traveler` : character;
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
    .trim();

  if (!body.includes(buildMarker)) {
    body = [buildMarker, body].filter(Boolean).join('\n\n');
  }

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
          .filter((entry) => entry.isDirectory())
          .map((entry) => ({
            name: entry.name,
            sourcePath: `${sourcePath}/${entry.name}`,
          }))
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

async function updateIssueBody(client, repository, issueNumber, body) {
  const { payload } = await client.request(
    `/repos/${repository}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      body: { body },
      mutation: true,
    },
  );

  return payload;
}

async function addSubIssue(client, repository, parentNumber, subIssueId) {
  await client.request(
    `/repos/${repository}/issues/${parentNumber}/sub_issues`,
    {
      method: 'POST',
      body: { sub_issue_id: subIssueId },
      mutation: true,
    },
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
  labelName,
  dryRun,
}) {
  const stats = {
    issuesCreated: 0,
    issueBodiesUpdated: 0,
    labelsAdded: 0,
    subIssueRelationshipsAdded: 0,
    projectItemsAdded: 0,
    fieldValuesUpdated: 0,
    unchangedFieldValues: 0,
    plannedChanges: 0,
  };
  const project = await loadProject(client, projectOwner, projectNumber);
  const requestedFieldNames = [
    fieldName,
    weaponCountFieldName,
    artifactSetCountFieldName,
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

  const [repositoryIssues, projectItems] = await Promise.all([
    listRepositoryIssues(client, repository),
    listProjectItems(client, project.id, {
      lastUpdated: fieldName,
      weaponCount: weaponCountFieldName,
      artifactSetCount: artifactSetCountFieldName,
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
    const hasLabel = (issue.labels ?? []).some((label) => {
      const currentName = typeof label === 'string' ? label : label.name;

      return (
        typeof currentName === 'string' &&
        titleKey(currentName) === titleKey(labelName)
      );
    });

    if (hasLabel) {
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

  const ensureBuildIssueBody = async (issue, buildMarker, audit) => {
    const currentBody = String(issue.body ?? '').replaceAll('\r\n', '\n');
    const desiredBody = buildIssueBody(currentBody, buildMarker, audit);

    if (currentBody.trim() === desiredBody) {
      return;
    }

    if (dryRun) {
      console.log(
        `[dry-run] Update ${issueLabel(issue)} body with ${audit.weapons.length} newer weapon(s) and ${audit.artifactSets.length} newer artifact set(s).`,
      );
      stats.plannedChanges += 1;
      return;
    }

    const updatedIssue = await updateIssueBody(
      client,
      repository,
      issue.number,
      desiredBody,
    );
    issue.body = updatedIssue.body ?? desiredBody;
    stats.issueBodiesUpdated += 1;
    console.log(
      `Updated ${issueLabel(issue)} body with ${audit.weapons.length} newer weapon(s) and ${audit.artifactSets.length} newer artifact set(s).`,
    );
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
      };
    }

    item = await addProjectItem(client, project.id, contentId);
    item.content = { id: contentId };
    item.lastUpdatedValue = null;
    item.weaponCountValue = null;
    item.artifactSetCountValue = null;
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

  for (const character of inventory) {
    const parentMarker = automationMarker('parent', character.sourcePath);
    let parentIssue = chooseIssue(
      issuesByTitle.get(titleKey(character.name)),
      `parent title "${character.name}"`,
    );

    if (!parentIssue) {
      parentIssue = issuesByMarker.get(parentMarker) ?? null;
    }

    if (!parentIssue) {
      if (dryRun) {
        console.log(
          `[dry-run] Create parent issue "${character.name}" with label "${labelName}".`,
        );
        console.log(
          `[dry-run] Add the new parent issue "${character.name}" to the project.`,
        );
        stats.plannedChanges += 2;
      } else {
        parentIssue = await createIssue(
          client,
          repository,
          character.name,
          parentMarker,
          labelName,
        );
        repositoryIssues.push(parentIssue);
        issuesByTitle.set(titleKey(character.name), [parentIssue]);
        issuesByMarker.set(parentMarker, parentIssue);
        stats.issuesCreated += 1;
        stats.labelsAdded += 1;
        console.log(`Created parent issue ${issueLabel(parentIssue)}.`);
      }
    }

    if (!parentIssue) {
      for (const build of character.builds) {
        console.log(
          `[dry-run] Create sub-issue "${build.name}" with label "${labelName}" and a release audit containing ${build.releaseAudit.weapons.length} weapon(s) and ${build.releaseAudit.artifactSets.length} artifact set(s), attach it to "${character.name}", add it to the project, and set its three synchronized fields.`,
        );
        stats.plannedChanges += 6;
      }
      continue;
    }

    await ensureIssueLabel(parentIssue);
    await ensureProjectItem(parentIssue);
    const subIssues = await listSubIssues(
      client,
      repository,
      parentIssue.number,
    );
    const subIssuesByTitle = groupIssuesByTitle(subIssues);

    for (const build of character.builds) {
      const buildMarker = automationMarker('build', build.sourcePath);
      let subIssue = chooseIssue(
        subIssuesByTitle.get(titleKey(build.name)),
        `sub-issue title "${build.name}" under "${character.name}"`,
      );
      let needsRelationship = false;

      if (!subIssue) {
        subIssue = issuesByMarker.get(buildMarker) ?? null;
        needsRelationship = Boolean(subIssue);
      }

      if (!subIssue) {
        if (dryRun) {
          console.log(
            `[dry-run] Create sub-issue "${build.name}" with label "${labelName}" and a release audit containing ${build.releaseAudit.weapons.length} weapon(s) and ${build.releaseAudit.artifactSets.length} artifact set(s) under "${character.name}".`,
          );
          stats.plannedChanges += 2;
          console.log(
            `[dry-run] Add the new sub-issue to the project and set "${fieldName}" to ${JSON.stringify(character.lastUpdated)}, "${weaponCountFieldName}" to ${build.releaseAudit.weapons.length}, and "${artifactSetCountFieldName}" to ${build.releaseAudit.artifactSets.length}.`,
          );
          stats.plannedChanges += 4;
          continue;
        }

        subIssue = await createIssue(
          client,
          repository,
          build.name,
          buildIssueBody('', buildMarker, build.releaseAudit),
          labelName,
        );
        repositoryIssues.push(subIssue);
        issuesByMarker.set(buildMarker, subIssue);
        stats.issuesCreated += 1;
        stats.labelsAdded += 1;
        needsRelationship = true;
        console.log(`Created build issue ${issueLabel(subIssue)}.`);
      }

      if (needsRelationship) {
        if (dryRun) {
          console.log(
            `[dry-run] Attach ${issueLabel(subIssue)} to parent ${issueLabel(parentIssue)}.`,
          );
          stats.plannedChanges += 1;
        } else {
          await addSubIssue(
            client,
            repository,
            parentIssue.number,
            subIssue.id,
          );
          stats.subIssueRelationshipsAdded += 1;
          console.log(
            `Attached ${issueLabel(subIssue)} to parent ${issueLabel(parentIssue)}.`,
          );
        }
      }

      await ensureBuildIssueBody(subIssue, buildMarker, build.releaseAudit);
      await ensureIssueLabel(subIssue);
      const item = await ensureProjectItem(subIssue);
      await ensureTextFieldValue(subIssue, item, character.lastUpdated);
      await ensureNumberFieldValue(
        subIssue,
        item,
        weaponCountField,
        'weaponCountValue',
        build.releaseAudit.weapons.length,
      );
      await ensureNumberFieldValue(
        subIssue,
        item,
        artifactSetCountField,
        'artifactSetCountValue',
        build.releaseAudit.artifactSets.length,
      );
    }
  }

  console.log(
    `${dryRun ? 'Dry-run' : 'Sync'} complete for project "${project.title}": ${JSON.stringify(stats)}.`,
  );

  return stats;
}

async function main() {
  const argumentsSet = new Set(process.argv.slice(2));
  const knownArguments = new Set(['--dry-run', '--print-plan']);
  const unknownArguments = [...argumentsSet].filter(
    (argument) => !knownArguments.has(argument),
  );

  if (unknownArguments.length > 0) {
    throw new Error(`Unknown options: ${unknownArguments.join(', ')}`);
  }

  const inventory = addReleaseAudits(
    loadBuildInventory(path.join(process.cwd(), 'src', 'content')),
    loadReleaseCatalog(process.cwd()),
  );

  if (argumentsSet.has('--print-plan')) {
    printInventory(inventory);
    return;
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
    labelName: 'Auto Sync',
    dryRun: argumentsSet.has('--dry-run'),
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
