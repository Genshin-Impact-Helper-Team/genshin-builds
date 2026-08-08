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
  "version_released": "3.3"
}
```

## Fields

- `weapon`: Character weapon type used by the home page character data,
  filtering, and shared weapon rarity lookup. Common values are `sword`,
  `claymore`, `polearm`, `bow`, and `catalyst`. This must match one of the
  files in `src/data/weapons`.
- `last_updated`: Genshin version string shown in the page header and used by
  the home page `Recently updated` filter. Also used to block access to a
  character's guide if its value is "WIP"
- `version_released`: Character release version from the official HoYoWiki,
  used by the home page `Release date - Newest` sort. Use the changelog format
  for Luna versions, such as `6.6 / Luna VII`.

## Recently Updated Filter

The home page checks the two latest versions from the first two `groups` items
in `src/content/site/changelog.json`.

When a character should appear under the `Recently updated` filter, set
`last_updated` to either version:

```json
{
  "last_updated": "6.6 / Luna VII"
}
```

The comparison trims extra spaces and normalizes spacing around `/`. For
clarity, still copy the version exactly as it appears in the changelog. If the
value does not match either recent changelog version, the character remains
visible in the normal roster but will not appear when the `Recently updated`
filter is checked.

## Images

Hosted image files mirror the character content path under
`src/assets/character-assets`:

```txt
src/assets/character-assets/<element>/<rarity>/<character>/splash_art.webp
src/assets/character-assets/<element>/<rarity>/<character>/portrait.webp
```

The site renders character images only from these local files. Metadata image
URLs are ignored by the runtime.

The hosted files must be real WebP images and must use `portrait.webp`as the exact n,ame.

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
