import type { WordEntry } from "./schema";
import { sources } from "./catalog";
export const publicCards = (w: WordEntry) =>
  w.languages.filter(
    (l) => !l.hidden && !l.unpublished && l.reportedForms.some((f) => f.trim()),
  );
// View-only removal of import/editorial boilerplate. Scientific qualifications stay verbatim.
export function publicProse(value?: string) {
  return (value || "")
    .split("\n")
    .filter(
      (line) =>
        !/^\s*(Импортировано черновиком|Формы и происхождение требуют редакторской проверки|Потенциальная связь; не подтверждена импортёром|Составитель исключил эту форму|Нормативная транскрипция не подтверждена; исходные данные|[a-z]+(?:_[a-z]+){2,})/.test(
          line,
        ),
    )
    .join("\n")
    .replace(
      /\b(?:final-)?source-[a-zA-Z0-9-]+\b/g,
      (id) =>
        sources.find((s) => s.id === id || s.id === "final-" + id)?.title ||
        "источник статьи",
    )
    .trim();
}
export function correspondenceText(card: WordEntry["languages"][number]) {
  return (
    (
      {
        borrowed: "Заимствование из русского языка.",
        probable:
          "Происхождение из русского рассматривается как возможная версия.",
        attested:
          "Форма засвидетельствована; вопрос её происхождения рассматривается отдельно.",
        translation: "Переводной эквивалент русского слова.",
        proper: "Соответствие относится к собственному имени.",
        cultural: "Культурное соответствие русского понятия.",
        other: "Иное межъязыковое соответствие.",
      } as Record<string, string>
    )[card.correspondenceType || ""] || ""
  );
}

export function dictionaryDayWord(list: WordEntry[], date = new Date()) {
  const eligible = list.filter(
    (w) => !w.isDemo && w.shortDescription?.trim() && publicCards(w).length,
  );
  const day = Math.floor(
    Date.parse(date.toISOString().slice(0, 10)) / 86400000,
  );
  return eligible.length ? eligible[day % eligible.length] : undefined;
}

export function languageCount(n: number) {
  const mod = n % 100;
  return `${n} ${mod >= 11 && mod <= 14 ? "языков" : n % 10 === 1 ? "язык" : n % 10 >= 2 && n % 10 <= 4 ? "языка" : "языков"}`;
}
