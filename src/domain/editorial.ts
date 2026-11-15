import type { Category, Publication } from "./publications";
export const editorial: {
  journal: Publication[];
  daily: Publication[];
  categories: Category[];
  timezone: string;
  languages: {
    code: string;
    name: string;
    country: string;
    officialCode?: string | null;
    nativeName?: string;
    region?: string;
    variety?: string;
    direction?: string;
  }[];
} = {
  journal: [],
  daily: [],
  categories: [],
  timezone: "Asia/Novosibirsk",
  languages: [],
};
