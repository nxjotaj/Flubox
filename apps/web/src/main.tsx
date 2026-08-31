import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "./index.css";
import App from "./App.tsx";
import { FluboxThemeProvider } from "./theme/FluboxTheme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluboxThemeProvider>
      <App />
    </FluboxThemeProvider>
  </StrictMode>,
);
