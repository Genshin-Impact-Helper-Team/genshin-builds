# Content JSON Architecture

This folder documents the expected shape of the JSON files under `src/content`.
These files are for contributor to read and understand how the JSONs must be written for it to be interpreted and displayed properly on the website.

## Folder Layout

Character content is organized by element, rarity, character slug, then build
slug:

```txt
src/content/<element>/<rarity>/<character>/<build>/
```

Example:

```txt
src/content/pyro/4/amber/melt-DPS/
```

Character-level files live directly inside the character folder:

```txt
src/content/pyro/4/amber/metadata.json
src/content/pyro/4/amber/splash_art.webp
src/content/pyro/4/amber/portrait.webp
```

`metadata.json` is used for character display data and the home page character
filters. `splash_art.webp` and `portrait.webp` are preferred for character
images when present; the `image` and `portrait` URLs in `metadata.json` stay as
official fallback sources.

Build-level files live inside each build folder:

```txt
src/content/pyro/4/amber/melt-DPS/weapons.json
src/content/pyro/4/amber/melt-DPS/artifacts-sets.json
src/content/pyro/4/amber/melt-DPS/artifacts-mainstats.json
src/content/pyro/4/amber/melt-DPS/artifacts-substats.json
src/content/pyro/4/amber/melt-DPS/talents.json
src/content/pyro/4/amber/melt-DPS/build-notes.json
```

## Character Defaults and Build Overrides

Build JSON files can be shared at the character level to avoid duplicating
common data across builds.

When the site loads a build JSON file, it checks in this order:

```txt
1. src/content/<element>/<rarity>/<character>/<build>/<file>.json
2. src/content/<element>/<rarity>/<character>/<file>.json
```

If the build folder contains the file, that build-specific file is used. If the
build folder does not contain the file, the character-level file is used as the
default.

This is useful when multiple builds share the same values. For example, if two
Amber builds use the same artifact main stats, place the shared file here:

```txt
src/content/pyro/4/amber/artifacts-mainstats.json
```

Then only add this file inside a specific build folder when that build needs to
override the shared defaults:

```txt
src/content/pyro/4/amber/melt-DPS/artifacts-mainstats.json
```

This default-and-override behavior applies to build data loaded through the
content loader, including:

- `weapons.json`
- `artifacts-sets.json`
- `artifacts-mainstats.json`
- `artifacts-substats.json`
- `talents.json`
- `build-notes.json`

## Shared Rules

- Folder names are stable slugs and should not be translated.
- Gameplay names usually use IDs from `src/i18n/<lang>/*.json`.
- Weapon rarity, stats, and passive data live in `src/data/weapons/<weapon-type>.json`. Build
  `weapons.json` files should list weapon IDs, refinements, and notes only.
- Artifact set rarity and set effects live in `src/data/artifacts/artifact_sets.json`. Build
  `artifacts-sets.json` files should list artifact set IDs, rankings, and notes only.
- Notes are translated directly inside the JSONs
- Notes, when present, must include `en`; other languages are optional.
- Requested language falls back to `en`.
- Notes support Markdown (adding `**` around a work to make it bold for example), inline translation tokens, and rotation notation popovers.
- Item notes automatically add a `*` marker next to the item and create a
  matching entry in the relevant notes section.
- Top-level section notes do not add a `*` marker because they are not attached
  to one specific item.

## Recently Updated Home Filter

The home page `Recently updated` filter is generated automatically from content
data. The site reads `src/content/site/changelog.json`, uses the first item in
`groups` as the latest changelog version, then compares that version with each
character metadata file:

```txt
src/content/<element>/<rarity>/<character>/metadata.json
```

A character appears in the filter when its `last_updated` value matches the
latest changelog `version`. Extra spaces and spacing around `/` are normalized,
so `6.6/Luna VII` and `6.6 / Luna VII` match, but contributors should still copy
the version format from the changelog to avoid mistakes.

If no character matches the latest changelog version, the filter is not shown.

## Section-Level Notes

Build data files can include top-level `notes` for comments that belong to the
whole section instead of one specific item.

Example:

```json
{
  "notes": [
    {
      "en": "This ranking assumes the team can maintain the required aura.",
      "fr": "Ce classement suppose que l'équipe peut maintenir l'aura requise."
    }
  ],
  "artifact_sets": []
}
```

Section-level notes render inside the matching notes section, such as
`Regarding Artifacts Choices:`, without adding a `*` marker to any listed item.

## Item-Level Notes

Use an item-level `note` when the explanation belongs to one specific weapon,
artifact, stat, or talent.

Example:

```json
{
  "name": "favonius-warbow",
  "note": {
    "en": "Useful when the team needs extra energy.",
    "fr": "Utile lorsque l'equipe a besoin de plus d'energie."
  }
}
```

This automatically:

- adds a `*` marker next to the item in the build card
- creates the matching entry under the correct notes heading

For example, weapon notes render under `Regarding Weapons Choices:`, artifact
notes render under `Regarding Artifacts Choices:`, and talent notes render under
`Regarding Talents Choices:`.

## What To Edit

- Use [metadata.md](./metadata.md) for character images, weapon type, and
  update version.
- Use [build-notes.md](./build-notes.md) for the build title, best-build badge,
  build-wide notes, and calculation credits.
- Use [weapons.md](./weapons.md) for ranked weapons and conditional weapons.
- Use [artifacts-sets.md](./artifacts-sets.md) for artifact set rankings and
  conditional artifact sets.
- Use [artifacts-mainstats.md](./artifacts-mainstats.md) for sands, goblet, and
  circlet main stats.
- Use [artifacts-substats.md](./artifacts-substats.md) for substat priority.
- Use [talents.md](./talents.md) for talent priority.
- You can copy the content of [json-base](./json-base) to have a pre-made structure for the different jsons

## Data and i18n Files

Shared gameplay data lives in [`src/data`](../src/data). Use it for reusable
weapon data and artifact set effects. Do not put build rankings or build notes
there.

## i18n Dictionary Files

Each language folder can contain these translation dictionaries:

```txt
src/i18n/<lang>/weapons.json
src/i18n/<lang>/artifact-sets.json
src/i18n/<lang>/characters.json
src/i18n/<lang>/stats.json
src/i18n/<lang>/elements.json
src/i18n/<lang>/ui.json
```

Use `stats.json` for stat labels and stat-like pseudo-set labels, such as `er`,
`atk%`, `cr`, `em-set`, and `atk-set`.

Use `elements.json` for elemental labels and reactions, such as `melt`,
`vaporize`, `swirl`, and `bloom`.

## Inline Translation Tokens

For the full token rules and examples, read
[Inline Translation Tokens](../src/i18n/README.md#inline-translation-tokens).

Editorial text can reference i18n IDs:

```txt
[[weapon:amos-bow]]
[[set:noblesse-oblige]]
[[character:xingqiu]]
[[stat:er]]
[[element:melt]]
[[er]]
```

Typed tokens search a specific category. Untyped tokens search known categories.

## Rotation Notation Popovers

Use `{rot:...}` in note text when a rotation or combo notation should show the
standard keybind legend popover:

```txt
{rot:N2C}
{rot:Q > N2 E > N2 E}
```

The text inside the marker is what readers see. The popover text is translated
from the selected site language when available and falls back to English.

## File Guides

- [metadata.md](./metadata.md)
- [build-notes.md](./build-notes.md)
- [weapons.md](./weapons.md)
- [artifacts-sets.md](./artifacts-sets.md)
- [artifacts-mainstats.md](./artifacts-mainstats.md)
- [artifacts-substats.md](./artifacts-substats.md)
- [talents.md](./talents.md)
