# talents.json

`talents.json` defines talent priority groups for one build.

```txt
src/content/<element>/<rarity>/<character>/<build>/talents.json
```

## Expected Shape

```json
{
  "notes": [
    {
      "en": "Talent priority assumes this build's main rotation."
    }
  ],
  "talents": [
    {
      "items": [
        {
          "name": "na",
          "note": {
            "en": "Level this first for Charged Attack builds.",
            "fr": "A monter en premier pour les builds d'attaques chargees."
          }
        }
      ]
    },
    {
      "approx": true,
      "items": [
        {
          "name": "skill"
        },
        {
          "name": "burst"
        }
      ]
    }
  ]
}
```

## Fields

- `talents`: Ordered priority groups.
- `notes`: Optional section-level notes shown under
  `Regarding Talents Choices:` without adding a `*` marker to any talent.
- `talents[].items`: Talents in the same priority position. Multiple items
  render on one line with `=`.
- `talents[].approx`: Optional boolean. Use `true` when multiple talents are
  close alternatives instead of exactly equal. Later items render below the
  numbered line with `≈`.
- `items[].name`: Talent ID from `src/i18n/<lang>/talents.json`.
  Current IDs are `na`, `ca`, `skill`, and `burst`.
- `items[].note`: Optional localized editorial note. Adds a `*` marker beside
  the talent and renders in the talent notes section.

## Notes

- Use talent IDs instead of display names when possible.
- Existing display strings such as `"Normal Attack"` still work, but they are
  not translated.
- Adding `note` to a talent automatically adds a `*` marker next to that talent
  in the talent priority list.
- The same `note` also automatically creates a matching note entry under
  `Regarding Talents Choices:`.
- Notes support Markdown, inline translation tokens such as
  `[[ability:skill]]`, and rotation notation popovers such as `{rot:N2C}`.

## Equal Priority

Use multiple items in the same priority group when talents should be leveled
equally:

```json
{
  "talents": [
    {
      "items": [
        {
          "name": "burst"
        },
        {
          "name": "skill",
          "note": {
            "en": "Prioritize [[ability:skill]] first if this character is mainly used for shielding.",
            "fr": "Priorisez le [[ability:skill]] si ce personnage est surtout utilise pour son bouclier."
          }
        }
      ]
    }
  ]
}
```

This renders as:

```txt
1. Burst = Skill*
```

## Approximate Priority

Use `approx: true` when later talents should render as approximate alternatives:

```json
{
  "talents": [
    {
      "approx": true,
      "items": [
        {
          "name": "skill"
        },
        {
          "name": "na"
        }
      ]
    }
  ]
}
```

This renders as:

```txt
1. Skill
≈ Normal Attack
```

## Translated Note Example

```json
{
  "name": "burst",
  "note": {
    "en": "Level [[ability:burst]] first if most of the build's damage comes from it.",
    "fr": "Montez l'[[ability:burst]] en premier si la majorite des degats du build viennent de lui."
  }
}
```
