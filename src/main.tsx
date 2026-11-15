import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { words, sources } from "./domain/catalog";
// Public pages never use the bundled seed as a fallback for unavailable published data.
words.splice(0);
sources.splice(0);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
