import { useEffect, useState } from "react";
import type { Media } from "../domain/publications";
export function PublishedImage({
  id,
  fallback,
}: {
  id: string;
  fallback: string;
}) {
  const [meta, setMeta] = useState<Media>();
  useEffect(() => {
    let active = true;
    void fetch("/api/media-meta/" + id)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (active) setMeta(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <figure>
      <img
        className="publication-cover"
        src={"/api/media/" + id}
        alt={meta?.alt ?? fallback}
      />
      {meta && (
        <figcaption>
          {[meta.caption, meta.credit, meta.source].filter(Boolean).join(" · ")}
        </figcaption>
      )}
    </figure>
  );
}
