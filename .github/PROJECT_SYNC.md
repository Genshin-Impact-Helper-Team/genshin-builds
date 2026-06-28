# Build project sync

The `Sync Build Project` workflow mirrors `src/content` into organization
project 1:

- each character folder gets a parent issue with the same stable folder name
- each immediate build folder gets a sub-issue under that character
- both parent and build issues are added to the project
- each build project item gets a `last_updated` text field matching its
  character's `metadata.json`
- missing issues, sub-issue relationships, project items, and the text field are
  created automatically; unrelated project data is left alone

Traveler uses its public slug (`anemo-traveler`, `pyro-traveler`, and so on) so
the elemental variants do not all resolve to one issue.

## Running it

Run `Sync Build Project` from the Actions tab. Select `dry_run` for a preview.
The workflow runs only when manually dispatched; pushes and pull requests do
not trigger it.

The first real run can create several hundred issues and project items. The
script sends writes serially, pauses between them, and honors GitHub rate-limit
responses, so that run may take a while. Later runs only write actual changes.

To inspect the local inventory without a token or an API call:

```sh
npm run project:plan
```

To run the GitHub comparison locally without changing anything:

```sh
GH_TOKEN=... npm run project:sync -- --dry-run
```

The target can be changed with `ISSUE_REPOSITORY`, `PROJECT_OWNER`,
`PROJECT_NUMBER`, or `PROJECT_FIELD_NAME` environment variables.
