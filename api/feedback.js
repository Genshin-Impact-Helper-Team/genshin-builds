const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const FEEDBACK_TYPES = ['Bug', 'Suggestion', 'Translation Issue', 'Other'];
const DEFAULT_REPOSITORY = 'Genshin-Impact-Helper-Team/genshin-builds';
const DEFAULT_PROJECT_OWNER = 'Genshin-Impact-Helper-Team';
const DEFAULT_LABEL = 'Feedback Form';
const PROJECT_FIELD_NAMES = {
  date: 'Date',
  person: 'Discord Username',
  type: 'Feedback Type',
  page: 'Page',
};
const DEFAULT_MUTATION_DELAY_MS = 500;
const DEFAULT_MAX_RATE_LIMIT_RETRIES = 2;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://genshin-impact-helper-team.github.io',
];
const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

class GitHubApiError extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class ClientError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function exposeDebugErrors() {
  return (
    process.env.FEEDBACK_DEBUG_ERRORS === 'true' ||
    process.env.VERCEL_ENV === 'preview'
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function retryProjectMutation(operation) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

function json(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function allowedOrigins() {
  return [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...(process.env.FEEDBACK_ALLOWED_ORIGIN ?? '').split(','),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ].filter((origin) => origin.trim());
}

function requestOrigin(request) {
  return normalizeOrigin(String(request.headers.origin ?? ''));
}

function headerValue(value) {
  return Array.isArray(value) ? value[0] : String(value ?? '');
}

function requestHostOrigin(request) {
  const host = headerValue(request.headers.host).trim();
  if (!host) return '';
  const proto =
    headerValue(request.headers['x-forwarded-proto']).split(',')[0].trim() ||
    'https';
  return normalizeOrigin(`${proto}://${host}`);
}

function allowedOriginsForRequest(request) {
  return [...allowedOrigins(), requestHostOrigin(request)]
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);
}

function requestIp(request) {
  return headerValue(request.headers['x-forwarded-for']).split(',')[0].trim();
}

function isAllowedOrigin(request) {
  const origin = requestOrigin(request);
  return Boolean(origin && allowedOriginsForRequest(request).includes(origin));
}

function setCorsHeaders(request, response) {
  const origin = requestOrigin(request);
  if (origin && allowedOriginsForRequest(request).includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  }
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Vary', 'Origin');
}

async function readRequestBody(request) {
  if (typeof request.body === 'string') return request.body;
  if (request.body && typeof request.body === 'object') {
    return JSON.stringify(request.body);
  }
  let body = '';
  for await (const chunk of request) body += chunk.toString();
  return body;
}

async function readPayload(request) {
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

function clean(value, maxLength) {
  return String(value ?? '')
    .replaceAll('\r\n', '\n')
    .trim()
    .slice(0, maxLength);
}

function validatePayload(payload) {
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

async function verifyCaptcha(rawPayload, request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new ClientError(500, 'Captcha is not configured.');
  }

  const responseToken = clean(rawPayload['cf-turnstile-response'], 2_048);
  if (!responseToken) {
    throw new ClientError(400, 'Captcha is required.');
  }

  const body = {
    secret,
    response: responseToken,
  };
  const remoteip = requestIp(request);
  if (remoteip) body.remoteip = remoteip;
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  const origin = requestOrigin(request);
  const expectedHostname = origin ? new URL(origin).hostname : '';

  if (
    !response.ok ||
    !result.success ||
    result.action !== 'feedback' ||
    (result.hostname &&
      expectedHostname &&
      result.hostname !== expectedHostname)
  ) {
    throw new ClientError(400, 'Captcha validation failed.');
  }
}

function truncate(value, maxLength) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 3)}...`;
}

function renderIssueBody(feedback) {
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

function projectPageValue(feedback) {
  const value = feedback.page.trim();
  const language = feedback.language.trim().toLocaleLowerCase('en-US');
  const start = language
    ? value.toLocaleLowerCase('en-US').indexOf(`/${language}`)
    : -1;
  return start >= 0 ? value.slice(start + 1) : value;
}

function createClient(token) {
  let lastMutationStartedAt = 0;

  async function paceMutation() {
    const elapsed = Date.now() - lastMutationStartedAt;
    const remainingDelay = DEFAULT_MUTATION_DELAY_MS - elapsed;
    if (remainingDelay > 0) await sleep(remainingDelay);
    lastMutationStartedAt = Date.now();
  }

  function rateLimitDelay(response, attempt) {
    const retryAfter = Number.parseInt(
      response.headers.get('retry-after') ?? '',
      10,
    );
    if (Number.isInteger(retryAfter)) return retryAfter * 1_000;

    if (response.headers.get('x-ratelimit-remaining') === '0') {
      const resetAt = Number.parseInt(
        response.headers.get('x-ratelimit-reset') ?? '',
        10,
      );
      if (Number.isInteger(resetAt)) {
        return Math.max(resetAt * 1_000 - Date.now() + 1_000, 1_000);
      }
    }

    return 1_000 * 2 ** attempt;
  }

  async function request(endpoint, options = {}) {
    const method = options.method ?? 'GET';

    for (let attempt = 0; ; attempt += 1) {
      if (options.mutation) await paceMutation();

      const response = await fetch(`${GITHUB_API}${endpoint}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'genshin-builds-feedback-form',
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const text = await response.text();
      let payload = null;

      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
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

      if (isRateLimited && attempt < DEFAULT_MAX_RATE_LIMIT_RETRIES) {
        await sleep(rateLimitDelay(response, attempt));
        continue;
      }

      if (!response.ok) {
        throw new GitHubApiError(
          `${method} ${endpoint} failed (${response.status}): ${
            errorText || 'Unknown GitHub API error'
          }`,
          response.status,
        );
      }
      return payload;
    }
  }

  async function graphql(query, variables = {}, options = {}) {
    const payload = await request('/graphql', {
      method: 'POST',
      body: { query, variables },
      mutation: options.mutation,
    });
    if (payload.errors?.length) {
      const errorText = payload.errors.map((error) => error.message).join('; ');
      throw new Error(`GitHub GraphQL error: ${errorText}`);
    }
    return payload.data;
  }
  return { request, graphql };
}

async function ensureLabel(client, repository, label) {
  try {
    await client.request(
      `/repos/${repository}/labels/${encodeURIComponent(label)}`,
    );
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 404) throw error;
    try {
      await client.request(`/repos/${repository}/labels`, {
        method: 'POST',
        mutation: true,
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

async function createIssue(client, repository, label, feedback) {
  const title = `[${feedback.type}] ${truncate(projectPageValue(feedback), 90)}`;
  return client.request(`/repos/${repository}/issues`, {
    method: 'POST',
    mutation: true,
    body: {
      title,
      body: renderIssueBody(feedback),
      labels: [label],
    },
  });
}

function repositoryParts(repository) {
  const [owner, name] = repository.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repository "${repository}".`);
  }
  return { owner, name };
}

async function loadIssueContentId(client, repository, issue) {
  if (issue.node_id) return issue.node_id;

  const { owner, name } = repositoryParts(repository);
  const data = await client.graphql(
    `
      query FeedbackIssueId($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          issue(number: $number) {
            id
          }
        }
      }
    `,
    { owner, name, number: issue.number },
  );
  const id = data.repository?.issue?.id || issue.node_id;
  if (!id) {
    throw new Error(`Could not find GraphQL id for issue #${issue.number}.`);
  }
  return id;
}

async function loadProject(client, owner, number) {
  const data = await client.graphql(
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

function findField(fields, name) {
  return fields.find(
    (field) =>
      field.name.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'),
  );
}

function requireField(fields, name, dataType) {
  const field = findField(fields, name);
  if (!field) {
    throw new Error(`Project field "${name}" was not found.`);
  }
  if (field.dataType !== dataType) {
    throw new Error(`Project field "${name}" must be a ${dataType} field.`);
  }
  return field;
}

function requireTypeField(fields, name) {
  const field = findField(fields, name);
  if (!field) {
    throw new Error(`Project field "${name}" was not found.`);
  }
  if (!Array.isArray(field.options)) {
    throw new Error(`Project field "${name}" must be a single-select field.`);
  }
  return field;
}

async function addProjectItem(client, projectId, contentId) {
  const data = await client.graphql(
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
    { mutation: true },
  );
  return data.addProjectV2ItemById.item;
}

async function updateTextField(client, projectId, itemId, fieldId, value) {
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
    { mutation: true },
  );
}

async function updateDateField(client, projectId, itemId, fieldId, value) {
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
    { mutation: true },
  );
}

async function addIssueToProject(client, repository, issue, feedback) {
  const project = await loadProject(client, DEFAULT_PROJECT_OWNER, 2);
  const issueContentId = await loadIssueContentId(client, repository, issue);
  const item = await retryProjectMutation(() =>
    addProjectItem(client, project.id, issueContentId),
  );
  const fields = project.fields.nodes;
  const dateField = requireField(fields, PROJECT_FIELD_NAMES.date, 'DATE');
  const personField = requireField(fields, PROJECT_FIELD_NAMES.person, 'TEXT');
  const pageField = requireField(fields, PROJECT_FIELD_NAMES.page, 'TEXT');
  const typeField = requireTypeField(fields, PROJECT_FIELD_NAMES.type);
  const typeOption = typeField.options?.find(
    (option) => option.name === feedback.type,
  );
  if (!typeOption) {
    throw new Error(
      `Project field "${PROJECT_FIELD_NAMES.type}" is missing option "${feedback.type}".`,
    );
  }
  await retryProjectMutation(() =>
    updateDateField(
      client,
      project.id,
      item.id,
      dateField.id,
      issue.created_at.slice(0, 10),
    ),
  );
  if (feedback.contact) {
    await retryProjectMutation(() =>
      updateTextField(
        client,
        project.id,
        item.id,
        personField.id,
        feedback.contact,
      ),
    );
  }
  await retryProjectMutation(() =>
    updateSingleSelectField(
      client,
      project.id,
      item.id,
      typeField.id,
      typeOption.id,
    ),
  );
  await retryProjectMutation(() =>
    updateTextField(
      client,
      project.id,
      item.id,
      pageField.id,
      projectPageValue(feedback),
    ),
  );
}

export default async function handler(request, response) {
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
  try {
    const rawPayload = await readPayload(request);
    await verifyCaptcha(rawPayload, request);

    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) {
      return json(response, 500, {
        error: 'Feedback endpoint is not configured.',
      });
    }

    const payload = validatePayload(rawPayload);
    const client = createClient(token);
    await ensureLabel(client, DEFAULT_REPOSITORY, DEFAULT_LABEL);
    const issue = await createIssue(
      client,
      DEFAULT_REPOSITORY,
      DEFAULT_LABEL,
      payload,
    );
    try {
      await addIssueToProject(client, DEFAULT_REPOSITORY, issue, payload);
    } catch (projectError) {
      console.error(
        `Could not sync feedback issue #${issue.number} to project.`,
        projectError,
      );
      const body = {
        error: 'Feedback issue was created, but project sync failed.',
        issueNumber: issue.number,
        issueUrl: issue.html_url,
      };
      if (exposeDebugErrors()) {
        body.details =
          projectError instanceof Error
            ? projectError.message
            : String(projectError);
      }
      return json(response, 500, body);
    }
    return json(response, 201, {
      ok: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    });
  } catch (error) {
    if (!(error instanceof ClientError)) console.error(error);
    const message =
      error instanceof Error ? error.message : 'Could not send feedback.';
    if (error instanceof ClientError) {
      return json(response, error.status, { error: message });
    }
    const isClientError =
      message.includes('Feedback is required') ||
      message.includes('Choose what the feedback');
    return json(response, isClientError ? 400 : 500, {
      error: isClientError ? message : 'Could not send feedback.',
    });
  }
}
