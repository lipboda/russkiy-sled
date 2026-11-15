import type { Category, Publication } from "./publications";
export const editorial: {
  journal: Publication[];
  daily: Publication[];
  categories: Category[];
  timezone: string;
  languages: { code: string; name: string; country: string }[];
} = {
  journal: [],
  daily: [],
  categories: [],
  timezone: "Asia/Novosibirsk",
  languages: [],
};
