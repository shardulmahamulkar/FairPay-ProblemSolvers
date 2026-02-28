import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/firebase.js";

window.alert("FAIRPAY V2 LAUNCHED - Is this visible?");
createRoot(document.getElementById("root")!).render(<App />);
