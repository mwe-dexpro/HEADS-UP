/* Browser entry point. Everything host-specific lives here and in storage.js,
   so src/HeadsUp.jsx stays portable to the artifact runtime it was written for:
   React 18 with hooks, an async window.storage, nothing else. */

import React from "react";
import { createRoot } from "react-dom/client";
import { installStorage } from "./storage.js";
import HeadsUp from "../src/HeadsUp.jsx";

installStorage();

const el = document.getElementById("root");
if (!el) throw new Error("#root is missing from index.html");
createRoot(el).render(<HeadsUp />);
