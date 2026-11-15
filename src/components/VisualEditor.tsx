import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { safeLink, type RichNode } from "../domain/universal";
import { api } from "../domain/session";
import { words } from "../domain/catalog";
import type { Media } from "../domain/publications";
const Picture = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), caption: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (node) =>
          /^\/api\/media\/[a-zA-Z0-9_-]+$/.test(
            (node as HTMLElement).getAttribute("src") ?? "",
          )
            ? {}
            : false,
      },
    ];
  },
});
export function VisualEditor({
  value,
  change,
}: {
  value?: RichNode;
  change: (doc: RichNode) => void;
}) {
  const [media, setMedia] = useState<Media[]>([]),
    [error, setError] = useState(""),
    [large, setLarge] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Picture,
      TableKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
      }),
    ],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        "aria-label": "Основной текст статьи",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => change(editor.getJSON() as RichNode),
  });
  useEffect(() => {
    void api("admin/media")
      .then(setMedia)
      .catch(() => setError("Не удалось загрузить медиатеку"));
  }, []);
  useEffect(() => {
    if (
      editor &&
      value &&
      JSON.stringify(editor.getJSON()) !== JSON.stringify(value)
    )
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  if (!editor) return <p>Загрузка редактора…</p>;
  const button = (label: string, action: () => void, active = false) => (
    <button
      type="button"
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
    >
      {label}
    </button>
  );
  return (
    <section className={"visual-editor " + (large ? "is-large" : "")}>
      <div className="visual-toolbar" aria-label="Форматирование текста">
        {button(
          "Абзац",
          () => editor.chain().focus().setParagraph().run(),
          editor.isActive("paragraph"),
        )}
        {[1, 2, 3].map((level) => (
          <span key={level}>
            {button(
              "Заголовок " + level,
              () =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: level as 1 | 2 | 3 })
                  .run(),
              editor.isActive("heading", { level }),
            )}
          </span>
        ))}
        {button(
          "Жирный",
          () => editor.chain().focus().toggleBold().run(),
          editor.isActive("bold"),
        )}
        {button(
          "Курсив",
          () => editor.chain().focus().toggleItalic().run(),
          editor.isActive("italic"),
        )}
        {button(
          "Подчёркнутый",
          () => editor.chain().focus().toggleUnderline().run(),
          editor.isActive("underline"),
        )}
        {button(
          "Зачёркнутый",
          () => editor.chain().focus().toggleStrike().run(),
          editor.isActive("strike"),
        )}
        {button("Маркированный список", () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        {button("Нумерованный список", () =>
          editor.chain().focus().toggleOrderedList().run(),
        )}
        {button("Цитата", () =>
          editor.chain().focus().toggleBlockquote().run(),
        )}
        {button("Разделитель", () =>
          editor.chain().focus().setHorizontalRule().run(),
        )}
        {button("Вставить ссылку", () => {
          const href = prompt("Адрес ссылки (https://…)");
          if (href === null) return;
          if (!safeLink(href)) {
            setError(
              "Разрешены безопасные HTTP/HTTPS-ссылки или ссылки на страницы сайта",
            );
            return;
          }
          editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href })
            .run();
        })}
        {button("Убрать ссылку", () =>
          editor.chain().focus().unsetLink().run(),
        )}
        {button("Таблица", () =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
        )}
        {button("Слева", () =>
          editor.chain().focus().setTextAlign("left").run(),
        )}
        {button("По центру", () =>
          editor.chain().focus().setTextAlign("center").run(),
        )}
        {button("Отменить действие", () => editor.chain().focus().undo().run())}
        {button("Повторить действие", () =>
          editor.chain().focus().redo().run(),
        )}
        {button(large ? "Обычная область" : "Увеличить область", () =>
          setLarge(!large),
        )}
        <label>
          Изображение из медиатеки
          <select
            value=""
            onChange={(e) => {
              const image = media.find((m) => m.id === e.target.value);
              if (!image) return;
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "image",
                  attrs: {
                    src: "/api/media/" + image.id,
                    alt: image.alt,
                    caption: image.caption,
                    title: image.name,
                  },
                })
                .run();
            }}
          >
            <option value="">Выбрать изображение</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ссылка на слово
          <select
            value=""
            onChange={(e) => {
              const word = words.find((w) => w.id === e.target.value);
              if (word)
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "text",
                    text: word.russianLemma,
                    marks: [
                      {
                        type: "link",
                        attrs: { href: "/dictionary/" + word.slug },
                      },
                    ],
                  })
                  .run();
            }}
          >
            <option value="">Выбрать словарную статью</option>
            {words.map((w) => (
              <option key={w.id} value={w.id}>
                {w.russianLemma}
              </option>
            ))}
          </select>
        </label>
      </div>
      <EditorContent editor={editor} />
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
