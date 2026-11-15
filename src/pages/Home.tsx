import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { LanguageLabel } from "../components/LanguageLabel";
import {
  publicCards,
  dictionaryDayWord,
  languageCount,
} from "../domain/publicPresentation";
import { words, publicLoad } from "../domain/catalog";
import { editorial } from "../domain/editorial";
import { mainResearchWords } from "../domain/research";
import { SearchBox } from "../components/Common";
const MapPreview = lazy(() =>
  import("./WorldMap").then((m) => ({ default: m.WorldMap })),
);
function Cover({ id, alt }: { id?: string; alt: string }) {
  return id ? <img loading="lazy" src={"/api/media/" + id} alt={alt} /> : null;
}
export function Home() {
  const forms = words
    .filter((w) => !w.isDemo)
    .flatMap((w) =>
      w.languages.filter(
        (l) =>
          !l.hidden && !l.unpublished && l.reportedForms.some((f) => f.trim()),
      ),
    );
  const languages = new Set(forms.map((l) => l.languageCode)),
    countries = new Set(
      forms.map((l) => l.countryCode).filter((c) => /^[A-Z]{2}$/.test(c)),
    );
  const featured = [...words]
    .sort((a, b) => a.russianLemma.localeCompare(b.russianLemma, "ru"))
    .slice(0, 6);
  const dayWord = dictionaryDayWord(words);
  const daily = editorial.daily[0],
    linked = words.find((w) => w.id === daily?.wordIds[0]);
  return (
    <div className="editorial-home">
      <header className="home-intro">
        <p className="eyebrow">Словарь · исследование · цифровой атлас</p>
        <h1>Русский след</h1>
        <h2>Электронный словарь русских заимствований в языках мира</h2>
        <p>
          Как русские слова путешествуют между языками, меняют звучание,
          написание и значение. Исследуйте их историю, географию и особенности
          употребления.
        </p>
        <SearchBox />
        <div className="home-actions">
          <Link className="button" to="/dictionary">
            Открыть словарь
          </Link>
          <Link className="text-link" to="/research">
            Смотреть исследование →
          </Link>
        </div>
      </header>
      <dl className="home-metrics">
        <div>
          <dt>Опубликованных статей</dt>
          <dd>{publicLoad.catalog === "ready" ? words.length : "—"}</dd>
        </div>
        <div>
          <dt>Представленных языков</dt>
          <dd>{publicLoad.catalog === "ready" ? languages.size : "—"}</dd>
        </div>
        <div>
          <dt>Опорных стран</dt>
          <dd>{publicLoad.catalog === "ready" ? countries.size : "—"}</dd>
        </div>
        <div>
          <dt>Опубликованных слов основного исследования</dt>
          <dd>
            {publicLoad.catalog === "ready" ? mainResearchWords().length : "—"}
          </dd>
        </div>
      </dl>
      <section className="home-section">
        <div className="home-section-heading">
          <h2>Из словаря</h2>
          <Link to="/dictionary">Все слова →</Link>
        </div>
        {publicLoad.catalog === "loading" ? (
          <p role="status">Загружаем словарь…</p>
        ) : publicLoad.catalog === "error" ? (
          <p>Не удалось обновить словарь. Попробуйте открыть раздел позже.</p>
        ) : !featured.length ? (
          <p>Словарь формируется. Опубликованные статьи появятся здесь.</p>
        ) : (
          <div className="home-words">
            {featured.map((w) => (
              <Link
                className="home-word"
                key={w.id}
                to={"/dictionary/" + w.slug}
              >
                <Cover id={w.coverId} alt={w.russianLemma} />
                <p className="eyebrow">{w.themes.slice(0, 2).join(" · ")}</p>
                <h3>{w.russianStress || w.russianLemma}</h3>
                {w.shortDescription && (
                  <p className="clamp">{w.shortDescription}</p>
                )}
                <div className="word-languages">
                  {publicCards(w)
                    .slice(0, 3)
                    .map((l) => (
                      <LanguageLabel
                        key={l.languageCode}
                        code={l.languageCode}
                        country={l.countryCode}
                      />
                    ))}
                </div>
                <small>
                  {languageCount(publicCards(w).length)} ·{" "}
                  {w.articleDepth === "full"
                    ? "Подробная статья"
                    : "Краткая карточка"}
                </small>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="home-geography home-section">
        <Link to="/map" aria-label="Исследовать карту мира">
          <Suspense fallback={<div className="home-map-placeholder" />}>
            <MapPreview preview />
          </Suspense>
        </Link>
        <div>
          <p className="eyebrow">Слова в пространстве</p>
          <h2>География заимствований</h2>
          <p>
            Узнайте, в каких языках встречаются русские слова и как они
            изменяются в новых языковых системах.
          </p>
          <p className="muted">
            Карта показывает словарные соответствия; подтверждённые
            заимствования выделены отдельным слоем. Наличие формы в языке не
            доказывает её распространение во всех странах этого языка.
          </p>
          <Link className="text-link" to="/map">
            Исследовать карту →
          </Link>
          <p>
            <Link to="/journey">Путешествие слова →</Link>
          </p>
        </div>
      </section>
      <section className="home-research home-section">
        <div>
          <p className="eyebrow">Научная рамка проекта</p>
          <h2>Одно слово — разные языковые системы</h2>
          <p>
            Сравнительное исследование русских заимствований в американском
            английском, французском и восточноармянском языках. Восемь слов
            образуют отдельную научную выборку; общий словарь может быть шире.
          </p>
          <Link to="/research">Перейти к исследованию →</Link>
        </div>
        <ul>
          {[
            "Графическая адаптация",
            "Фонетические изменения",
            "Семантика и употребление",
            "Грамматическое освоение",
          ].map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </section>
      <section className="home-section">
        <div className="home-section-heading">
          <h2>Слово дня</h2>
          <Link to="/word-of-the-day">Все выпуски →</Link>
        </div>
        {publicLoad.editorial === "loading" ? (
          <p>Загружаем публикации…</p>
        ) : publicLoad.editorial === "error" ? (
          <p>
            Публикации временно недоступны. Остальные разделы можно продолжать
            изучать.
          </p>
        ) : daily ? (
          <article className="home-daily">
            <Cover
              id={
                daily.coverId ||
                (daily.format === "word-card" ? linked?.coverId : undefined)
              }
              alt={daily.title}
            />
            <div>
              <p className="eyebrow">
                {daily.date} ·{" "}
                {daily.format === "word-card" ? "Карточка слова" : "Статья"}
              </p>
              <h3>
                <Link to={"/word-of-the-day/issue/" + daily.slug}>
                  {daily.title || linked?.russianLemma}
                </Link>
              </h3>
              <p>
                {daily.intro ||
                  (daily.format === "word-card"
                    ? linked?.shortDescription
                    : "")}
              </p>
              <Link to={"/word-of-the-day/issue/" + daily.slug}>
                Открыть выпуск →
              </Link>
            </div>
          </article>
        ) : dayWord ? (
          <article className="home-daily">
            <div>
              <p className="eyebrow">Сегодня в словаре</p>
              <h3>
                <Link to={"/dictionary/" + dayWord.slug}>
                  {dayWord.russianStress || dayWord.russianLemma}
                </Link>
              </h3>
              <p>{dayWord.shortDescription}</p>
              <div className="word-languages">
                {publicCards(dayWord).map((l) => (
                  <LanguageLabel
                    key={l.languageCode}
                    code={l.languageCode}
                    country={l.countryCode}
                  />
                ))}
              </div>
              <Link to={"/dictionary/" + dayWord.slug}>
                История и иностранные формы →
              </Link>
            </div>
          </article>
        ) : (
          <p>Новые публикации скоро появятся.</p>
        )}
      </section>
      <section className="home-section">
        <div className="home-section-heading">
          <h2>Журнал</h2>
          <Link to="/journal">Все статьи →</Link>
        </div>
        {publicLoad.editorial === "ready" && editorial.journal.length ? (
          <div className="home-journal">
            {editorial.journal.slice(0, 3).map((p) => (
              <article key={p.id}>
                <Cover id={p.coverId} alt={p.title} />
                <p className="eyebrow">
                  {p.category} · {p.date}
                </p>
                <h3>
                  <Link to={"/journal/" + p.slug}>{p.title}</Link>
                </h3>
                <p className="clamp">{p.intro}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>
            {publicLoad.editorial === "error"
              ? "Не удалось загрузить журнал. Попробуйте позже."
              : "Редакционные материалы появятся после публикации."}
          </p>
        )}
      </section>
      <section className="home-about home-section">
        <h2>О проекте</h2>
        <p>
          «Русский след» — научно-просветительский электронный ресурс о русских
          заимствованиях в языках мира. Проект объединяет сравнительное
          лингвистическое исследование и развивающийся многоязычный словарь.
          Заимствования, переводы и другие соответствия различаются по типу и
          степени подтверждённости.
        </p>
        <Link to="/journal/three-languages">О направлении исследования →</Link>
      </section>
    </div>
  );
}
