import { createElement, type ReactNode } from "react";
import { validateDocument, type RichNode } from "../domain/universal";
export function RichDocument({ value }: { value: RichNode }) {
  let document: RichNode;
  try {
    document = validateDocument(value);
  } catch {
    return <p role="alert">Содержимое документа не прошло проверку.</p>;
  }
  const render = (node: RichNode, key: number): ReactNode => {
    if (node.type === "text") {
      let text: ReactNode = node.text ?? "";
      for (const [i, mark] of (node.marks ?? []).entries()) {
        const tag = (
          {
            bold: "strong",
            italic: "em",
            underline: "u",
            strike: "s",
            code: "code",
            link: "a",
          } as const
        )[mark.type as "bold"];
        text = createElement(
          tag ?? "span",
          mark.type === "link"
            ? { key: i, href: mark.attrs?.href, rel: "noreferrer" }
            : { key: i },
          text,
        );
      }
      return text;
    }
    if (node.type === "image")
      return (
        <figure key={key}>
          <img
            src={String(node.attrs?.src)}
            alt={String(node.attrs?.alt ?? "")}
          />
          {node.attrs?.caption && <figcaption>{node.attrs.caption}</figcaption>}
        </figure>
      );
    const tag =
      node.type === "heading"
        ? "h" + (node.attrs?.level ?? 2)
        : (
            {
              doc: "div",
              paragraph: "p",
              bulletList: "ul",
              orderedList: "ol",
              listItem: "li",
              blockquote: "blockquote",
              horizontalRule: "hr",
              hardBreak: "br",
              table: "table",
              tableRow: "tr",
              tableCell: "td",
              tableHeader: "th",
            } as Record<string, string>
          )[node.type];
    const attrs: Record<string, unknown> = { key };
    if (node.attrs?.textAlign)
      attrs.style = { textAlign: node.attrs.textAlign };
    if (node.type === "orderedList") attrs.start = node.attrs?.start;
    if (["tableCell", "tableHeader"].includes(node.type)) {
      attrs.colSpan = node.attrs?.colspan;
      attrs.rowSpan = node.attrs?.rowspan;
    }
    return createElement(
      tag ?? "div",
      attrs,
      ...(node.content ?? []).map(render),
    );
  };
  return <div className="rich-document">{render(document, 0)}</div>;
}
