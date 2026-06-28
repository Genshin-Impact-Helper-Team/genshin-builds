# Build project sync

The `Sync Build Project` workflow mirrors `src/content` into organization
project 1:

- each character folder gets a parent issue with the same stable folder name
- each immediate build folder gets a sub-issue under that character
- both parent and build issues are added to the project
- every managed parent and build issue gets the `Auto Sync` label
- each build project item gets a `last_updated` text field matching its
  character's `metadata.json`
- each build project item gets numeric `weapon_count` and `artifact_set_count`
  fields matching the generated release lists
- each build issue contains an automatically maintained list of weapons and artifact sets released after `last_updated` that are not already referenced by that build
- missing issues, sub-issue relationships, project items, and the text field are
  created automatically; unrelated project data is left alone

The generated release list uses `version_released` from `src/data`, English item
names from `src/i18n/en`, and the character's weapon type from `metadata.json`.
Build-level recommendation files take precedence over shared character-level
files.

Human-written issue text
outside the generated release-audit markers is preserved.

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
`PROJECT_NUMBER`, `PROJECT_FIELD_NAME`, `WEAPON_COUNT_FIELD_NAME`, or
`ARTIFACT_SET_COUNT_FIELD_NAME` environment variables.
