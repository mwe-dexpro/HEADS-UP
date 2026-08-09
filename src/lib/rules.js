/* What a rule set is doing, and where it is doing nothing: match counts per
   rule, and the warnings the Rules tab and the tab badge both read. */

import { matchRules } from "./nudges.js";

/* How many of the user's actual events each rule catches. Grounding the summary
   in real data is what makes a dead rule visible instead of merely plausible. */
export function ruleMatchCounts(data) {
  const out = {};
  data.rules.forEach((r) => {
    out[r.id] = data.events.filter((e) => matchRules(e, [r]).length > 0).length;
  });
  return out;
}

/* The things that silently do nothing. Shared by the Rules screen and the tab
   badge so the two can never disagree about how many there are. */
export function ruleWarnings(data, counts) {
  const matchCounts = counts || ruleMatchCounts(data);
  const out = [];
  data.rules.forEach((r) => {
    if (!r.enabled) {
      out.push({
        rule: r.name,
        text: "is muted — it produces nothing while it is off.",
      });
      return;
    }
    if (r.keywords.length === 0)
      out.push({
        rule: r.name,
        text: "has no keywords — it can never match an event.",
      });
    (r.tasks || []).forEach((t) => {
      if (!t.leads || t.leads.length === 0)
        out.push({
          rule: `${r.name} · ${t.label}`,
          text: "has no lead times — it produces nothing.",
        });
    });
    if (matchCounts[r.id] === 0 && r.keywords.length > 0)
      out.push({
        rule: r.name,
        text: `matches none of your ${data.events.length} events. Check the spelling of its keywords.`,
      });
  });
  return out;
}
