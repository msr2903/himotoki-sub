import { createRoot } from "react-dom/client";
import "@pages/welcome/index.scss";
import Welcome from "@pages/welcome/Welcome";

const container = document.querySelector("#es-welcome");
if (!container) throw new Error("Can not find #es-welcome");
createRoot(container).render(<Welcome />);
