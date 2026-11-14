import { createRoot } from "react-dom/client";
import AsiaTripPage from "./page";

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");
createRoot(root).render(<AsiaTripPage />);
