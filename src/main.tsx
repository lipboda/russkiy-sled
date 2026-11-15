import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { refreshPublicCatalog } from "./domain/catalog";
async function boot() {
  await refreshPublicCatalog();
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
