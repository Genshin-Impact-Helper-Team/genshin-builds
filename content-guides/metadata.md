# metadata.json

`metadata.json` describes character-level display metadata. It lives in the
character folder, not inside a build folder.

The site also uses this file to build the character cards on the home page,
including the data used by homepage filters.

```txt
src/content/<element>/<rarity>/<character>/metadata.json
```

## Expected Shape

```json
{
  "weapon": "bow",
  "last_updated": "5.7",
  "image": "https://example.com/character-full.webp",
  "portrait": "https://example.com/character-icon.webp"
}
```

## Fields

- `weapon`: Character weapon type used by the home page character data,
  filtering, and shared weapon rarity lookup. Common values are `sword`,
  `claymore`, `polearm`, `bow`, and `catalyst`. This must match one of the
  files in `src/data/weapons`.
- `last_updated`: Genshin version string shown in the page header and used by
  the home page `Recently updated` filter.
- `image`: Official fallback URL for the large character image shown in the
  character page header. Should come from the official HoYoWiki.
- `portrait`: Official fallback URL for the small character icon used on the
  home page character list. Should come from the Hoyolab Battle Chronicles
  Character list.

## Recently Updated Filter

The home page checks the latest version from the first `groups` item in
`src/content/site/changelog.json`.

When a character should appear under the `Recently updated` filter, set
`last_updated` to the same version:

```json
{
  "last_updated": "6.6 / Luna VII"
}
```

The comparison trims extra spaces and normalizes spacing around `/`. For
clarity, still copy the version exactly as it appears in the changelog. If the
value does not match the latest changelog version, the character remains visible
in the normal roster but will not appear when the `Recently updated` filter is
checked.

## Images

Hosted image files can live directly inside the character folder:

```txt
src/content/<element>/<rarity>/<character>/splash_art.webp
src/content/<element>/<rarity>/<character>/portrait.webp
```

If those files exist, the site uses them before the URLs in `metadata.json`.
The metadata URLs still need to stay filled in because they are the fallback
when a local file is missing.

The hosted files must be real WebP images and must use these exact names:

- `splash_art.webp`: local file for the `image` field.
- `portrait.webp`: local file for the `portrait` field.

Both fallback URLs must come from official sources:

```txt
https://wiki.hoyolab.com/pc/genshin/home
https://act.hoyolab.com/app/community-game-records-sea/index.html
```

- Use the wish character image from hoyowiki for `image`.
- Use the small character icon from the hoyolab battle chronicles for `portrait`.
- Do not use fan wiki, cropped screenshots, or unofficial image links.
- We're using the battle chronicles portrait because the images are of higher quality, and won't look blurry on mobile.

## Folder Values

Some character information does not live inside `metadata.json`; it comes from
the folder path instead.

```txt
src/content/<element>/<rarity>/<character>/metadata.json
```

- `<element>` controls the character page theme color and the element filter on
  the home page.
- `<rarity>` controls the rarity filter on the home page.
- `<character>` is the character slug used in URLs and translation lookups.

Example:

```txt
src/content/pyro/4/amber/metadata.json
```

This means:

- element: `pyro`
- rarity: `4`
- character slug: `amber`
