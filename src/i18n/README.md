# Translation Dictionaries

This folder contains the shared translation dictionaries used by the site.

Each language has its own folder and each language folder **must contain the same dictionary files**.

## How It Works

Build files and inline translation tokens store IDs instead of display names. The site looks up that ID in the current language dictionary and displays the translated text.

For example, `the-catch` is stored in:

```txt
src/i18n/<lang>/weapons.json
```

If a translation is missing in the current language, the site falls back to
English.
Missing translations will also appear as `[i18n] Missing translation...` warnings in the browser console to easily catch forgotten translations.

## Which File to Edit

Use:

- `weapons.json` for weapon names.
- `artifact-sets.json` for artifact set names.
- `characters.json` for character names.
- `stats.json` for stats and stat-like labels, such as `er`, `atk%`, `em-set`,
  or `atk-set`.
- `elements.json` for elements and reactions, such as `pyro`, `melt`,
  `vaporize`, or `bloom`.
- `talents.json` for talent names, such as `normal-attack`, `charged-attack`,
  `skill`, and `burst`.
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
[[artifact:emblem-of-severed-fate]]
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

## Important Rules

- Do not translate IDs. Only translate the values.
- Keep the same ID across all language files.
- Keep JSON valid: use double quotes, commas between entries, and no trailing
  comma after the last entry.
- Add new English entries first, then translate them into other languages.
- If you are unsure about JSON formatting, add the `Needs Format Check` label
  to your Pull Request.
- Each language folder needs to contain the same files, even if they contain an empty dictionary (`{}`). If you create a new file to in the ./en folder (if a file was starting to get too long and you decide to split it into two files for example), make sure to add it to the other languages folders too!
