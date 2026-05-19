# artifacts-mainstats.json

`artifacts-mainstats.json` defines main stat priorities for sands, goblet, and
circlet.

```txt
src/content/<element>/<rarity>/<character>/<build>/artifacts-mainstats.json
```

## Expected Shape

```json
{
  "main_stats": {
    "sands": [
      "er",
      "atk%",
      {
        "name": "em",
        "note": {
          "en": "Use when reaction damage matters."
        }
      }
    ],
    "goblet": [
      {
        "name": "pyro-dmg"
      }
    ],
    "circlet": [
      {
        "name": "cr"
      }
    ]
  },
  "notes": [
    {
      "en": "Main stat rankings assume the listed [[stat:er]] target is met."
    }
  ]
}
```

## Fields

- `main_stats`: Object containing exactly these artifact slots:
  - `sands`
  - `goblet`
  - `circlet`
- Each slot is an ordered array of stat items.
- A stat item can be either:
  - A string stat ID, such as `"er"` or `"atk%"`.
  - An object with `name` and optional `note`.
- `name`: Main stat ID or display string.
- `note`: Optional localized editorial note. Use this only on object stat
  items.
- `notes`: Optional top-level section notes shown under
  `Regarding Artifacts Choices:` without adding a `*` marker to any stat.

## Notes

- Stat IDs such as `atk%`, `em`, `cr`, and `cd` are translated through
  `src/i18n/<lang>/stats.json`.
- Custom display strings such as `Pyro DMG` can be used when no i18n ID exists.
- Adding `note` to an object stat automatically adds a `*` marker next to that
  stat in the main stat list.
- The same `note` also automatically creates a matching note entry under the
  `Main Stats` part of `Regarding Artifacts Choices:`.
- Notes support Markdown, inline translation tokens, and rotation notation
  popovers such as `{rot:N2C}`.

Example with the same note translated in different languages:

```json
{
  "name": "em",
  "note": {
    "en": "Use when reaction damage matters.",
    "fr": "A utiliser lorsque les dégâts de reaction sont importants."
  }
}
```
