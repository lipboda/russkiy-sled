import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} rel="noreferrer" target="_blank">
              {children}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === "string" && src.startsWith("/api/media/") ? (
              <img src={src} alt={alt ?? ""} />
            ) : (
              <span>{alt} (выберите изображение из медиатеки)</span>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
