import { createRoot } from "react-dom/client";
import "@pages/options/index.scss";
import Options from "@pages/options/Options";
import refreshOnUpdate from "virtual:reload-on-update-in-view";

refreshOnUpdate("pages/options");

function init() {
  const appContainer = document.querySelector("#es-options");
  if (!appContainer) {
    throw new Error("Can not find #es-options");
  }
  createRoot(appContainer).render(<Options />);
}

init();
