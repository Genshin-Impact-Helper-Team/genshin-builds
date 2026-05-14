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
  "image": "https://example.com/character-full.png",
  "portrait": "https://example.com/character-icon.png"
}
```

## Fields

- `weapon`: Character weapon type used by the home page character data,
  filtering, and shared weapon rarity lookup. Common values are `sword`,
  `claymore`, `polearm`, `bow`, and `catalyst`. This must match one of the
  files in `src/data/weapons`.
- `last_updated`: Genshin version string shown in the page header.
- `image`: Large character image URL shown in the character page header. Should
  come from the official HoYoWiki.
- `portrait`: Small character icon URL used on the home page character list.
  Should come from the Hoyolab Battle Chronicles Character list.

## Images

Both `image` and `portrait` must come from official sources:

```txt
https://wiki.hoyolab.com/pc/genshin/home
https://act.hoyolab.com/app/community-game-records-sea/index.html
```

- Use the wish character image from hoyowiki for `image`.
- Use the small character icon for from the hoyolab battle chronicles for `portrait`.
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
