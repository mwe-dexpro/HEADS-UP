/* Browser entry point. Everything host-specific lives here, in storage.js and
   in schedule.js, so src/HeadsUp.jsx stays portable to the artifact runtime it
   was written for: React 18 with hooks, an async window.storage, and an optional
   place to publish its schedule. Nothing else. */

import React from "react";
import { createRoot } from "react-dom/client";
import { installStorage } from "./storage.js";
import { publishSchedule, initBackgroundCatchup } from "./schedule.js";
import { nativeScheduler } from "./native.js";
import HeadsUp from "../src/HeadsUp.jsx";

installStorage();

/* Under Capacitor the OS schedules the reminders and they arrive on time. In a
   browser the service worker catches up on them when it is allowed to run. The
   app does not know or care which of the two is listening. */
const native = nativeScheduler();
const onSchedule = native ? native.publish : publishSchedule;

if (native) native.init();
else initBackgroundCatchup();

const el = document.getElementById("root");
if (!el) throw new Error("#root is missing from index.html");
createRoot(el).render(<HeadsUp onSchedule={onSchedule} />);
