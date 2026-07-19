# Build project sync

The `Sync Build Project` workflow mirrors `src/content` into organization
project 1:

- each build gets one standalone issue named `<character> - <build>`
- legacy parent/sub-issue relationships are removed and managed character
  parent issues are deleted
- every managed build issue is added to the project and gets the `Auto Sync`
  label
- each build project item gets a `Last Updated` text field matching its
  character's `metadata.json`
- each build project item gets numeric `Weapon Count` and `Artifact Count`
  fields matching the unchecked generated release-list items
- each build project item gets a `Best Role` true/false single-select matching
  whether `build-notes.json` contains `"best": true`
- each build project item gets a unique numeric `Update Priority` rank; its
  existing five-level `Character Priority` field supplies the popularity input
- each build issue contains an automatically maintained list of weapons and
  artifact sets released after `last_updated` that are not already referenced
  in that build's `weapons.json` or `artifacts-sets.json`
- missing build issues, project items, and fields are created automatically;
  managed build issues whose source folder no longer exists are deleted;
  unrelated project data is left alone

The generated release list uses `version_released` from `src/data`, English item
names from `src/i18n/en`, and the character's weapon type from `metadata.json`.
Build-level recommendation files take precedence over shared character-level
files.

Update ranks put builds already updated in the current version after every
older build, then sort a weighted score made from character priority (30%),
best role (20%), age since `last_updated` (40%), newer weapon count (5%), and
newer artifact-set count (5%); equal scores are ordered by issue title.

Human-written issue text
outside the generated release-audit markers is preserved.

Traveler uses its public slug (`anemo-traveler`, `pyro-traveler`, and so on) in
the combined issue title.

## Running it

Run `Sync Build Project` from the Actions tab. Select `dry_run` for a preview.
The workflow runs only when manually dispatched; pushes and pull requests do
not trigger it.

The token owner needs repository administrator access for the one-time deletion
of managed character parent issues.

The first real run can create several hundred issues and project items. The
script sends writes serially, pauses between them, and honors GitHub rate-limit
responses, so that run may take a while. Later runs only write actual changes.

To inspect the local inventory without a token or an API call:

```sh
npm run project:plan
```

With `GH_TOKEN` set, preview locally with:

```sh
npm run project:sync
```

Apply changes only after reviewing that output:

```sh
npm run project:sync:apply
```

The target can be changed with `ISSUE_REPOSITORY`, `PROJECT_OWNER`,
`PROJECT_NUMBER`, `PROJECT_FIELD_NAME`, `WEAPON_COUNT_FIELD_NAME`,
`ARTIFACT_SET_COUNT_FIELD_NAME`, `BEST_ROLE_FIELD_NAME`,
`CHARACTER_PRIORITY_FIELD_NAME`, or `UPDATE_PRIORITY_FIELD_NAME` environment
variables.
