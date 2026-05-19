# artifacts-substats.json

`artifacts-substats.json` defines substat priority for one build.

```txt
src/content/<element>/<rarity>/<character>/<build>/artifacts-substats.json
```

## Expected Shape

```json
{
  "notes": [
    {
      "en": "Substat priority changes after meeting the Energy Recharge target."
    }
  ],
  "substats_priority": [
    "er",
    {
      "name": "cr",
      "note": {
        "en": "Prioritize until your ratio is stable.",
        "fr": "Priorisez jusqu'a ce que votre ratio soit stable."
      }
    },
    {
      "items": [
        "atk%",
        "em"
      ]
    }
  ]
}
```

## Fields

- `substats_priority`: Ordered list of substats.
- `notes`: Optional top-level section notes shown under
  `Regarding Artifacts Choices:` without adding a `*` marker to any substat.
- Each item may be either:
  - a stat ID string, such as `"er"` or `"atk%"`
  - an object with `name` and optional `note`
  - an alternative group with `items`, where the first stat keeps the numbered
    rank and later stats render with `≈`
- `name`: Stat ID from `src/i18n/<lang>/stats.json`. Object names can also use
  inline translation tokens when a row needs custom text, such as
  `"[[stat:cr/cd]] / [[stat:hp%]]"`.
- `items`: List of stat strings or stat objects for same-rank alternatives.
- `note`: Optional localized editorial note. Adds a `*` marker beside the
  substat and renders in the `Substats` part of the artifact notes section.

## Notes

- String items are concise and should be used when no note is needed.
- Object items should be used when a substat needs an explanation, or when the
  row needs custom text with inline translation tokens.
- Adding `note` to a substat automatically adds a `*` marker next to that
  substat in the substat priority list.
- The same `note` also automatically creates a matching note entry under the
  `Substats` part of `Regarding Artifacts Choices:`.
- Notes support Markdown, inline translation tokens, and rotation notation
  popovers such as `{rot:N2C}`.

Example with the same note translated in different languages:

```json
{
  "name": "em",
  "note": {
    "en": "Use when reaction damage matters.",
    "fr": "A utiliser lorsque les degats de reaction sont importants."
  }
}
```

Example with a custom object name using inline translation tokens:

```json
{
  "name": "[[stat:cr/cd]] / [[stat:hp%]]"
}
```

This renders as:

```txt
CRIT Rate / CRIT DMG / HP%
```

## Alternative Groups

Alternative groups are useful when two stats share a priority slot.

```json
{
  "substats_priority": [
    {
      "name": "er",
      "note": {
        "en": "Prioritize first until you meet the requirement.",
        "fr": "Priorisez d'abord jusqu'a atteindre le besoin requis."
      }
    },
    "cr/cd",
    {
      "items": [
        "atk%",
        "em"
      ]
    }
  ]
}
```

This renders as:

```txt
1. Energy Recharge*
2. CRIT Rate / CRIT DMG
3. ATK%
≈ Elemental Mastery
```
