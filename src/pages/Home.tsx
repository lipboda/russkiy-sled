import { Link } from "react-router-dom";
import { ArrowUpRight, Globe2, MoveRight } from "lucide-react";
import { words, verifiedWords } from "../domain/catalog";
import { editorial } from "../domain/editorial";
import { SearchBox, WordCard } from "../components/Common";
export function Home() {
  const journal = editorial.journal;
  return (
    <>
      <div className="home-top">
        <span className="eyebrow">
          <span className="dot" /> Цифровой лингвистический проект
        </span>
        <span className="edition">Исследовательское издание · 2026</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Русский → иностранные языки</p>
          <h1>
            У каждого слова
            <br />
            есть <em>продолжение.</em>
          </h1>
          <p className="hero-lede">
            Узнайте, как русские слова пересекают границы,
            <br className="desktop-break" /> меняют звучание и обретают новую
            жизнь.
          </p>
          <SearchBox />
          <p className="search-examples">
            Попробуйте: <Link to="/dictionary/samovar">самовар</Link>
            <span>·</span>
            <Link to="/dictionary/sputnik">sputnik</Link>
            <span>·</span>
            <Link to="/dictionary/matryoshka">матрёшка</Link>
          </p>
        </div>
        <div className="word-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-origin">
            слово<span>РУССКИЙ ЯЗЫК</span>
          </div>
          <span className="art-word art-en">
            samovar<small>EN · США</small>
          </span>
          <span className="art-word art-fr">
            spoutnik<small>FR · ФРАНЦИЯ</small>
          </span>
          <span className="art-word art-hy">
            սամիզդատ<small>HY · АРМЕНИЯ</small>
          </span>
          <p>
            Графика форм из исследовательских досье.
            <br />
            Требует проверки первоисточников.
          </p>
        </div>
      </section>
      <div className="home-stats">
        <div>
          <strong>{words.length}</strong>
          <span>исследовательских записей</span>
        </div>
        <div>
          <strong>3</strong>
          <span>языка в фокусе исследования</span>
        </div>
        <div>
          <strong>{verifiedWords().length}</strong>
          <span>независимо подтверждённых записей</span>
        </div>
        <Link to="/research">
          О методике
          <br />и достоверности <ArrowUpRight size={20} />
        </Link>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">От материала к открытию</p>
            <h2>Слова в исследовании</h2>
          </div>
          <Link className="text-link" to="/dictionary">
            Весь словарь <MoveRight size={18} />
          </Link>
        </div>
        <div className="featured-grid">
          {words
            .filter((w) =>
              ["samovar", "sputnik", "matryoshka"].includes(w.slug),
            )
            .map((w) => (
              <WordCard key={w.id} word={w} />
            ))}
        </div>
      </section>
      <section className="feature-pair">
        <div className="map-teaser">
          <Globe2 size={110} strokeWidth={0.65} />
          <p className="eyebrow">География слов</p>
          <h2>Карта русского следа</h2>
          <p>
            Посмотрите на исследование в масштабе мира. Страны, языки и
            подтверждённые свидетельства.
          </p>
          <Link className="button" to="/map">
            Открыть карту <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="day-teaser">
          <p className="eyebrow">Слово дня</p>
          <h2>
            Сначала источник.
            <br />
            Затем — история.
          </h2>
          <p>
            Первое слово дня появится после независимой проверки. А пока можно
            исследовать материалы и открытые вопросы.
          </p>
          <Link className="text-link" to="/word-of-the-day">
            Как выбирается слово дня ↗
          </Link>
          <Link className="text-link" to="/journey">
            Путешествия слов ↗
          </Link>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Заметки редакции</p>
            <h2>Язык исследования</h2>
          </div>
          <Link className="text-link" to="/journal">
            Весь журнал ↗
          </Link>
        </div>
        <div className="journal-grid">
          {journal.map((p) => (
            <Link
              className="journal-card compact"
              to={"/journal/" + p.slug}
              key={p.slug}
            >
              <p className="eyebrow">{p.category}</p>
              <h3>{p.title}</h3>
              <p>{p.intro}</p>
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
