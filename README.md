# Genshin Builds

## Table of Contents

- [Website](#website)
- [Project Structure](#project-structure)
  - [Contributor View](#contributor-view)
  - [Developer View](#developer-view)
- [Contributing Content](#contributing-content)
  - [Step 1: Create a Branch](#step-1-create-a-branch)
  - [Step 2: Edit Files](#step-2-edit-files)
  - [Step 3: Open a Pull Request](#step-3-open-a-pull-request)
- [Add a Build for a Character](#1-add-a-build-for-a-character)
- [Translate a Build](#2-translate-a-build)
- [Add a New Language](#3-add-a-new-language)
- [Developer Setup](#developer-setup)

---

## Website

The current website is here:

https://akhalaplo.github.io/genshin-builds/

The website shows the content that has been accepted into the branch `main` at all times: any changes made on `main` will be reflected on the website.

When a Pull Request is approved and merged into `main`, GitHub **automatically** updates the website. You do not need to publish anything yourself. The update may take a few minutes to appear online.

---

## Project Structure

Here are simplified views of the repository, depending on what you want to
change.

### Contributor View

Most content contributors will work in these folders:

```txt
genshin-builds/
|-- content-guides/          Guides that explain how content JSON files work
|-- src/
|   |-- content/             Character builds and shared site content
|   |   |-- <element>/
|   |   |   |-- <rarity>/
|   |   |   |   |-- <character>/
|   |   |   |   |   |-- metadata.json
|   |   |   |   |   |-- <build>/
|   |   |   |   |   |   |-- weapons.json
|   |   |   |   |   |   |-- artifacts-sets.json
|   |   |   |   |   |   |-- artifacts-mainstats.json
|   |   |   |   |   |   |-- artifacts-substats.json
|   |   |   |   |   |   |-- talents.json
|   |   |   |   |   |   |-- build-notes.json
|   |   |-- site/            FAQ, credits, and changelog content
|   |-- data/                Shared gameplay data for weapons and artifact sets
|   |-- i18n/                Translation dictionaries for each language
|-- README.md                Main contribution guide
```

### Developer View

Developers may also work in these folders:

```txt
genshin-builds/
|-- .github/workflows/       GitHub automation, including website deployment
|-- public/                  Static files, such as the site favicon
|-- src/
|   |-- components/          Reusable parts of the website
|   |-- layouts/             Page layouts
|   |-- pages/               Website pages and routes
|   |-- styles/              CSS files
|   |-- utils/               Site helper code
|-- astro.config.mjs         Astro site configuration
|-- package.json             Project scripts and dependencies
```

---

## Contributing Content

If you want to add a new build, update existing recommendations, improve translations, or add a new language, **open a Pull Request (PR)** with the smallest focused change that completes the work.

You do not need to use the command line. You can make content changes **directly from the GitHub website: you just need to be logged in.**

### Step 1: Create a Branch

> Name your branch according to the changes you're going to make:
>
> - Use `content/...` when adding or changing character build content.
> - Use `translation/...` when translating existing content.
> - Use `i18n/add-...` when adding a new language to the site.
> - Use `fix/...` for small bug fixes.
> - Use `refacto/...` for changes made to the website itself or the json parsing.
> - Use `docs/...` for README or documentation changes.
>
> Branch names must be in english and use lowercase letters, numbers, and hyphens only.  
> Use `/` only to separate the branch type from the description. Do not use spaces, underscores, uppercase letters, or special characters.

_Examples:_

```txt
content/amber-melt-dps
content/xiangling-energy-notes
translation/fr-xingqiu-notes
translation/es-ui-labels
i18n/add-ja
fix/mobile-side-menu
docs/root-readme
```

#### How to:

1. Open the repository on GitHub.
2. Click the branch selector near the top left. It usually says `main`.
3. Type your new branch name in the search box.
4. Click `Create branch: <your-branch-name> from main`.
5. Make sure GitHub now shows your new branch name instead of `main`.

**Goal:** Your changes should happen on your own branch, NEVER directly on `main`.
> This is to prevent any unvoluntarily changes to be made to the website, as the website always displays the content on `main`. If a mistake is made on `main` for example, the website will be broken and thus unavailable until the mistake is fixed, whereas if it was made on a different branch, nothing happens to the website.

### Step 2: Edit Files

1. Open the file you want to change.
2. Click the pencil icon, usually labeled `Edit this file`.
3. Make your changes in the editor.
4. Click `Commit changes...`.
5. Add a commit message that descibes the changes you just made. It will be useful to know what was changed if we need to revert changes at some point.
6. Choose `Commit directly to the <your-branch-name> branch`. **Reminder: Never on `main`**
7. Click `Commit changes`.

**Goal:** Save your edits to your branch so they can be reviewed.

### Step 3: Open a Pull Request

> Before opening your Pull Request, make sure:
>
> - Your PR title is the same as your branch name.
> - Your PR is based on `main`.
> - Your PR has only one topic: one character build, one translation pass, or one new language setup.
> - You updated the changelog in [`src/content/site/changelog.json`](./src/content/site/changelog.json)
> - You did not translate folder names or route slugs.
> - You did not edit generated files in `dist`.
> - Any localized content has an English fallback.
> - GitHub will automatically check that the site builds when you open or update the PR.
> - If the build check fails, ask for help before the PR is merged.
> - If you are unsure about JSON formatting, add the `Needs Format Check` label so someone can check it.

#### How to:

1. After committing your changes, GitHub may show a `Compare & pull request`
   button. Click it.
2. If you do not see the button, go to the `Pull requests` tab and click
   `New pull request`.
3. Set the base branch to `main` and the compare branch to your branch.
4. In the PR description, explain what changed, which character/build/language is affected, if it needs translation, and any other useful information. You can even tag specific contributors if you need their opinion or what to notify them of a change.
5. Click `Create pull request`.

**Goal:** Ask for your changes to be added to the site.

#### Pull Request Labels

Use this label when you need help before the PR can be merged:

- `Needs Format Check`: use this if you are unsure about JSON formatting and need someone to check it.

---

## Add a Build for a Character

The website is built on our folder structure: adding a new folder will automatically add a new section to a character's page, or to the homepage.

1. Read the documentation in the [`content-guides`](./content-guides) folder. It explains how each JSON content file should be written.

2. Find the correct character folder in [`src/content`](./src/content).

3. Make sure the character folder has `metadata.json`.

4. Add or update the build/character files.

   A build folder can contain these files:

   - `metadata.json`: see [`content-guides/metadata.md`](./content-guides/metadata.md)
   - `weapons.json`: see [`content-guides/weapons.md`](./content-guides/weapons.md)
   - `artifacts-sets.json`: see [`content-guides/artifacts-sets.md`](./content-guides/artifacts-sets.md)
   - `artifacts-mainstats.json`: see [`content-guides/artifacts-mainstats.md`](./content-guides/artifacts-mainstats.md)
   - `artifacts-substats.json`: see [`content-guides/artifacts-substats.md`](./content-guides/artifacts-substats.md)
   - `talents.json`: see [`content-guides/talents.md`](./content-guides/talents.md)
   - `build-notes.json`: see [`content-guides/build-notes.md`](./content-guides/build-notes.md)

5. Use character-level shared defaults when useful.

   Some files can live directly in the character folder. If a build does not
   have its own copy of a file, the site falls back to the character-level
   version.

   Examples:

   - [`src/content/pyro/4/xiangling/artifacts-mainstats.json`](./src/content/pyro/4/xiangling/artifacts-mainstats.json)
   - [`src/content/pyro/4/xiangling/off-field-dps/weapons.json`](./src/content/pyro/4/xiangling/off-field-dps/weapons.json)

6. Use Markdown and inline translation tokens in notes when possible. This gives a first localized base while waiting for translator to go over the new sections.

   The inline translation tokens are usually the english name with a - instead of a space or special character.
   You can find the translation tokens to use under the [`src/i18n`](./src/i18n) folder. Shared weapon and artifact popover data lives in [`src/data`](./src/data).

   Example:

   ```txt
   Use [[weapon:the-catch]] with [[artifact:emblem-of-severed-fate]].
   ```

7. Keep folder names stable.

   Do not translate folder names, character slugs, build slugs, element folders,
   or rarity folders.

---

## Translate a Build

The default language is english. When adding a new build, contributor may have used inline translation tokens [[like this]] to provide automatically translated terms like weapon/character/artifact set names. If contributed properly, the only part left to translate are the notes.

1. Edit the build content files under [`src/content`](./src/content).

2. Add the target language to localized text objects.

   Most build JSON supports localized text objects. English is the required
   fallback, and other languages are optional:

   ```json
   {
     "en": "English note.",
     "fr": "French note."
   }
   ```

3. Use Markdown and inline translation tokens in notes when useful.

   Example:

   ```txt
   Use [[weapon:the-catch]] with [[artifact:emblem-of-severed-fate]].
   ```

4. Add or update dictionary labels when needed.

   Gameplay names and inline translation tokens come from dictionary IDs. Add
   or update those labels in:

   ```txt
   src/i18n/<lang>/weapons.json
   src/i18n/<lang>/artifact-sets.json
   src/i18n/<lang>/characters.json
   src/i18n/<lang>/stats.json
   src/i18n/<lang>/elements.json
   src/i18n/<lang>/ui.json
   ```

5. GitHub will automatically check that the site builds when you open or update
   the Pull Request.

   Developers can still run the build locally before opening a Pull Request:

   ```sh
   npm run build
   ```

   Missing translations are printed as `[i18n] Missing translation...` warnings.

---

## Add a New Language

The website was designed with localisation in mind. Adding a new language should be fairly easy if you follow these steps:

1. Choose a short language code.

   For example: `pt` or `ja`.

2. Create copy of the [`src/i18n/en`](./src/i18n/en) folder and rename it using that short language code.

   You can then translate its content in your language. More information can be found in [`src/i18n/README.md`](./src/i18n/README.md).

3. Register the language in [`src/utils/languages.ts`](./src/utils/languages.ts).

   ```ts
   { code: '<lang>', name: 'Language Name' }
   ```

4. Add the new language to [`src/utils/i18n.ts`](./src/utils/i18n.ts).

   Import the new JSON files, then add the new locale to the `locales` object:

   ```ts
   <lang>: {
     weapon: <lang>Weapons,
     artifact: <lang>Artifacts,
     character: <lang>Characters,
     stat: <lang>Stats,
     element: <lang>Elements,
     ui: <lang>Ui,
   }
   ```

5. Translate localized editorial text in [`src/content`](./src/content).

   This includes build notes, FAQ content, and credits. Content that does not
   have the new language key will fall back to English.

6. GitHub will automatically check that the site builds when you open or update
   the Pull Request.

   Developers can still run the build locally before opening a Pull Request:

   ```sh
   npm run build
   ```

   This generates routes for the new language because routes use the language
   list from [`src/utils/languages.ts`](./src/utils/languages.ts).

---

## Developer Setup

This section is for contributors who can run the project locally.

Requirements:

- Node.js `22.12.0` or newer
- npm

Install dependencies:

```sh
npm install
```

Run the local development server:

```sh
npm run dev
```

Build the website:

```sh
npm run build
```

Preview the built website locally:

```sh
npm run preview
```

Before merging a Pull Request, the GitHub build check must pass. Developers can also run `npm run build` locally when they want to test changes before opening a Pull Request.