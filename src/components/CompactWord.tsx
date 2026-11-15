import { useState } from "react";
import { Link } from "react-router-dom";
import { type WordEntry, words, languageNames } from "../domain/catalog";
import { editorial } from "../domain/editorial";
import {
  publicCards,
  publicProse,
  correspondenceText,
} from "../domain/publicPresentation";
import { LanguageLabel } from "./LanguageLabel";
import { SourceLink, ResearchNotes } from "./Common";
import { PublishedImage } from "./PublishedImage";
import { useSession } from "../domain/session";
export function ContextLinks({
  links,
  ids,
}: {
  links?: WordEntry["links"];
  ids: string[];
}) {
  return (
    <div className="source-list">
      {(links ?? []).map((l, i) => (
        <p key={i}>
          {l.url ? (
            <a href={l.url} target="_blank" rel="noreferrer">
              {l.title || l.url} ↗
            </a>
          ) : l.sourceId ? (
            <SourceLink id={l.sourceId} />
          ) : null}
          {l.comment && <span> — {l.comment}</span>}
        </p>
      ))}
      {ids
        .filter((id) => !links?.some((l) => l.sourceId === id))
        .map((id) => (
          <SourceLink key={id} id={id} />
        ))}
    </div>
  );
}
export function CompactWord({
  word: w,
  embedded = false,
}: {
  word: WordEntry;
  embedded?: boolean;
}) {
  const [language, setLanguage] = useState("");
  const logged = useSession();
  const cards = publicCards(w),
    card = cards.find((l) => l.languageCode === language) ?? cards[0];
  const def = editorial.languages.find((l) => l.code === card?.languageCode);
  return (
    <section className="compact-word">
      <header>
        {embedded ? <h2>{w.russianLemma}</h2> : <h1>{w.russianLemma}</h1>}
        {w.russianStress && <p>{w.russianStress}</p>}
        {w.partOfSpeech && <p>{w.partOfSpeech}</p>}
      </header>
      {w.shortDescription && (
        <p className="compact-definition">{w.shortDescription}</p>
      )}
      {w.coverId && <PublishedImage id={w.coverId} fallback={w.russianLemma} />}
      <div className="category-tags">
        {w.themes.map((t) => (
          <Link key={t} to={"/dictionary?theme=" + encodeURIComponent(t)}>
            {t}
          </Link>
        ))}
      </div>
      {cards.length > 0 && (
        <>
          <div
            className="language-tabs"
            role="tablist"
            aria-label="Языковые соответствия"
          >
            {cards.map((l) => (
              <button
                key={l.languageCode}
                role="tab"
                aria-selected={card === l}
                aria-controls={"card-" + w.id}
                id={"tab-" + w.id + "-" + l.languageCode}
                onClick={() => setLanguage(l.languageCode)}
              >
                <LanguageLabel code={l.languageCode} country={l.countryCode} />
              </button>
            ))}
          </div>
          {cards.length > 5 && (
            <label>
              Выбрать язык
              <select
                value={card.languageCode}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {cards.map((l) => (
                  <option key={l.languageCode} value={l.languageCode}>
                    {languageNames[l.languageCode] ?? l.languageCode}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div
            className="compact-language"
            role="tabpanel"
            id={"card-" + w.id}
            aria-labelledby={"tab-" + w.id + "-" + card.languageCode}
          >
            <h2
              lang={
                def?.officialCode ??
                (card.languageCode.startsWith("x-local-")
                  ? undefined
                  : card.languageCode)
              }
              dir={(def?.direction ?? "auto") as "auto" | "ltr" | "rtl"}
            >
              {card.reportedForms.join(" · ")}
            </h2>
            {card.ipa && <p className="ipa">{card.ipa}</p>}
            {card.transliteration && <p>{card.transliteration}</p>}
            {card.meaning && <p>{card.meaning}</p>}
            {card.origin && (
              <p className="preline">{publicProse(card.origin)}</p>
            )}
            {correspondenceText(card) && <p>{correspondenceText(card)}</p>}
            {publicProse(card.comment) && <p>{publicProse(card.comment)}</p>}
            <ContextLinks links={card.links} ids={card.sourceIds} />
          </div>
        </>
      )}
      <ResearchNotes word={w} fields={["origin"]} showSources={false} />
      <ContextLinks
        links={w.links}
        ids={w.sourceIds.filter((id) => !card?.sourceIds.includes(id))}
      />

      {publicProse(w.editorialNotes) && (
        <p className="preline">{publicProse(w.editorialNotes)}</p>
      )}
      {(w.relatedWordIds ?? []).map((id) => {
        const related = words.find((w) => w.id === id);
        return (
          related && (
            <p key={id}>
              <Link to={"/dictionary/" + related.slug}>
                {related.russianLemma}
              </Link>
            </p>
          )
        );
      })}
      {logged && (
        <div className="cms-actions">
          <Link to={"/admin?word=" + w.id}>Редактировать</Link>
          <Link
            to={
              "/admin?word=" +
              w.id +
              "&tab=languages" +
              (card ? "&language=" + card.languageCode : "")
            }
          >
            Добавить язык / редактировать языковую карточку
          </Link>
        </div>
      )}
      {embedded && (
        <Link to={"/dictionary/" + w.slug}>Полная словарная статья ↗</Link>
      )}
    </section>
  );
}
