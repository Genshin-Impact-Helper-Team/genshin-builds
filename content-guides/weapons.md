# weapons.json

`weapons.json` defines ranked weapon recommendations for one build.

```txt
src/content/<element>/<rarity>/<character>/<build>/weapons.json
```

## Expected Shape

```json
{
  "notes": [
    {
      "en": "Weapon rankings assume the listed rotation and team buffs."
    }
  ],
  "weapons": [
    {
      "items": [
        "aqua-simulacra",
        {
          "name": "amos-bow",
          "refinement": 1,
          "note": {
            "en": "Good with [[stat:atk%]].",
            "fr": "Bon avec [[stat:atk%]]."
          }
        }
      ]
    }
  ],
  "conditional": [
    "aquila-favonia",
    {
      "name": "freedom-sworn",
      "refinement": "4+",
      "note": {
        "en": "Use only in the team described in notes.",
        "fr": "A utiliser seulement dans l'equipe decrite dans les notes."
      }
    }
  ]
}
```

## Fields

- `weapons`: Ordered ranking groups.
- `notes`: Optional section-level notes shown under
  `Regarding Weapons Choices:` without adding a `*` marker to any weapon.
- `weapons[].items`: Weapons in the same ranking position.
- `items[]`: Weapon i18n IDs or aliases, either as plain strings or as objects.
- `items[].name`: Weapon i18n ID or alias. Required when the item needs an
  object for `refinement` or `note`.
- `items[].refinement`: Optional refinement rank. Use a number for exact
  refinements, such as `5`, or a string for ranges, such as `"4+"`.
- `items[].note`: Optional localized editorial note. Adds a `*` marker beside
  the weapon and renders in the weapon notes section.
- `conditional`: Optional unranked weapon list shown below the ranking under
  `Conditional (See Notes):`.

## Ranked Weapons

Each entry in `weapons` is one ranking position.

Use one item for a normal ranking:

```json
{
  "items": [
    "aqua-simulacra",
    {
      "name": "amos-bow",
      "refinement": 1
    },
    {
      "name": "finale-of-the-deep",
      "refinement": "3+"
    }
  ]
}
```

This renders as:

```txt
1. Amos' Bow (5 ★) [R1]
2. Finale of the deep (4 ★) [R3+]
```

Use multiple items in the same `items` array when weapons are close enough to
share the same ranking position. The first item keeps the rank number, and later
items render as approximate alternatives with `≈`.

```json
{
  "items": ["amos-bow", "aqua-simulacra"]
}
```

This renders as:

```txt
1. Amos' Bow (5 ★)
≈ Aqua Simulacra (5 ★)
```

## Conditional Weapons

Use `conditional` for weapons that are only recommended under special conditions
explained in the notes.

Conditional weapons use the same item fields as ranked weapons:

```json
{
  "conditional": [
    "aquila-favonia",
    {
      "name": "primordial-jade-cutter",
      "note": {
        "en": "Only valuable when the build can use the passive well.",
        "fr": "Utile seulement si le build peut bien utiliser le passif."
      }
    }
  ]
}
```

## Notes

- Weapon rarity is pulled from `src/data/weapons/<weapon-type>.json`, where
  `<weapon-type>` comes from the character's `metadata.json` `weapon` field.
- Weapon aliases from `src/data/translation-aliases.json` can be used in
  `items[]` or `items[].name`, such as `"pjws"` for
  `"primordial-jade-winged-spear"`.
- When adding a weapon that is not in the shared weapon data yet, add it to the
  matching file (`bow.json`, `catalyst.json`, `claymore.json`, `polearm.json`,
  or `sword.json`) instead of adding `rarity` to the build.
- Adding `note` to a weapon automatically adds a `*` marker next to that weapon
  in the weapon ranking list.
- The same `note` also automatically creates a matching note entry under
  `Regarding Weapons Choices:`.
- `note` must include `en` because it is the fallback if no other translation
  was provided.
- Notes support Markdown, such as `**bold text**`, and inline translation
  tokens, such as `[[weapon:the-weapon-name]]`.

Example with the same note translated in different languages:

```json
{
  "name": "favonius-warbow",
  "note": {
    "en": "Useful when the team needs extra energy.",
    "fr": "Utile lorsque l'equipe a besoin de plus d'energie."
  }
}
```
