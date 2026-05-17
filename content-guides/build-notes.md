# build-notes.json

`build-notes.json` defines the translated build title, the optional "best build"
badge, build-level editorial notes, and optional calculation credits.

```txt
src/content/<element>/<rarity>/<character>/<build>/build-notes.json
```

## Expected Shape

```json
{
  "best": true,
  "name": {
    "en": "[[element:melt]] DPS",
    "fr": "DPS [[element:melt]]"
  },
  "artifact": {
    "link": "https://example.com/artifact-calculation",
    "author": "AuthorName",
    "detail": "rotation notes"
  },
  "weapons": [
    {
      "link": "https://example.com/weapon-calculation-a",
      "author": "AuthorName",
      "detail": "single target"
    },
    {
      "link": "https://example.com/weapon-calculation-b",
      "author": "OtherAuthor"
    }
  ],
  "talent": {
    "link": "https://example.com/talent-calculation",
    "author": "AuthorName"
  },
  "global": {
    "link": "https://example.com/all-calculations",
    "author": "AuthorName"
  },
  "notes": [
    {
      "en": "Use **Markdown** and [[character:bennett]] here.",
      "fr": "Utilisez **Markdown** et [[character:bennett]] ici."
    }
  ]
}
```

## Fields

- `name`: Optional localized build title object.
  - `en` is the fallback title.
  - Other language keys are optional.
  - Supports inline translation tokens.
  - If `name` is missing, the site falls back to the build folder name.
- `best`: Optional boolean. Use `true` for the role/build the character best
  excels at. This shows a badge on the closed build card header.
- `artifact` or `artifacts`: Optional detailed artifact calculation credit.
- `weapons`: Optional detailed weapon calculation credit.
- `talent` or `talents`: Optional detailed talent calculation credit.
- `global`: Optional detailed calculation credit for the whole build.
- `notes`: Array of localized editorial note objects.
  - Each note item must include `en`. The requested language falls back to `en`.
  - Supports Markdown and inline translation tokens.
  - These notes appear directly under the main `Notes` title, before the
    Weapons, Artifacts, and Talents note sections.
  - Build-level notes do not add a `*` marker because they are not attached to
    one specific item.

## Detailed Calculation Credits

Use these optional objects to show detailed calculation links at the top of the
Notes card. Each category can be either one credit object or an array of credit
objects.

```json
{
  "artifact": {
    "link": "https://example.com/artifact-calculation",
    "author": "AuthorName",
    "detail": "4pc comparison"
  },
  "weapons": [
    {
      "link": "https://example.com/weapon-calculation-a",
      "author": "AuthorName",
      "detail": "single target"
    },
    {
      "link": "https://example.com/weapon-calculation-b",
      "author": "OtherAuthor"
    }
  ],
  "talent": {
    "link": "https://example.com/talent-calculation",
    "author": "AuthorName"
  },
  "global": {
    "link": "https://example.com/all-calculations",
    "author": "AuthorName"
  }
}
```

Each object has:

- `link`: URL opened by the detailed calculation link.
- `author`: Name shown after "Thank you to".
- `detail`: Optional text shown in parentheses after the detailed calculation
  link text. Supports inline translation tokens.

For example, this:

```json
{
  "weapons": {
    "link": "https://example.com/weapon-calculation",
    "author": "AuthorName",
    "detail": "single target"
  }
}
```

renders as:

```txt
Detailed weapons calculation (single target) - Thank you to AuthorName!
```

The current keys are intentionally:

- `artifact` or `artifacts`: Shows `Detailed artifacts calculation`
- `weapons`: Shows `Detailed weapons calculation`
- `talent` or `talents`: Shows `Detailed talents calculation`
- `global`: Shows `Detailed calculations`

## Build-Level Notes

Use this shape for regular build notes:

```json
{
  "notes": [
    {
      "en": "Required English fallback.",
      "fr": "Optional French translation."
    }
  ]
}
```

Example with Markdown, inline translation tokens, and multiple languages:

```json
{
  "notes": [
    {
      "en": "[[character:xingqiu]] needs enough [[stat:er]] to Burst every rotation.",
      "fr": "[[character:xingqiu]] a besoin d'assez de [[stat:er]] pour utiliser son dechainement a chaque rotation.",
      "es": "[[character:xingqiu]] necesita suficiente [[stat:er]] para usar su definitiva en cada rotacion."
    }
  ]
}
```

`en` is required. Other language keys are optional. If a translation is missing,
the site uses the English version.

## Where It Renders

Build-level notes render at the top of the Notes card, before these automatic
section note areas:

- `Regarding Weapons Choices:`
- `Regarding Artifacts Choices:`
- `Regarding Talents Choices:`

Use `build-notes.json` for comments about the whole build. Use item `note`
fields in `weapons.json`, `artifacts-sets.json`, `artifacts-mainstats.json`,
`artifacts-substats.json`, or `talents.json` when the note belongs to one
specific listed item and should add a `*` marker.
