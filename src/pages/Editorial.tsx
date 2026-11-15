import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { words } from "../domain/catalog";
export { Journal, DayWord } from "./Publications";
import { Badge, Notice, PageTitle, ResearchNotes } from "../components/Common";
import { Missing } from "./Dictionary";
export function Journey() {
  const { slug } = useParams();
  if (slug) {
    const w = words.find((w) => w.slug === slug);
    return w ? (
      <>
        <Link to="/journey" className="back">
          ← Путешествия слов
        </Link>
        <PageTitle eyebrow="Путешествие слова" title={w.russianLemma}>
          История слова, а не вымышленная линия на карте.
        </PageTitle>
        <Notice />
        <div className="journey-line">
          <span>Русское слово</span>
          <span>→</span>
          <span>Маршруты и посредники требуют проверки</span>
        </div>
        <ResearchNotes word={w} fields={["origin", "chronology", "issues"]} />
        <Link className="button" to={"/dictionary/" + w.slug}>
          Полная исследовательская статья ↗
        </Link>
      </>
    ) : (
      <Missing />
    );
  }
  return (
    <>
      <PageTitle eyebrow="От языка к языку" title="Путешествие слова">
        Реконструкция маршрутов начинается с источников. Ниже —
        исследовательские истории с сохранёнными вопросами и оговорками.
      </PageTitle>
      <Notice />
      <div className="word-grid">
        {words
          .filter((w) => w.researchIncluded)
          .map((w) => (
            <Link
              className="paper journey-card"
              key={w.id}
              to={"/journey/" + w.slug}
            >
              <p className="eyebrow">Русский → иностранные языки</p>
              <h2>{w.russianLemma} ↗</h2>
              <Badge>Маршрут требует проверки</Badge>
            </Link>
          ))}
      </div>
    </>
  );
}
export function Contribution({ error = false }: { error?: boolean }) {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="Участие в проекте"
        title={error ? "Сообщить об ошибке" : "Предложить слово"}
      >
        Помогите сделать словарь точнее. Приём сообщений через сервер пока не
        подключён.
      </PageTitle>
      <div className="form-layout">
        <form
          className="paper feedback-form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const text = [
              error ? "Сообщение об ошибке" : "Предложение слова",
              ...Array.from(data.entries()).map(([k, v]) => `${k}: ${v}`),
            ].join("\n");
            const url = URL.createObjectURL(
              new Blob([text], { type: "text/plain;charset=utf-8" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = error
              ? "russkiy-sled-error.txt"
              : "russkiy-sled-proposal.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setDone(true);
          }}
        >
          <label>
            {error ? "Слово или адрес страницы" : "Русское слово"}
            <input
              name="Слово или страница"
              defaultValue={params.get("word") ?? ""}
              required
              maxLength={200}
            />
          </label>
          {!error && (
            <label>
              Принимающий язык
              <input name="Язык" required maxLength={100} />
            </label>
          )}
          <label>
            {error ? "Что нужно исправить" : "Форма слова и ваши наблюдения"}
            <textarea
              name="Описание"
              rows={6}
              required
              minLength={10}
              maxLength={5000}
            />
          </label>
          <label>
            Ссылка на источник
            <input
              name="Источник"
              type="url"
              placeholder="https://…"
              maxLength={1000}
            />
          </label>
          <label>
            Email — необязательно
            <input name="Email" type="email" maxLength={254} />
          </label>
          <p>
            Данные не отправляются и не сохраняются на сервере. Вы можете
            скачать текст для дальнейшей передачи редакции.
          </p>
          <button className="button" type="submit">
            Скачать текст сообщения ↓
          </button>
          {done && (
            <p role="status">
              Текст подготовлен для скачивания. Сообщение не отправлено
              редакции.
            </p>
          )}
        </form>
        <aside className="paper">
          <h2>Что поможет проверке</h2>
          <p>
            Точное написание, язык, название источника и ссылка на конкретную
            статью или страницу.
          </p>
          <p>
            Не включайте конфиденциальные данные. Email нужен только если вы
            хотите оставить контакт в скачанном файле.
          </p>
        </aside>
      </div>
    </>
  );
}
