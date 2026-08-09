/* ============================================================
   The stored shape — defaults, samples, and the one key
   ------------------------------------------------------------
   What a first run looks like, and the only place that reads
   storage. `window.storage` is the host contract; see
   docs/ARCHITECTURE.md "The host contract".
   ============================================================ */

import { STORE_KEY } from "./config.js";
import { startOfDay } from "./time.js";
import { uid } from "./util.js";

/* ---------- default rules ---------- */
export function defaultRules() {
  const r = (name, keywords, tasks) => ({
    id: uid(),
    name,
    keywords,
    enabled: true,
    tasks: tasks.map((t) => ({ id: uid(), label: t[0], leads: t[1] })),
  });
  return [
    r(
      "Birthday",
      ["birthday", "bday", "b-day", "geburtstag"],
      [
        [
          "Buy a present",
          [
            { days: 10, hour: 9 },
            { days: 5, hour: 9 },
            { days: 2, hour: 18 },
          ],
        ],
        [
          "Write the card",
          [
            { days: 1, hour: 19 },
            { days: 0, hour: 8 },
          ],
        ],
      ],
    ),
    r(
      "Trip or flight",
      [
        "flight",
        "trip",
        "travel",
        "vacation",
        "holiday",
        "hotel",
        "airport",
        "train",
      ],
      [
        ["Check documents and check in", [{ days: 2, hour: 18 }]],
        [
          "Pack your bag",
          [
            { days: 1, hour: 8 },
            { days: 1, hour: 20 },
          ],
        ],
      ],
    ),
    r(
      "Wedding or party",
      ["wedding", "party", "celebration", "anniversary"],
      [
        [
          "Sort a gift and an outfit",
          [
            { days: 7, hour: 9 },
            { days: 2, hour: 9 },
          ],
        ],
      ],
    ),
    r(
      "Presentation",
      ["presentation", "interview", "pitch", "demo", "review"],
      [
        [
          "Prepare and rehearse",
          [
            { days: 3, hour: 9 },
            { days: 1, hour: 17 },
          ],
        ],
      ],
    ),
    r(
      "Appointment",
      ["doctor", "dentist", "appointment", "checkup", "physio", "clinic"],
      [["Bring documents and insurance card", [{ days: 1, hour: 18 }]]],
    ),
    r(
      "Booking",
      ["dinner", "restaurant", "reservation", "table"],
      [["Confirm the booking", [{ days: 1, hour: 10 }]]],
    ),
  ];
}

/* Calendar categories. Only the colour of the rail on a calendar block and the
   chip in the event sheet — they carry no scheduling meaning. */
export const CATS = {
  work: { name: "Work", fg: "#3f5a7a", bg: "#eef2f7" },
  personal: { name: "Personal", fg: "#e8813f", bg: "#fbeadd" },
  family: { name: "Family", fg: "#5f7f5c", bg: "#edf2ea" },
  trip: { name: "Travel", fg: "#8a6a4f", bg: "#f4ece4" },
};

export const catOf = (key) => CATS[key] || CATS.personal;

function sampleEvents() {
  const mk = (title, offsetDays, from, to, cat, extra = {}) => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + offsetDays);
    const allDay = !from;
    let end = null;
    if (!allDay) {
      d.setHours(...from, 0, 0);
      const e = startOfDay(d);
      e.setDate(e.getDate() + (to[0] < from[0] ? 1 : 0));
      e.setHours(...to, 0, 0);
      end = e.toISOString();
    }
    return {
      id: `sample-${uid()}`,
      title,
      start: d.toISOString(),
      end,
      allDay,
      location: "",
      description: "",
      recurring: false,
      repeats: "",
      organizer: null,
      tasks: [],
      alerts: [],
      cat,
      source: "sample",
      ...extra,
    };
  };
  return [
    mk("Design review", 0, [10, 0], [11, 30], "work", {
      location: "Studio, room 2",
      description: "Bring the ladder prototypes.",
      alerts: [15],
    }),
    mk("Lunch with Jo", 0, [13, 0], [14, 0], "personal", {
      location: "Café Nord",
    }),
    mk("Quarterly planning", 1, [9, 0], [12, 0], "work", {
      location: "Studio, big room",
      description: "Bring the roadmap one-pager.",
      alerts: [1440],
    }),
    mk("Flight LH1042 — Lisbon", 2, [7, 15], [9, 45], "trip", {
      location: "BER Terminal 1, Berlin",
      description: "Cabin bag only — 55×40×23.",
      alerts: [1440, 120],
    }),
    mk("Lisbon — three nights", 2, null, null, "trip", { location: "Alfama" }),
    mk("Client workshop", 5, [10, 0], [16, 0], "work", {
      location: "Lisbon office",
    }),
    mk("Return flight LH1043", 6, [18, 40], [21, 10], "trip", {
      location: "LIS Terminal 1",
      alerts: [120],
    }),
    mk("Team retro", 7, [15, 0], [16, 0], "work", {
      location: "Studio, room 2",
    }),
    mk("Yoga", 7, [19, 0], [20, 0], "personal", {
      location: "Prenzlauer studio",
    }),
    mk("Mara's birthday", 10, null, null, "family", {
      recurring: true,
      repeats: "yearly",
      description: "Repeats yearly. Last year: the ceramics book.",
    }),
    mk("Dinner — Anna and Jo", 10, [19, 30], [22, 0], "personal", {
      location: "Nobelhart",
      description: "Booked under Anna.",
    }),
    mk("Parents visiting", 13, null, null, "family"),
    mk("Sprint kickoff", 14, [9, 30], [10, 30], "work", { location: "Studio" }),
    mk("Dentist — cleaning", 16, [11, 0], [12, 0], "personal", {
      location: "Dr. Reuter, Kastanienallee 12",
      description: "Bring the insurance card.",
      alerts: [1440, 60],
    }),
    mk("Car service", 19, [8, 0], [9, 0], "personal", {
      location: "Werkstatt Ohlauer",
    }),
  ];
}

/* ---------- to-do lists ----------
   Accents are the muted inks of the paper palette. Amber is not among them:
   it belongs to "live" and nothing else.                                  */
export const ACCENTS = [
  "#3f5a7a",
  "#5f7f5c",
  "#8a6a4f",
  "#7a6a8c",
  "#436f6d",
  "#8c5b6b",
];

export const nextAccent = (lists) => ACCENTS[lists.length % ACCENTS.length];

function defaultLists() {
  const inDays = (n, h = 12) => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + n);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const lead = (...days) =>
    days.map((d) => ({ kind: "lead", days: d, hour: 9 }));
  const item = (title, due, reminders, notes, subtasks = []) => ({
    id: uid(),
    title,
    notes: notes || "",
    due,
    reminders,
    done: false,
    subtasks: subtasks.map((s) => ({
      id: uid(),
      title: s[0],
      due: s[1] ?? null,
      reminders: [],
      done: !!s[2],
    })),
  });
  const list = (id, name, accent, items) => ({ id, name, accent, items });
  return [
    list("list-house", "House related", ACCENTS[0], [
      item(
        "Replace water filter",
        inDays(10, 9),
        lead(7, 2),
        "Model BWT 814. Two-pack, arrives in 3–4 days.",
        [
          ["Order filter cartridges", inDays(1, 9), true],
          ["Turn off the stopcock", null, false],
          ["Swap and flush", inDays(10, 9), false],
        ],
      ),
      item(
        "Renew home insurance",
        inDays(-9, 9),
        lead(14, 7, 1),
        "Barmenia's quote is €18/mo cheaper — the cancellation letter must be posted, not emailed.",
      ),
      item("Bleed the radiators", null, [], ""),
      item(
        "Fix the bathroom light",
        null,
        [],
        "Needs a GU10 and probably a new fitting.",
        [
          ["Measure the fitting", null, false],
          ["Buy the bulb", null, false],
        ],
      ),
    ]),
    list("list-buy", "Things to buy", ACCENTS[1], [
      item(
        "Present for Mara",
        inDays(10, 9),
        lead(10, 5),
        "She mentioned the Bauhaus weaving book.",
      ),
      item("Coffee beans", null, [], ""),
      item("Dish soap", null, [], ""),
      item("Extension cable, 5 m", null, [], ""),
    ]),
    list("list-work", "Work", ACCENTS[2], [
      item(
        "Q3 headcount sheet",
        inDays(7, 9),
        lead(5, 1),
        "Finance wants it before the board pre-read goes out.",
        [
          ["Pull the current roster", null, true],
          ["Confirm two open reqs", null, true],
          ["Send to Anke", inDays(7, 9), false],
        ],
      ),
      item("Book the offsite room", inDays(15, 9), lead(7), ""),
    ]),
    list("list-groceries", "Groceries", ACCENTS[3], [
      item("Olive oil", null, [], ""),
      item("Bread flour", null, [], ""),
      item("Yoghurt", null, [], ""),
      item("Tomatoes", null, [], ""),
      item("Washing-up sponges", null, [], ""),
    ]),
    list("list-admin", "Admin and paperwork", ACCENTS[4], [
      item(
        "Tax return 2025",
        inDays(56, 9),
        lead(30, 14, 3),
        "Belege für das Arbeitszimmer fehlen noch.",
        [
          ["Collect receipts", null, false],
          ["Book an hour with the Steuerberater", inDays(36, 9), false],
        ],
      ),
      item(
        "Renew passport",
        inDays(90, 9),
        lead(60, 21),
        "Expires next November, but appointments run eight weeks out.",
      ),
      item("Cancel the gym membership", inDays(-5, 9), lead(7), ""),
    ]),
    list("list-bike", "Bike", ACCENTS[5], [
      item("Service before Lisbon", inDays(1, 9), lead(3), "", [
        ["Drop off at Standert", null, false],
      ]),
      item("New rear light", null, [], ""),
    ]),
    list("list-reading", "Reading", ACCENTS[0], [
      item("Return the library books", inDays(6, 9), lead(2), ""),
      item("Finish the Le Guin", null, [], ""),
      item("Order the Perec", null, [], ""),
    ]),
    list("list-garden", "Garden", ACCENTS[1], [
      item(
        "Cut back the wisteria",
        inDays(17, 9),
        lead(3),
        "Second cut of the year — five buds from the base.",
      ),
      item("Water timer batteries", null, [], ""),
    ]),
  ];
}

export const defaultData = () => {
  const events = sampleEvents();
  const seen = {};
  events.forEach((e) => {
    seen[e.id] = new Date().toISOString();
  });
  return {
    events,
    rules: defaultRules(),
    lists: defaultLists(),
    state: { done: {}, snoozed: {}, notified: [], seen, muted: {} },
    settings: {
      fallback: true,
      fallbackHour: 20,
      watchNew: false,
      watchOnlyOthers: true,
      myEmail: "",
      todoAutoRemind: true,
      todoAutoHour: 9,
      /* added in 1.2.0 — loadData merges over these, so no migration */
      quiet: true,
      quietFrom: "22:00",
      quietTo: "07:00",
      defaultLead: 2,
      defaultSnooze: "3h",
      /* A phone is the base case: three legible columns rather than seven
         cramped ones. Every other view is one tap away, and anyone who prefers
         the week can pin it here — a stored choice is never overridden. */
      calDefault: "day3",
      weekStart: "mon",
      weekNums: true,
      undatedAt: "bottom",
      confirmDelete: false,
      sound: "chime",
      badge: true,
      haptics: true,
    },
  };
};

/* ---------- storage ---------- */
export async function loadData() {
  try {
    const res = await window.storage.get(STORE_KEY);
    if (res && res.value) {
      const parsed = JSON.parse(res.value);
      return {
        ...defaultData(),
        ...parsed,
        lists: parsed.lists || [],
        state: {
          done: {},
          snoozed: {},
          notified: [],
          seen: {},
          muted: {},
          ...(parsed.state || {}),
        },
        settings: { ...defaultData().settings, ...(parsed.settings || {}) },
      };
    }
  } catch (e) {
    /* first run — no key yet */
  }
  return null;
}
