import { lazy, Suspense, useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  NavLink,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  BookOpen,
  Compass,
  Globe2,
  Home as HomeIcon,
  Menu,
  Newspaper,
  Route as RouteIcon,
  Sparkles,
  X,
  Plus,
  MessageSquare,
} from "lucide-react";
import { EditorToolbar } from "./components/EditorToolbar";
import { checkSession } from "./domain/session";
import { refreshPublicCatalog } from "./domain/catalog";
const Admin = lazy(() => import("./pages/Admin"));
import { Home } from "./pages/Home";
import { Article, Comparison, Dictionary, Missing } from "./pages/Dictionary";
const WorldMap = lazy(() =>
  import("./pages/WorldMap").then((m) => ({ default: m.WorldMap })),
);
import { Contribution, DayWord, Journal, Journey } from "./pages/Editorial";
const navigation = [
  ["/", "Главная", HomeIcon],
  ["/dictionary", "Словарь", BookOpen],
  ["/research", "Сравнение языков", Compass],
  ["/map", "Карта русского следа", Globe2],
  ["/journey", "Путешествие слова", RouteIcon],
  ["/journal", "Журнал", Newspaper],
  ["/word-of-the-day", "Слово дня", Sparkles],
] as const;
function Shell() {
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const [, setCatalogVersion] = useState(0);
  const [catalogError, setCatalogError] = useState("");
  useEffect(() => {
    const changed = () => setCatalogVersion((v) => v + 1);
    window.addEventListener("catalog-updated", changed);
    return () => window.removeEventListener("catalog-updated", changed);
  }, []);
  useEffect(() => {
    const refresh = () => {
      void checkSession();
      void refreshPublicCatalog()
        .then(() => setCatalogError(""))
        .catch(() =>
          setCatalogError(
            "Не удалось обновить данные. Показана последняя загруженная версия; обновите страницу после восстановления связи.",
          ),
        );
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [location.pathname]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title =
      "Русский след — " +
      (navigation.find(([path]) => path === location.pathname)?.[1] ??
        "Исследовательская статья");
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <header className="mobile-header">
        <Link to="/" className="logo">
          Русский след<span>.</span>
        </Link>
        <button
          aria-label={menu ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={"sidebar " + (menu ? "is-open" : "")}>
        <Link to="/" className="logo" onClick={() => setMenu(false)}>
          Русский след<span>.</span>
        </Link>
        <p className="logo-caption">СЛОВА ЗА ПРЕДЕЛАМИ ЯЗЫКА</p>
        <nav aria-label="Основная навигация">
          {navigation.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Язык — это история,
            <br />
            которая продолжается.
          </p>
          <Link to="/contribute" onClick={() => setMenu(false)}>
            <Plus size={17} />
            Предложить слово
          </Link>
          <Link to="/report-error" onClick={() => setMenu(false)}>
            <MessageSquare size={16} />
            Сообщить об ошибке
          </Link>
          <small>
            Исследовательская версия
            <br />
            Источники важнее количества.
          </small>
        </div>
      </aside>
      <div className="workspace">
        <main id="main">
          <EditorToolbar />
          {catalogError && <p role="alert">{catalogError}</p>}
          <Routes>
            <Route
              path="/admin"
              element={
                <Suspense fallback={<p>Загрузка…</p>}>
                  <Admin />
                </Suspense>
              }
            />
            <Route path="/" element={<Home />} />
            <Route path="/dictionary" element={<Dictionary />} />
            <Route path="/dictionary/:slug" element={<Article />} />
            <Route path="/research" element={<Comparison />} />
            <Route
              path="/map"
              element={
                <Suspense fallback={<p role="status">Загрузка карты…</p>}>
                  <WorldMap />
                </Suspense>
              }
            />
            <Route path="/journey" element={<Journey />} />
            <Route path="/journey/:slug" element={<Journey />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/:slug" element={<Journal />} />
            <Route path="/word-of-the-day" element={<DayWord />} />
            <Route path="/contribute" element={<Contribution />} />
            <Route path="/report-error" element={<Contribution error />} />
            <Route path="*" element={<Missing />} />
          </Routes>
        </main>
        <footer>
          <Link className="logo" to="/">
            Русский след<span>.</span>
          </Link>
          <p>
            Цифровой словарь и лаборатория исследования русских заимствований.
          </p>
          <span>2026 · Открытые вопросы — часть исследования</span>
        </footer>
      </div>
    </>
  );
}
const router = createBrowserRouter([{ path: "*", element: <Shell /> }]);
export default function App() {
  return <RouterProvider router={router} />;
}
