import { defineCollection, z } from "astro:content";

const buildsCollection = defineCollection({
  type: "content",

  schema: z.object({
    title: z.string(),

    weapon: z.enum([
      "sword",
      "claymore",
      "polearm",
      "bow",
      "catalyst"
    ]),

    gameVersion: z.string()
  })
});

export const collections = {
  en: buildsCollection,
  fr: buildsCollection
};