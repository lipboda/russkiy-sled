import type { RichNode } from "./universal";
import { z } from "zod";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const publicationSchema = z.object({
  id,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  createdAt: z.string().optional(),
  title: z.string().trim().max(300).default(""),
  format: z.enum(["article", "word-card"]).optional(),
  richDocument: z.custom<RichNode>().optional(),
  comment: z.string().max(20000).optional(),
  publishedAt: z.string().optional(),
  intro: z.string().max(10000).default(""),
  body: z.string().max(200000).default(""),
  author: z.string().max(300).default(""),
  category: z.string().max(200).default(""),
  date: z.string().default(""),
  publishAt: z.string().default(""),
  coverId: z.string().default(""),
  wordIds: z.array(id).default([]),
  sourceIds: z.array(z.string().min(1).max(300)).default([]),
  links: z
    .array(
      z.object({
        sourceId: z.string().optional(),
        url: z.string().default(""),
        title: z.string().optional(),
        comment: z.string().optional(),
      }),
    )
    .optional(),
  origin: z.string().default(""),
  adaptation: z.string().default(""),
  examples: z.string().default(""),
});
export type Publication = z.infer<typeof publicationSchema>;
export type Category = {
  id: string;
  name: string;
  description: string;
  sort: number;
  count: number;
};
export type Media = {
  id: string;
  name: string;
  alt: string;
  caption: string;
  credit: string;
  source: string;
  mime: string;
  created: string;
};
export type ResourceRow = {
  id: string;
  kind: "journal" | "daily";
  data: Publication;
  state: string;
  published: boolean;
  version: number;
  updated: string;
  deleted: string | null;
};
export const publicationStates: Record<string, string> = {
  draft: "Черновик",
  review: "На проверке",
  published: "Опубликовано",
  scheduled: "Запланировано",
  unpublished: "Снято с публикации",
  archived: "Архивировано",
  trash: "В корзине",
};
