# Gameplay Data

This folder contains shared gameplay data used by the website.

Unlike `src/content`, this folder is not where character build recommendations
are written. It is where reusable item data lives: weapon stats, weapon passives,
and artifact set effects.

The site combines this data with `src/i18n` dictionaries and the build JSONs in
`src/content` to display localized names, popovers, and build sections.

## Folder Layout

```txt
src/data/
|-- artifacts/
|   |-- artifact_sets.json
|-- weapons/
|   |-- bow.json
|   |-- catalyst.json
|   |-- claymore.json
|   |-- polearm.json
|   |-- sword.json
```

Matching static item images live separately under:

```txt
public/item-assets/artifacts/<artifact-set-id>.webp
public/item-assets/weapons/<weapon-type>/<weapon-id>.webp
```

## How It Connects To Content

Build files usually store IDs, not full display data.

Example in a build file:

```json
{
  "name": "the-catch"
}
```

The site then uses:

- `src/content/.../weapons.json` to know which weapon is recommended.
- `src/i18n/<lang>/weapons.json` to display the localized weapon name.
- `src/data/weapons/<weapon-type>.json` to display weapon rarity, stats, and
  passive information in the weapon popover.
- `public/item-assets/weapons/<weapon-type>/<weapon-id>.webp` to display its
  image.

Artifact sets work the same way:

- `src/content/.../artifacts-sets.json` stores artifact set IDs.
- `src/i18n/<lang>/artifact-sets.json` displays localized artifact set names.
- `src/data/artifacts/artifact_sets.json` displays rarity and set effects in
  the artifact popover.
- `public/item-assets/artifacts/<artifact-set-id>.webp` displays its image.

## Weapon Data

Weapon data is split by weapon type.

Each weapon entry uses the same ID as the matching i18n entry:

```txt
src/i18n/<lang>/weapons.json
src/data/weapons/<weapon-type>.json
```

A weapon entry can include:

- `rarity`: weapon rarity.
- `source`: special availability source ID shown in the weapon popover footer,
  when relevant. The display text is translated through
  `src/i18n/<lang>/ui.json` using keys like `Weapon source Craft`. Omitted
  sources display the translated `Weapon source Wish` value. `Craft`,
  `Fishing`, and `Exploration` are also marked as free weapons in rankings and
  inline weapon popovers.
- `passive`: localized passive text.
- `substat`: stat ID, usually from `src/i18n/<lang>/stats.json`.
- `level_1`: base attack and substat value at level 1.
- `level_max`: base attack and substat value at max level.
- `r1` to `r5`: refinement values inserted into the passive text.

Passive text can use `{{value}}` placeholders. The popover replaces these with
the correct refinement values.

## Artifact Set Data

Artifact set data lives in:

```txt
src/data/artifacts/artifact_sets.json
```

Each artifact set entry uses the same ID as the matching i18n entry:

```txt
src/i18n/<lang>/artifact-sets.json
src/data/artifacts/artifact_sets.json
```

An artifact set entry can include:

- `rarity`: highest rarity for the set.
- `1p`: localized 1-piece effect, when the set has one.
- `2p`: localized 2-piece effect, when the set has one.
- `4p`: localized 4-piece effect, when the set has one.

Most artifact sets only have `2p` and `4p`. Do not add an empty `1p` field when
the set does not have a 1-piece effect.

## Item Images

Download matching WebPs from HoYoWiki with:

```sh
npm run download:weapon-assets -- <weapon-id>
npm run download:artifact-assets -- <artifact-set-id>
```

Both commands also accept `--all`, `--file <path>`, `--force`, and `--dry-run`.
The downloaded files are written to the matching `public/item-assets` folder.

## Localization Rules

Gameplay data can contain localized effect text directly, such as weapon
passives or artifact set effects.

Names do not live here. Names live in `src/i18n/<lang>/*.json`.

When adding localized effect text:

- Always add `en` first.
- Other languages are optional.
- The site falls back to English when the selected language is missing.
- Keep IDs stable and do not translate them.

## When To Edit This Folder

Edit this folder when you need to add or fix reusable gameplay data, such as:

- a missing weapon passive;
- an incorrect weapon stat;
- a missing artifact set effect;
- an incorrect artifact set rarity;
- a new weapon or artifact set used by build content.

Use the item image commands above when that ID also needs a local image.

Do not edit this folder for build rankings, character notes, or translation-only
name changes. Use these folders instead:

- `src/content` for build recommendations and notes.
- `src/i18n` for translated names and UI labels.

## Important Rules

- Keep JSON valid: double quotes, commas between entries, and no trailing comma
  after the last entry.
- Use the same ID in `src/data`, `src/i18n`, and `src/content`.
- Do not translate IDs.
- Add English fallback text for any localized effect.
- Keep weapon data in the correct weapon-type file.
- Do not duplicate build-specific notes here. Put those in the relevant build
  JSON under `src/content`.
