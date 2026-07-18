import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.jsx";
import { ErrorBoundary } from "./components/common/primitives.jsx";
import { createStorage, STORAGE_KEY } from "./lib/storage/adapter.js";
import { downloadText, stampedName } from "./lib/export/csv.js";
import "./styles/index.css";

const storage = createStorage();

async function exportRecovery() {
  const raw = await storage.dumpRaw(STORAGE_KEY);
  downloadText(raw || "{}", stampedName("pocket-ledger-recovery", "json"), "application/json");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary onExportRecovery={exportRecovery}>
      <App storage={storage} />
    </ErrorBoundary>
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
