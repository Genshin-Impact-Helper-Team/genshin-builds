# Translation Dictionaries

This folder contains the shared translation dictionaries used by the site.

Each language has its own folder and each language folder **must contain the
same dictionary files**. After a language is registered in
`src/utils/languages.ts`, these JSON files are loaded automatically.

## How It Works

Build files and inline translation tokens store IDs instead of display names. The site looks up that ID in the current language dictionary and displays the translated text. Shared weapon and artifact popover details come from `src/data`.

For example, `the-catch` is stored in:

```txt
src/i18n/<lang>/weapons.json
```

If a translation is missing in the current language, the site falls back to
English.
Missing translations will also appear as `[i18n] Missing translation...` warnings in the browser console to easily catch forgotten translations.

## Which File to Edit

Use:

- `weapons.json` for weapon names. Weapon stats and passive data live in `src/data/weapons`.
- `artifact-sets.json` for artifact set names. Artifact set effects live in `src/data/artifacts/artifact_sets.json`.
- `characters.json` for character names.
- `stats.json` for stats and stat-like labels, such as `er`, `atk%`, `em-set`,
  or `atk-set`.
- `elements.json` for elements and reactions, such as `pyro`, `melt`,
  `vaporize`, or `bloom`.
- `abilities.json` for talent names, such as `normal-attack`, `charged-attack`,
  `skill`, and `burst`.
- `notes.json` for reusable note labels referenced by inline tokens.
- `ui.json` for website labels, section titles, buttons, and general interface
  text.

## Add a New Term

1. Choose a stable ID.

   Use lowercase English words separated with hyphens:

   ```txt
   emblem-of-severed-fate
   the-catch
   kamisato-ayaka
   ```

2. Add the ID to the English dictionary first.

   English is the fallback language, so every new ID should exist in `en`.

   Example in `src/i18n/en/weapons.json`:

   ```json
   {
     "the-catch": "The Catch"
   }
   ```

3. Add the same ID to other language folders when possible.

   Example in `src/i18n/fr/weapons.json`:

   ```json
   {
     "the-catch": "La Prise"
   }
   ```

4. Use the ID in content files.

   Example in a build file:

   ```json
   {
     "name": "the-catch"
   }
   ```

## Inline Translation Tokens

Notes can include translation tokens.

Typed tokens search one specific dictionary:

```txt
[[weapon:the-catch]]
[[set:emblem-of-severed-fate]]
[[character:xiangling]]
[[stat:er]]
[[element:vaporize]]
[[ability:burst]]
```

Untyped tokens search known gameplay dictionaries automatically:

```txt
[[er]]
[[vaporize]]
```

Typed tokens are safer when an ID could exist in more than one dictionary.

### Custom Visible Text

Add `|text` when a sentence needs a different visible form, while still
resolving the original ID for translations and popovers:

```txt
[[weapon:favonius-greatsword|Двуручного меча Фавония]]
[[set:noblesse-oblige|Noblesse Oblige]]
```

This is useful for languages with case or grammar changes. For weapon and set
tokens, the custom text is used as the hover/click trigger, while the popover
still loads the canonical weapon or set details.

## Aliases

Short aliases live in:

```txt
src/data/translation-aliases.json
```

Use aliases when you want shorter IDs to point to the same canonical weapon or
artifact set ID without duplicating translations or gameplay data. Aliases work
in inline tokens and in content item `name` fields.

```json
{
  "weapon": {
    "pjws": "primordial-jade-winged-spear"
  },
  "set": {
    "vv": "viridescent-venerer"
  }
}
```

Then both of these resolve to the same translated name and weapon popover:

```txt
[[weapon:primordial-jade-winged-spear]]
[[weapon:pjws]]
```

And both of these resolve to the same translated artifact set name and set
popover:

```txt
[[set:viridescent-venerer]]
[[set:vv]]
```

You can also use the alias directly in content:

```json
{
  "name": "vv",
  "pieces": 4
}
```

Aliases are only alternate IDs. Keep the real translation and data entries on
the canonical ID.

## Important Rules

- Do not translate IDs. Only translate the values.
- Keep the same ID across all language files.
- Keep JSON valid: use double quotes, commas between entries, and no trailing
  comma after the last entry.
- Add new English entries first, then translate them into other languages.
- If you are unsure about JSON formatting, add the `Needs Format Check` label
  to your Pull Request.
- Each language folder must contain `weapons.json`, `artifact-sets.json`,
  `characters.json`, `stats.json`, `elements.json`, `abilities.json`, `ui.json`,
  and `notes.json`, even when a dictionary is empty (`{}`).
