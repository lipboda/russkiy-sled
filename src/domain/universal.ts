export const correspondenceNames = {
  borrowed: "Подтверждённое русское заимствование",
  probable: "Вероятное русское заимствование",
  attested: "Засвидетельствованная форма, происхождение не установлено",
  translation: "Переводной эквивалент",
  cultural: "Культурное соответствие",
  proper: "Собственное имя",
  other: "Другое соответствие",
  unknown: "Тип соответствия не установлен",
} as const;
export type Correspondence = keyof typeof correspondenceNames;
export function safeLink(value: string) {
  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\u0000-\u001f]/.test(value)
  )
    return /^\/(dictionary|journal|word-of-the-day)(\/|$)/.test(value);
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | null>;
  marks?: { type: string; attrs?: Record<string, string | number | null> }[];
  content?: RichNode[];
};
export function validateDocument(input: unknown): RichNode {
  let nodes = 0,
    characters = 0;
  const clean = (value: unknown, depth: number): RichNode => {
    if (++nodes > 10000 || depth > 40 || !value || typeof value !== "object")
      throw new Error("Слишком сложный документ");
    const v = value as RichNode;
    if (
      ![
        "doc",
        "paragraph",
        "heading",
        "text",
        "bulletList",
        "orderedList",
        "listItem",
        "blockquote",
        "horizontalRule",
        "hardBreak",
        "image",
        "table",
        "tableRow",
        "tableHeader",
        "tableCell",
      ].includes(v.type)
    )
      throw new Error("Недопустимый блок документа");
    const out: RichNode = { type: v.type };
    if (v.text !== undefined) {
      if (v.type !== "text" || typeof v.text !== "string")
        throw new Error("Некорректный текст");
      characters += v.text.length;
      if (characters > 200000) throw new Error("Документ слишком длинный");
      out.text = v.text;
    }
    if (v.attrs) {
      const a: RichNode["attrs"] = {};
      if (v.type === "heading") {
        if (![1, 2, 3, 4, 5, 6].includes(Number(v.attrs.level)))
          throw new Error("Некорректный заголовок");
        a.level = Number(v.attrs.level);
      }
      if (v.attrs.textAlign !== undefined) {
        if (
          !["left", "center", "right", "justify"].includes(
            String(v.attrs.textAlign),
          )
        )
          throw new Error("Некорректное выравнивание");
        a.textAlign = v.attrs.textAlign;
      }
      if (v.type === "orderedList")
        a.start = Math.max(1, Math.min(10000, Number(v.attrs.start) || 1));
      if (v.type === "image") {
        if (
          typeof v.attrs.src !== "string" ||
          !/^\/api\/media\/[a-zA-Z0-9_-]+$/.test(v.attrs.src)
        )
          throw new Error("Выберите изображение из медиатеки");
        for (const key of ["src", "alt", "title", "caption"])
          if (typeof v.attrs[key] === "string")
            a[key] = String(v.attrs[key]).slice(0, 2000);
      }
      if (["tableCell", "tableHeader"].includes(v.type)) {
        for (const key of ["colspan", "rowspan"])
          a[key] = Math.max(1, Math.min(20, Number(v.attrs[key]) || 1));
      }
      out.attrs = a;
    }
    if (v.marks) {
      if (!Array.isArray(v.marks))
        throw new Error("Некорректное форматирование");
      out.marks = v.marks.map((m) => {
        if (
          !["bold", "italic", "underline", "strike", "code", "link"].includes(
            m.type,
          )
        )
          throw new Error("Недопустимый стиль");
        if (m.type === "link") {
          if (!safeLink(String(m.attrs?.href ?? "")))
            throw new Error("Недопустимая ссылка");
          return { type: "link", attrs: { href: String(m.attrs!.href) } };
        }
        return { type: m.type };
      });
    }
    if (v.content !== undefined) {
      if (!Array.isArray(v.content) || v.type === "text")
        throw new Error("Некорректная структура");
      out.content = v.content.map((c) => clean(c, depth + 1));
    }
    return out;
  };
  const result = clean(input, 0);
  if (result.type !== "doc") throw new Error("Требуется документ");
  return result;
}
export const documentText = (node: RichNode): string =>
  [node.text ?? "", ...(node.content ?? []).map(documentText)].join(" ");
