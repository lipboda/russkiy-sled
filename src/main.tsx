import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyPublicCatalog } from "./domain/catalog";
async function boot() {
  const response = await fetch("/api/content");
  if (response.ok) applyPublicCatalog(await response.json());
  else if (response.status !== 404)
    throw new Error("Не удалось загрузить опубликованные данные");
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
void boot().catch(() => {
  document.getElementById("root")!.textContent =
    "Не удалось загрузить данные сайта. Проверьте сервер и обновите страницу.";
});
