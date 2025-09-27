import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add the Montserrat and Open Sans fonts
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;500;600&display=swap";
document.head.appendChild(fontLink);

// Add title and meta description
const title = document.createElement("title");
title.textContent = "The Current-See PBC | Solar-Backed Economic System";
document.head.appendChild(title);

const metaDescription = document.createElement("meta");
metaDescription.name = "description";
metaDescription.content = "The Current-See PBC is building a solar-backed global economic system for a sustainable future.";
document.head.appendChild(metaDescription);

createRoot(document.getElementById("root")!).render(<App />);
