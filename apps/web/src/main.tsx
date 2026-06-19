import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { cleanupOldLocalServiceWorkers } from "./lib/devCleanup";
import { initTelegram, syncTelegramTheme } from "./lib/telegram";
import "./styles/global.css";

cleanupOldLocalServiceWorkers();
initTelegram();
syncTelegramTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
