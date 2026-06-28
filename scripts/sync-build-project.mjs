import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const API_URL = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const PAGE_SIZE = 100;

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

        let metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

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

async function createIssue(client, repository, title, body) {
  const { payload } = await client.request(`/repos/${repository}/issues`, {
    method: 'POST',
    body: { title, body },
    mutation: true,
  });

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

async function createTextField(client, projectId, fieldName) {
  const { data } = await client.graphql(
    `
      mutation CreateTextField($projectId: ID!, $name: String!) {
        createProjectV2Field(
          input: { projectId: $projectId, dataType: TEXT, name: $name }
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
    { projectId, name: fieldName },
    { mutation: true },
  );

  return data.createProjectV2Field.projectV2Field;
}

async function listProjectItems(client, projectId, fieldName) {
  const items = [];
  let after = null;

  do {
    const { data } = await client.graphql(
      `
        query ProjectItems(
          $projectId: ID!
          $fieldName: String!
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
                  fieldValueByName(name: $fieldName) {
                    ... on ProjectV2ItemFieldTextValue {
                      text
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
      { projectId, fieldName, after },
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
  dryRun,
}) {
  const stats = {
    issuesCreated: 0,
    subIssueRelationshipsAdded: 0,
    projectItemsAdded: 0,
    fieldValuesUpdated: 0,
    unchangedFieldValues: 0,
    plannedChanges: 0,
  };
  const project = await loadProject(client, projectOwner, projectNumber);
  let field = project.fields.nodes.find(
    (candidate) =>
      candidate &&
      typeof candidate.name === 'string' &&
      titleKey(candidate.name) === titleKey(fieldName),
  );

  if (field && field.dataType !== 'TEXT') {
    throw new Error(
      `Project field "${field.name}" exists but is not a text field.`,
    );
  }

  if (!field) {
    if (dryRun) {
      console.log(`[dry-run] Create text project field "${fieldName}".`);
      stats.plannedChanges += 1;
      field = { id: null, name: fieldName, dataType: 'TEXT' };
    } else {
      field = await createTextField(client, project.id, fieldName);
      console.log(`Created text project field "${fieldName}".`);
    }
  }

  const [repositoryIssues, projectItems] = await Promise.all([
    listRepositoryIssues(client, repository),
    listProjectItems(client, project.id, fieldName),
  ]);
  const issuesByTitle = groupIssuesByTitle(repositoryIssues);
  const issuesByMarker = indexIssuesByMarker(repositoryIssues);
  const projectItemsByContentId = new Map(
    projectItems
      .filter((item) => item?.content?.id)
      .map((item) => [item.content.id, item]),
  );

  const ensureProjectItem = async (issue) => {
    const contentId = issueNodeId(issue);
    let item = projectItemsByContentId.get(contentId);

    if (item) {
      return item;
    }

    if (dryRun) {
      console.log(`[dry-run] Add ${issueLabel(issue)} to project.`);
      stats.plannedChanges += 1;
      return { id: null, content: { id: contentId }, fieldValueByName: null };
    }

    item = await addProjectItem(client, project.id, contentId);
    item.content = { id: contentId };
    item.fieldValueByName = null;
    projectItemsByContentId.set(contentId, item);
    stats.projectItemsAdded += 1;
    console.log(`Added ${issueLabel(issue)} to project.`);
    return item;
  };

  const ensureFieldValue = async (issue, item, value) => {
    const currentValue = item?.fieldValueByName?.text ?? null;

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

    await updateTextField(client, project.id, item.id, field.id, value);
    item.fieldValueByName = { text: value };
    stats.fieldValuesUpdated += 1;
    console.log(
      `Set ${issueLabel(issue)} field "${fieldName}" to ${JSON.stringify(value)}.`,
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
        console.log(`[dry-run] Create parent issue "${character.name}".`);
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
        );
        repositoryIssues.push(parentIssue);
        issuesByTitle.set(titleKey(character.name), [parentIssue]);
        issuesByMarker.set(parentMarker, parentIssue);
        stats.issuesCreated += 1;
        console.log(`Created parent issue ${issueLabel(parentIssue)}.`);
      }
    }

    if (!parentIssue) {
      for (const build of character.builds) {
        console.log(
          `[dry-run] Create sub-issue "${build.name}", attach it to "${character.name}", add it to the project, and set "${fieldName}" to ${JSON.stringify(character.lastUpdated)}.`,
        );
        stats.plannedChanges += 4;
      }
      continue;
    }

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
            `[dry-run] Create sub-issue "${build.name}" under "${character.name}".`,
          );
          stats.plannedChanges += 2;
          console.log(
            `[dry-run] Add the new sub-issue to the project and set "${fieldName}" to ${JSON.stringify(character.lastUpdated)}.`,
          );
          stats.plannedChanges += 2;
          continue;
        }

        subIssue = await createIssue(
          client,
          repository,
          build.name,
          buildMarker,
        );
        repositoryIssues.push(subIssue);
        issuesByMarker.set(buildMarker, subIssue);
        stats.issuesCreated += 1;
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

      const item = await ensureProjectItem(subIssue);
      await ensureFieldValue(subIssue, item, character.lastUpdated);
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

  const inventory = loadBuildInventory(
    path.join(process.cwd(), 'src', 'content'),
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
    fieldName: process.env.PROJECT_FIELD_NAME ?? 'last_updated',
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
