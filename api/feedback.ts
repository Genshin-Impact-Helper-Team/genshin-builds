import type { IncomingMessage, ServerResponse } from 'node:http';

const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const FEEDBACK_TYPES = ['Bug', 'Suggestion', 'Translation Issue', 'Other'];
const DEFAULT_REPOSITORY = 'Genshin-Impact-Helper-Team/genshin-builds';
const DEFAULT_PROJECT_OWNER = 'Genshin-Impact-Helper-Team';
const DEFAULT_PROJECT_NUMBER = 2;
const DEFAULT_LABEL = 'Feedback Form';

type FeedbackPayload = {
  contact: string;
  type: string;
  page: string;
  language: string;
  feedback: string;
};

type GitHubIssue = {
  node_id: string;
  number: number;
  html_url: string;
  created_at: string;
};

type GitHubClient = {
  request: <T>(
    endpoint: string,
    options?: { method?: string; body?: unknown },
  ) => Promise<T>;
  graphql: <T>(
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<T>;
};

type ProjectField = {
  id: string;
  name: string;
  dataType?: string;
  options?: { id: string; name: string }[];
};

class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class ClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function env(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function json(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function allowedOrigins() {
  return [
    ...(process.env.FEEDBACK_ALLOWED_ORIGIN ?? '')
      .split(',')
      .map((origin) => normalizeOrigin(origin.trim())),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ].filter(Boolean);
}

function requestOrigin(request: IncomingMessage) {
  return normalizeOrigin(String(request.headers.origin ?? ''));
}

function isAllowedOrigin(request: IncomingMessage) {
  const origin = requestOrigin(request);

  return Boolean(origin && allowedOrigins().includes(origin));
}

function setCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = requestOrigin(request);

  if (origin && allowedOrigins().includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  }

  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Vary', 'Origin');
}

async function readRequestBody(request: IncomingMessage & { body?: unknown }) {
  if (typeof request.body === 'string') return request.body;
  if (request.body && typeof request.body === 'object') {
    return JSON.stringify(request.body);
  }

  let body = '';
  for await (const chunk of request) body += chunk.toString();
  return body;
}

async function readPayload(request: IncomingMessage & { body?: unknown }) {
  const body = await readRequestBody(request);
  const contentType = String(request.headers['content-type'] ?? '');

  if (!contentType.includes('application/json')) {
    throw new ClientError(415, 'Feedback must be sent as JSON.');
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new ClientError(400, 'Feedback contains invalid JSON.');
  }
}

function clean(value: unknown, maxLength: number) {
  return String(value ?? '')
    .replaceAll('\r\n', '\n')
    .trim()
    .slice(0, maxLength);
}

function validatePayload(payload: Record<string, unknown>): FeedbackPayload {
  const feedback = clean(payload.feedback, 5_000);
  const type = clean(payload.type, 80);

  if (!FEEDBACK_TYPES.includes(type)) {
    throw new Error('Choose what the feedback is about.');
  }

  if (!feedback) {
    throw new Error('Feedback is required.');
  }

  return {
    contact: clean(payload.contact, 140),
    type,
    page: clean(payload.page, 1_000) || 'Unknown page',
    language: clean(payload.language, 20) || 'unknown',
    feedback,
  };
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 3)}...`;
}

function renderIssueBody(feedback: FeedbackPayload) {
  return [
    '## Feedback',
    '',
    `**Type:** ${feedback.type}`,
    `**Page:** ${feedback.page}`,
    `**Language:** ${feedback.language}`,
    `**Discord:** ${feedback.contact || '_Not provided_'}`,
    '',
    '## Message',
    '',
    feedback.feedback,
  ].join('\n');
}

function createClient(token: string): GitHubClient {
  async function request<T>(
    endpoint: string,
    options: { method?: string; body?: unknown } = {},
  ) {
    const response = await fetch(`${GITHUB_API}${endpoint}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'genshin-builds-feedback-form',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = payload?.message || text || 'Unknown GitHub API error';
      throw new GitHubApiError(
        `${options.method ?? 'GET'} ${endpoint} failed: ${message}`,
        response.status,
      );
    }

    return payload as T;
  }

  async function graphql<T>(
    query: string,
    variables: Record<string, unknown> = {},
  ) {
    const payload = await request<{ data?: T; errors?: { message: string }[] }>(
      '/graphql',
      { method: 'POST', body: { query, variables } },
    );

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join('; '));
    }

    return payload.data as T;
  }

  return { request, graphql };
}

async function ensureLabel(
  client: GitHubClient,
  repository: string,
  label: string,
) {
  try {
    await client.request(
      `/repos/${repository}/labels/${encodeURIComponent(label)}`,
    );
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 404) throw error;

    try {
      await client.request(`/repos/${repository}/labels`, {
        method: 'POST',
        body: {
          name: label,
          color: 'bfd4f2',
          description: 'Submitted through the website feedback form',
        },
      });
    } catch (createError) {
      if (
        !(createError instanceof GitHubApiError) ||
        createError.status !== 422
      ) {
        throw createError;
      }
    }
  }
}

async function createIssue(
  client: GitHubClient,
  repository: string,
  label: string,
  feedback: FeedbackPayload,
) {
  const title = `[${feedback.type}] ${truncate(feedback.page, 90)}`;

  return client.request<GitHubIssue>(`/repos/${repository}/issues`, {
    method: 'POST',
    body: {
      title,
      body: renderIssueBody(feedback),
      labels: [label],
    },
  });
}

async function loadProject(
  client: GitHubClient,
  owner: string,
  number: number,
) {
  const data = await client.graphql<{
    organization?: {
      projectV2?: {
        id: string;
        fields: { nodes: ProjectField[]; pageInfo: { hasNextPage: boolean } };
      };
    };
  }>(
    `
      query FeedbackProject($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            fields(first: 100) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
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
    { owner, number },
  );
  const project = data.organization?.projectV2;

  if (!project)
    throw new Error(`GitHub project ${owner}/${number} was not found.`);
  if (project.fields.pageInfo.hasNextPage) {
    throw new Error('Feedback project has more than 100 fields.');
  }

  return project;
}

async function createProjectField(
  client: GitHubClient,
  projectId: string,
  name: string,
  dataType: 'TEXT' | 'DATE',
) {
  const data = await client.graphql<{
    createProjectV2Field: { projectV2Field: ProjectField };
  }>(
    `
      mutation CreateFeedbackField(
        $projectId: ID!
        $name: String!
        $dataType: ProjectV2CustomFieldType!
      ) {
        createProjectV2Field(
          input: { projectId: $projectId, dataType: $dataType, name: $name }
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
    { projectId, name, dataType },
  );

  return data.createProjectV2Field.projectV2Field;
}

async function createTypeField(
  client: GitHubClient,
  projectId: string,
  name: string,
) {
  const options = FEEDBACK_TYPES.map((option, index) => {
    const colors = ['RED', 'BLUE', 'YELLOW', 'GRAY'];

    return `{
      name: ${JSON.stringify(option)}
      color: ${colors[index]}
      description: ${JSON.stringify(`${option} feedback`)}
    }`;
  }).join('\n');
  const data = await client.graphql<{
    createProjectV2Field: { projectV2Field: ProjectField };
  }>(
    `
      mutation CreateFeedbackTypeField($projectId: ID!, $name: String!) {
        createProjectV2Field(
          input: {
            projectId: $projectId
            dataType: SINGLE_SELECT
            name: $name
            singleSelectOptions: [
              ${options}
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
    { projectId, name },
  );

  return data.createProjectV2Field.projectV2Field;
}

function findField(fields: ProjectField[], name: string) {
  return fields.find(
    (field) =>
      field.name.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'),
  );
}

async function ensureField(
  client: GitHubClient,
  fields: ProjectField[],
  projectId: string,
  name: string,
  dataType: 'TEXT' | 'DATE',
) {
  const field = findField(fields, name);
  if (field) return field;

  const created = await createProjectField(client, projectId, name, dataType);
  fields.push(created);
  return created;
}

async function ensureTypeField(
  client: GitHubClient,
  fields: ProjectField[],
  projectId: string,
  name: string,
) {
  const field = findField(fields, name);
  if (field) return field;

  const created = await createTypeField(client, projectId, name);
  fields.push(created);
  return created;
}

async function addProjectItem(
  client: GitHubClient,
  projectId: string,
  contentId: string,
) {
  const data = await client.graphql<{
    addProjectV2ItemById: { item: { id: string } };
  }>(
    `
      mutation AddFeedbackItem($projectId: ID!, $contentId: ID!) {
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
  );

  return data.addProjectV2ItemById.item;
}

async function updateTextField(
  client: GitHubClient,
  projectId: string,
  itemId: string,
  fieldId: string,
  value: string,
) {
  await client.graphql(
    `
      mutation UpdateFeedbackTextField(
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
  );
}

async function updateDateField(
  client: GitHubClient,
  projectId: string,
  itemId: string,
  fieldId: string,
  value: string,
) {
  await client.graphql(
    `
      mutation UpdateFeedbackDateField(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $value: Date!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { date: $value }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `,
    { projectId, itemId, fieldId, value },
  );
}

async function updateSingleSelectField(
  client: GitHubClient,
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
) {
  await client.graphql(
    `
      mutation UpdateFeedbackTypeField(
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
  );
}

async function addIssueToProject(
  client: GitHubClient,
  issue: GitHubIssue,
  feedback: FeedbackPayload,
) {
  const projectOwner = env('FEEDBACK_PROJECT_OWNER', DEFAULT_PROJECT_OWNER);
  const projectNumber = Number.parseInt(
    env('FEEDBACK_PROJECT_NUMBER', String(DEFAULT_PROJECT_NUMBER)),
    10,
  );
  const project = await loadProject(client, projectOwner, projectNumber);
  const fields = project.fields.nodes;
  const names = {
    date: env('FEEDBACK_DATE_FIELD_NAME', 'Date'),
    person: env('FEEDBACK_PERSON_FIELD_NAME', 'Person'),
    type: env('FEEDBACK_TYPE_FIELD_NAME', 'Feedback Type'),
    page: env('FEEDBACK_PAGE_FIELD_NAME', 'Page'),
    language: env('FEEDBACK_LANGUAGE_FIELD_NAME', 'Language'),
    feedback: env('FEEDBACK_TEXT_FIELD_NAME', 'Feedback'),
    notes: env('FEEDBACK_NOTES_FIELD_NAME', 'Notes'),
  };
  const [dateField, personField, pageField, languageField, feedbackField] =
    await Promise.all([
      ensureField(client, fields, project.id, names.date, 'DATE'),
      ensureField(client, fields, project.id, names.person, 'TEXT'),
      ensureField(client, fields, project.id, names.page, 'TEXT'),
      ensureField(client, fields, project.id, names.language, 'TEXT'),
      ensureField(client, fields, project.id, names.feedback, 'TEXT'),
      ensureField(client, fields, project.id, names.notes, 'TEXT'),
    ]);
  const typeField = await ensureTypeField(
    client,
    fields,
    project.id,
    names.type,
  );
  const typeOption = typeField.options?.find(
    (option) => option.name === feedback.type,
  );

  if (!typeOption) {
    throw new Error(
      `Project field "${names.type}" is missing option "${feedback.type}".`,
    );
  }

  const item = await addProjectItem(client, project.id, issue.node_id);
  await Promise.all([
    updateDateField(
      client,
      project.id,
      item.id,
      dateField.id,
      issue.created_at.slice(0, 10),
    ),
    feedback.contact
      ? updateTextField(
          client,
          project.id,
          item.id,
          personField.id,
          feedback.contact,
        )
      : Promise.resolve(),
    updateSingleSelectField(
      client,
      project.id,
      item.id,
      typeField.id,
      typeOption.id,
    ),
    updateTextField(client, project.id, item.id, pageField.id, feedback.page),
    updateTextField(
      client,
      project.id,
      item.id,
      languageField.id,
      feedback.language,
    ),
    updateTextField(
      client,
      project.id,
      item.id,
      feedbackField.id,
      feedback.feedback,
    ),
  ]);
}

export default async function handler(
  request: IncomingMessage & { body?: unknown },
  response: ServerResponse,
) {
  setCorsHeaders(request, response);

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(request)) {
      return json(response, 403, { error: 'Origin is not allowed.' });
    }

    response.statusCode = 204;
    return response.end();
  }

  if (request.method !== 'POST') {
    return json(response, 405, { error: 'Method not allowed.' });
  }

  if (!isAllowedOrigin(request)) {
    return json(response, 403, { error: 'Origin is not allowed.' });
  }

  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;

  if (!token) {
    return json(response, 500, {
      error: 'Feedback endpoint is not configured.',
    });
  }

  try {
    const payload = validatePayload(await readPayload(request));
    const client = createClient(token);
    const repository = env('FEEDBACK_REPOSITORY', DEFAULT_REPOSITORY);
    const label = env('FEEDBACK_LABEL', DEFAULT_LABEL);

    await ensureLabel(client, repository, label);
    const issue = await createIssue(client, repository, label, payload);
    await addIssueToProject(client, issue, payload);

    return json(response, 201, {
      ok: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : 'Could not send feedback.';
    if (error instanceof ClientError) {
      return json(response, error.status, { error: message });
    }

    const isClientError =
      message.includes('Feedback is required') ||
      message.includes('Choose what the feedback');

    return json(response, isClientError ? 400 : 500, { error: message });
  }
}
