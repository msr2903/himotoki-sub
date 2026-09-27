import { createRoot } from "react-dom/client";
import "@pages/popup/index.scss";
import Popup from "@pages/popup/Popup";
import refreshOnUpdate from "virtual:reload-on-update-in-view";
import { initPageTheme } from "@src/pages/shared/pageTheme";

refreshOnUpdate("pages/popup");

initPageTheme();

function init() {
  const appContainer = document.querySelector("#es-popup");
  if (!appContainer) {
    throw new Error("Can not find #es-popup");
  }
  const root = createRoot(appContainer);
  root.render(<Popup />);
}

init();
