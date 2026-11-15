import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, setSession, useSession } from "../domain/session";
import { words } from "../domain/catalog";

export function EditorToolbar() {
  const logged = useSession();
  const location = useLocation();
  const [error, setError] = useState("");
  if (!logged || location.pathname === "/admin") return null;
  const word = words.find((w) => location.pathname === "/dictionary/" + w.slug);
  return (
    <nav className="editor-toolbar" aria-label="Панель владельца">
      <strong>Режим редактирования</strong>
      {word && (
        <Link to={"/admin?word=" + encodeURIComponent(word.id)}>
          Редактировать статью
        </Link>
      )}
      <Link to="/admin?new=1">Добавить слово</Link>
      <Link to="/admin">Админ-панель</Link>
      <button
        onClick={async () => {
          try {
            await api("auth/logout", "POST", {});
            setSession(false);
          } catch {
            setError("Не удалось завершить сеанс. Повторите попытку.");
          }
        }}
      >
        Выйти
      </button>
      {error && <span role="alert">{error}</span>}
    </nav>
  );
}
