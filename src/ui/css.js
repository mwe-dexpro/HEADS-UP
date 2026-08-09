/* ============================================================
   UI — "Ladder": clinical paper
   ------------------------------------------------------------
   One CSS string, injected as a <style>. There is no Tailwind
   compiler in the target runtime, so arbitrary-value classes
   silently do nothing; every value lives here or, when it is
   computed at render time (a track position, a category colour),
   in an inline style.

   The palette has exactly one accent. #e8813f is amber and amber
   means live — a reminder that is due right now. Nothing else may
   use it. Origin is carried by the rail down the left edge of a
   card: ink for a calendar event, slate blue for a to-do, amber
   when the thing is live.

   One file, one <style>, and no imports: everything below is CSS,
   and the words in it are not code.
   ============================================================ */

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.lx{
  --paper:#f7f5f0; --card:#fff; --panel:#fbf9f5; --sunk:#f4f1ea; --sunk-2:#f2efe8;
  --seam:#eae6dd;
  --ink:#17160f; --ink-2:#2c2a20; --on-ink:#faf8f2;
  --dark:#17160f; --dark-2:#211f18; --dark-line:#302e26; --dark-border:#3a382e;
  --dark-label:#7a746a; --dark-meta:#8c8578; --dark-value:#e6e2d8;
  --amber:#e8813f; --amber-ink:#b4470f;
  --mute:#6f6a5e; --mute-2:#8b8578; --mute-3:#a09a8c; --mute-4:#b3ada0; --mute-5:#c2bcae;
  --line:#e2ded4; --line-2:#e6e1d7; --line-3:#efece4; --line-4:#ece8e0;
  --field:#ddd8cc; --field-2:#d9d3c6; --field-3:#cfc9bb; --dash:#d8d3c7;
  --blue:#3f5a7a; --blue-bg:#eef2f7; --blue-line:#dde5ef; --blue-mute:#93a4b8;
  --green:#5f7f5c;
  /* The rail colour again at chip strength, behind the origin label. */
  --tint-live:#f6d9c2; --tint-todo:#d5dee8; --tint-event:#e6e2d8;
  --warn:#9a6410; --warn-bg:#fdf6ea; --warn-line:#e6d3b8; --warn-ink:#4a3812;
  --warn-text:#6b5326; --warn-dot:#c98a26; --warn-chip:#fdf1dd;
  --danger:#b4470f; --danger-bg:#fdf4f0; --danger-line:#e8cfc2;
  --body:'Public Sans',system-ui,-apple-system,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,'SF Mono',monospace;
  /* The tab bar's own height, safe area included, so the two things that float
     above it can be positioned from one number. */
  --nav-h:calc(64px + max(8px, env(safe-area-inset-bottom)));
  /* One number for "a thumb can hit this". Every control that takes a tap is
     sized from it rather than from whatever the type happened to need. */
  --tap:44px;
  /* 16px is the threshold below which iOS Safari zooms the page on focus. Every
     field the user types into is set from this, so the app never jumps. */
  --field-type:16px;
  background:#e8e4de; color:var(--ink); font-family:var(--body);
  -webkit-font-smoothing:antialiased;
  /* Touch first: no 300ms tap delay, no grey flash on tap, no text inflation
     when the phone is turned sideways. */
  touch-action:manipulation;
  -webkit-tap-highlight-color:transparent;
  -webkit-text-size-adjust:100%; text-size-adjust:100%;
  /* DEFINITE height, not min-height. A flex column whose height comes from its
     content cannot make a child scroll: the child just grows, the document
     scrolls instead, and the tab bar ends up thousands of pixels below the fold.
     dvh so the mobile URL bar collapsing does not clip the tab bar; vh first as
     the fallback for browsers without it. */
  height:100vh; height:100dvh; overflow:hidden;
  display:flex; flex-direction:column;
}
.lx *,.lx *::before,.lx *::after{box-sizing:border-box}
.lx button,.lx input,.lx textarea,.lx select{font-family:inherit;touch-action:manipulation}
.lx button:focus-visible,.lx input:focus-visible,.lx textarea:focus-visible,
.lx select:focus-visible,.lx [tabindex]:focus-visible{
  outline:2px solid var(--amber-ink); outline-offset:2px}
/* Touch has no hover, so a press has to answer instead. Every button dips very
   slightly under the finger; the two second-long ones say so more loudly. */
.lx button:active{opacity:.72}
.lx button:disabled:active{opacity:1}
/* Hover is a bonus for the pointer devices that have one, never a requirement:
   nothing is only discoverable by hovering it. */
@media (hover:hover) and (pointer:fine){
  .lx-listrow:hover,.lx-hit:hover,.lx-selrow:hover,.lx-ag-item:hover{background:var(--panel)}
  .lx-led:hover{background:var(--sunk)}
}
.lx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}
@keyframes lx-undobar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@keyframes lx-rise{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes lx-sheet-in{from{transform:translateY(26px);opacity:.4}to{transform:translateY(0);opacity:1}}
@media (prefers-reduced-motion:reduce){
  .lx *,.lx *::before,.lx *::after{
    animation-duration:.001ms !important;animation-iteration-count:1 !important;
    transition-duration:.001ms !important}
}

/* ---------- shell ----------
   The phone is the base case, not a breakpoint: full bleed, safe-area insets
   honoured, nothing but the frame added back at desktop widths. */
.lx-phone{flex:1;width:100%;max-width:440px;margin:0 auto;min-height:0;
  display:flex;flex-direction:column;position:relative;overflow:hidden;
  background:var(--paper);
  /* A notch in landscape eats the left or right edge; the app pays for it once,
     here, rather than in every page's padding. */
  padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
/* min-height:0 on a flex child is what lets it be *smaller* than its content,
   which is the precondition for it scrolling at all. Without it the default
   min-height:auto wins and the child refuses to shrink. */
@media (min-width:520px){
  .lx-phone{max-height:900px;margin:22px auto;border-radius:22px;
    box-shadow:0 2px 4px rgba(0,0,0,.08),0 18px 44px rgba(0,0,0,.16)}
}
/* A phone lying on its side has almost no height to spare: give the vertical
   chrome back to the content. */
@media (max-height:520px) and (orientation:landscape){
  .lx{--nav-h:calc(52px + max(4px, env(safe-area-inset-bottom)))}
  .lx-status{display:none}
  .lx-nav{padding-top:2px}
  .lx-nav button{gap:3px}
}
.lx-status{height:26px;flex:none;display:grid;grid-template-columns:1fr auto 1fr;
  align-items:center;padding:0 18px;font:500 10.5px var(--mono);color:var(--mute-3);
  background:var(--paper)}
.lx-status .mark{letter-spacing:.12em}
.lx-status .end{text-align:right}
.lx-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;position:relative;
  -webkit-overflow-scrolling:touch;
  /* Keep the rubber band and pull-to-refresh out of a surface whose rows are
     swiped sideways for a living. */
  overscroll-behavior:contain}
.lx-scroll::-webkit-scrollbar,.lx-sheet-body::-webkit-scrollbar{width:0;height:0}
.lx-page{padding:6px 16px 26px}
.lx-page.flush{padding:8px 0 24px}

/* ---------- tab bar ---------- */
.lx-nav{flex:none;height:var(--nav-h);border-top:1px solid var(--line);
  background:var(--panel);display:grid;grid-template-columns:repeat(4,1fr);
  padding-top:6px;padding-bottom:max(8px,env(safe-area-inset-bottom))}
.lx-nav button{border:0;background:transparent;cursor:pointer;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:6px;padding-top:6px}
.lx-nav .lab{font:500 10.5px var(--body)}
.lx-ico{position:relative;display:block;width:20px;height:20px}
.lx-ico i{position:absolute;display:block;background:currentColor}
.lx-navbadge{position:absolute;top:-7px;right:-11px;min-width:17px;height:17px;
  padding:0 4px;border-radius:9px;color:var(--on-ink);
  font:600 10px/17px var(--mono);text-align:center}

/* ---------- page header ---------- */
.lx-head{display:flex;align-items:flex-end;justify-content:space-between;
  padding:8px 2px 14px;gap:10px}
.lx-h1{font:600 21px/1.1 var(--body);color:var(--ink);letter-spacing:-.01em}
.lx-h1-sub{font:500 11px var(--mono);color:var(--mute-3);margin-top:4px;letter-spacing:.06em}
.lx-dots{width:44px;height:44px;margin-right:-10px;flex:none;border:0;background:transparent;
  color:var(--mute);font:500 17px var(--mono);cursor:pointer}

/* ---------- counters ---------- */
.lx-counters{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--line);
  border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:22px}
.lx-counter{background:var(--card);padding:9px 11px 10px}
.lx-counter.live{background:var(--dark)}
.lx-counter .k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-3)}
.lx-counter.live .k{color:var(--amber)}
.lx-counter .v{font:600 22px/1 var(--body);color:var(--ink);margin-top:5px}
.lx-counter.live .v{color:var(--on-ink)}

/* ---------- the live card ----------
   Filled, not tinted: at arm's length this is a different kind of
   object, not the same object in a different shade. */
.lx-live{background:var(--dark);border-left:5px solid var(--amber);
  border-radius:0 14px 14px 0;padding:15px 15px 13px;margin-bottom:22px;
  box-shadow:0 8px 22px rgba(23,22,15,.18);cursor:pointer}
.lx-live-top{display:flex;align-items:center;justify-content:space-between;
  gap:10px;margin-bottom:11px}
.lx-due{display:inline-block;background:var(--amber);color:var(--ink);
  font:600 9.5px var(--mono);letter-spacing:.12em;padding:4px 7px 3px;border-radius:3px;
  white-space:nowrap}
.lx-rung{display:flex;align-items:center;gap:8px;font:500 10px var(--mono);
  letter-spacing:.07em;color:var(--dark-meta);white-space:nowrap}
.lx-rung em{color:#5d584f;font-style:normal}
.lx-live h3{margin:0 0 13px;font:600 22px/1.18 var(--body);color:var(--on-ink);
  letter-spacing:-.015em;text-wrap:pretty}
.lx-live-open{margin-top:11px;padding:11px 12px;background:var(--dark-2);
  border-radius:9px;display:flex;flex-direction:column;gap:8px}
.lx-live-act{display:flex;gap:8px;margin-top:12px}
.lx-btn-amber{flex:1;height:48px;border:0;border-radius:9px;background:var(--amber);
  color:var(--ink);font:600 14.5px var(--body);cursor:pointer}
.lx-btn-dark{flex:none;width:104px;height:48px;border:1px solid var(--dark-border);
  border-radius:9px;background:transparent;color:var(--dark-value);
  font:500 14px var(--body);cursor:pointer}
.lx-snoozelist{margin-top:11px;display:flex;flex-direction:column;gap:1px;
  background:var(--dark-line);border-radius:9px;overflow:hidden}
.lx-snoozelist button{border:0;background:var(--dark-2);color:var(--dark-value);
  text-align:left;padding:0 13px;height:46px;font:400 14px var(--body);cursor:pointer;
  display:flex;align-items:center;justify-content:space-between;gap:10px}
.lx-snoozelist .at{font:500 10px var(--mono);color:var(--dark-meta);letter-spacing:.06em}

/* ---------- the shared key/value table ----------
   Every card body is this grid, in this order. Nothing invents its own. */
.lx-kv{display:flex;flex-direction:column;gap:7px;padding:11px 0 12px;
  border-top:1px solid var(--dark-line);border-bottom:1px solid var(--dark-line)}
.lx-kv-row{display:grid;grid-template-columns:66px 1fr;gap:10px;align-items:baseline}
.lx-kv-k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--dark-label)}
.lx-kv-v{font:400 13.5px/1.35 var(--body);color:var(--dark-value);text-wrap:pretty}
.lx-kv.paper{gap:6px;padding:10px 0 0;border-top:1px solid var(--line-3);border-bottom:0}
.lx-kv.paper .lx-kv-k{color:var(--mute-4)}
.lx-kv.paper .lx-kv-v{color:var(--ink-2)}
.lx-marks{display:flex;flex-wrap:wrap;gap:6px;padding-top:10px}
.lx-mark{font:500 9px var(--mono);letter-spacing:.1em;color:var(--dark-meta);
  border:1px solid var(--dark-border);border-radius:3px;padding:3px 5px 2px}
.lx-marks.paper{padding-top:0;margin-top:10px}
.lx-marks.paper .lx-mark{color:var(--mute-3);border-color:var(--line-2)}

/* ---------- section headers ---------- */
.lx-sec{margin-bottom:20px}
.lx-sec-head{display:flex;align-items:center;gap:9px;margin-bottom:9px;padding:0 2px}
.lx-sec-label{font:500 10px var(--mono);letter-spacing:.13em;color:var(--mute-2)}
.lx-rule-line{flex:1;height:1px;background:var(--line)}
.lx-sec-count{font:500 10px var(--mono);color:var(--mute-4)}
.lx-stack{display:flex;flex-direction:column;gap:9px}

/* ---------- the queued card ---------- */
.lx-card{background:var(--card);border:1px solid var(--line-2);
  border-left:5px solid var(--line);border-radius:0 13px 13px 0;
  padding:13px 14px 12px;cursor:pointer;text-align:left;width:100%;display:block}
.lx-card-top{display:flex;align-items:center;justify-content:space-between;
  gap:10px;margin-bottom:8px}
.lx-card-k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-3);
  white-space:nowrap}
.lx-card-due{display:flex;align-items:center;gap:8px;font:500 9.5px var(--mono);
  letter-spacing:.08em;color:var(--mute);white-space:nowrap}
.lx-card-due em{color:var(--mute-5);font-style:normal}
.lx-card-live{font:600 9.5px var(--mono);letter-spacing:.12em;color:var(--amber-ink);
  white-space:nowrap}
.lx-card h3{margin:0 0 11px;font:600 17.5px/1.22 var(--body);color:var(--ink);
  letter-spacing:-.01em;text-wrap:pretty}
.lx-card-open{margin-top:10px;padding:11px 12px;background:var(--sunk);
  border-radius:9px;display:flex;flex-direction:column;gap:8px}
.lx-card-act{display:flex;gap:8px;margin-top:11px}
.lx-btn-quiet{flex:1;height:44px;border:1px solid var(--field-2);border-radius:9px;
  background:var(--panel);color:var(--ink);font:500 14px var(--body);cursor:pointer}
.lx-btn-quiet.narrow{flex:none;width:104px}

/* ---------- Home: the ledger ----------
   Full-bleed rows, not cards. The rail runs the whole height of a row and says
   where the reminder came from; the only boundary is a hairline. Live earns a
   filled amber band across the full width — with no card edge to fill, the band
   is the strongest state change available, and it carries the origin at the same
   time.

   Deliberately no caret and no mark chips, unlike the card treatment: the origin
   is now permanent rather than hidden behind a tap, and a ledger that grows
   badges stops being a ledger. Recurrence moved into the WHEN value, where it
   reads as part of the sentence. */
.lx-led{margin:0 -16px 22px;padding:0 16px 15px;background:var(--paper);
  border-bottom:1px solid var(--line);border-left:7px solid var(--line);
  cursor:pointer;text-align:left;width:100%;display:block}
.lx-led-head{margin:0 -16px 11px;padding:6px 16px 5px;display:flex;
  align-items:center;justify-content:space-between;gap:10px}
.lx-led-head .from{font:600 9.5px var(--mono);letter-spacing:.14em;color:var(--ink);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-led-head .now{font:600 9.5px var(--mono);letter-spacing:.1em;
  color:rgba(23,22,15,.62);flex:none}
.lx-led-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-bottom:8px}
.lx-led-meta .t{font:600 9.5px var(--mono);letter-spacing:.12em;color:var(--ink)}
.lx-led-meta .due{font:500 9.5px var(--mono);letter-spacing:.08em;color:var(--mute-2);
  flex:none}
.lx-led h3{margin:0 0 12px;font:700 25px/1.08 var(--body);color:var(--ink);
  letter-spacing:-.022em;text-wrap:pretty}
.lx-led-rows{display:flex;flex-direction:column}
.lx-led-row{display:grid;grid-template-columns:66px 1fr;gap:10px;align-items:baseline;
  padding:7px 0;border-top:1px solid var(--line)}
.lx-led-row .k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-3)}
.lx-led-row .v{font:400 13.5px/1.35 var(--body);color:var(--ink);text-wrap:pretty}
.lx-led-act{display:flex;gap:8px;margin-top:13px}
/* Square corners: a ledger has rules, not rounded cards. */
.lx-btn-ink{flex:1;height:48px;border:0;background:var(--ink);color:var(--on-ink);
  font:600 14.5px var(--body);cursor:pointer}
.lx-btn-line{flex:none;width:104px;height:48px;border:1px solid var(--field-3);
  background:transparent;color:#4a463b;font:500 14px var(--body);cursor:pointer}
.lx-led-snooze{display:flex;flex-direction:column;margin-top:4px}
.lx-led-snooze button{border:0;border-top:1px solid var(--line);background:transparent;
  color:var(--ink);text-align:left;padding:0;height:46px;font:400 14px var(--body);
  cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px}
.lx-led-snooze .at{font:500 10px var(--mono);color:var(--mute-3);letter-spacing:.06em}

/* A queued row: no band, an origin chip instead, and quieter throughout. */
.lx-led.q{margin:0 -16px;padding:13px 16px 14px}
.lx-led-tags{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-bottom:7px}
.lx-led-tags .left{display:flex;align-items:baseline;gap:7px;min-width:0}
.lx-led-tags .origin{font:600 9px var(--mono);letter-spacing:.1em;color:var(--ink);
  padding:2px 5px 1px;flex:none}
.lx-led-tags .rung{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-led-tags .due{font:500 9.5px var(--mono);letter-spacing:.08em;color:var(--mute-3);
  flex:none}
.lx-led.q h3{margin:0 0 10px;font:600 19.5px/1.15 var(--body);letter-spacing:-.016em}
.lx-led.q .lx-led-row{padding:5px 0;border-top:1px solid var(--line-4)}
.lx-led.q .lx-led-row .k{color:var(--mute-4)}
.lx-led.q .lx-led-row .v{color:var(--ink-2)}
.lx-btn-led{width:100%;height:44px;margin-top:10px;border:1px solid var(--field-2);
  background:transparent;color:var(--ink);font:500 14px var(--body);cursor:pointer}
/* Rows butt against each other; the hairline is the separator, not a gap. */
.lx-led-list{display:flex;flex-direction:column}
.lx-sec.led{margin-bottom:18px}
.lx-sec.led .lx-sec-head{margin-bottom:2px}

/* ---------- empty states ---------- */
.lx-empty{border:1px dashed var(--dash);border-radius:14px;padding:26px 18px;
  text-align:center;margin-bottom:22px}
.lx-empty .t{font:600 15px var(--body);color:var(--ink)}
.lx-empty .d{font:400 13px/1.5 var(--body);color:var(--mute-2);margin-top:5px}

/* ---------- runway ----------
   One event's whole ladder on a single track. The thing you forget
   about your own rule is its shape. */
.lx-block{margin-top:26px;padding-top:18px;border-top:1px solid var(--line)}
.lx-block-head{display:flex;align-items:baseline;justify-content:space-between;
  margin-bottom:12px;padding:0 2px;gap:10px}
.lx-block-note{font:400 11px var(--body);color:var(--mute-4)}
.lx-panel{background:var(--card);border:1px solid var(--line-2);border-radius:13px;
  padding:14px 15px 16px}
.lx-runway-t{font:600 15.5px var(--body);color:var(--ink);text-wrap:pretty;
  display:block;width:100%;border:0;background:transparent;text-align:left;
  cursor:pointer;min-height:var(--tap);padding:6px 0;margin:-6px 0}
.lx-runway-m{font:500 10.5px var(--mono);color:var(--mute-3);margin-top:4px;
  letter-spacing:.06em}
.lx-track{position:relative;height:56px;margin:18px 0 4px}
.lx-track-base{position:absolute;left:0;right:0;top:15px;height:2px;background:var(--line-3)}
.lx-track-fill{position:absolute;left:0;top:15px;height:2px;background:var(--ink)}
.lx-track-now{position:absolute;top:2px;bottom:16px;width:1px;background:var(--amber)}
.lx-dot{position:absolute;top:9px;width:14px;height:14px;margin-left:-7px;
  border-radius:50%;background:var(--ink);border:3px solid var(--card);
  box-shadow:0 0 0 1px var(--ink)}
.lx-dot.now{top:6px;width:20px;height:20px;margin-left:-10px;background:var(--amber);
  box-shadow:0 0 0 1px var(--amber)}
.lx-dot.ahead{top:11px;width:10px;height:10px;margin-left:-5px;background:var(--card);
  border:2px solid var(--field-3);box-shadow:none}
.lx-track-end{position:absolute;right:0;top:8px;width:4px;height:16px;background:var(--ink)}
.lx-track-lab{position:absolute;top:30px;font:500 9px var(--mono);color:var(--mute-3);
  letter-spacing:.06em;white-space:nowrap;transform:translateX(-50%)}
.lx-track-lab.hot{font-weight:600;color:var(--amber-ink)}
.lx-track-lab.tail{right:0;transform:none;font-weight:600;color:var(--ink)}
.lx-rows{display:flex;flex-direction:column;gap:1px;margin-top:14px;
  background:var(--line-3);border-radius:8px;overflow:hidden}
.lx-row3{display:grid;grid-template-columns:30px 1fr auto;gap:9px;align-items:center;
  background:var(--panel);padding:9px 11px;border:0;width:100%;text-align:left;
  cursor:pointer}
.lx-row3 .k{font:500 9.5px var(--mono);color:var(--mute-3);letter-spacing:.06em}
.lx-row3 .t{font:400 13px var(--body);min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-row3 .s{font:500 9px var(--mono);letter-spacing:.1em}
.lx-runway-sum{margin-top:11px;font:400 12px var(--body);color:var(--mute-2)}

/* ---------- handled ---------- */
.lx-seam{display:flex;flex-direction:column;gap:1px;background:var(--seam);
  border-radius:10px;overflow:hidden}
.lx-handled{display:flex;align-items:center;justify-content:space-between;gap:10px;
  background:var(--sunk-2);padding:11px 12px}
.lx-handled .t{font:400 13.5px var(--body);color:var(--mute-2);
  text-decoration:line-through;text-decoration-color:#c9c3b5;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-handled .m{font:500 9.5px var(--mono);color:var(--mute-4);margin-top:3px;
  letter-spacing:.06em}
.lx-putback{flex:none;height:var(--tap);padding:0 14px;border:1px solid var(--field);
  border-radius:9px;background:var(--panel);color:var(--mute);font:500 13px var(--body);
  cursor:pointer}
.lx-quiet-note{font:400 12.5px var(--body);color:var(--mute-4);padding:4px 2px}

/* ---------- rules: the test box ---------- */
.lx-btn-out{height:var(--tap);padding:0 14px;flex:none;border:1px solid var(--field-2);
  border-radius:9px;background:var(--card);color:var(--ink);font:500 13.5px var(--body);
  cursor:pointer}
.lx-testbox{background:var(--dark);border-radius:14px;padding:14px 14px 15px;
  margin-bottom:20px}
.lx-test-head{display:flex;align-items:center;justify-content:space-between;
  gap:10px;margin-bottom:10px}
.lx-test-k{font:600 9.5px var(--mono);letter-spacing:.13em;color:var(--amber)}
.lx-test-d{font:500 9.5px var(--mono);letter-spacing:.06em;color:var(--dark-label);
  white-space:nowrap}
.lx-input-dark{width:100%;height:50px;border:1px solid var(--dark-border);
  border-radius:9px;background:var(--dark-2);color:var(--on-ink);
  font:400 16px var(--body);padding:0 13px;outline:none}
.lx-input-dark::placeholder{color:var(--dark-label)}
.lx-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.lx-chip-dark{height:var(--tap);padding:0 14px;border:1px solid var(--dark-border);
  border-radius:8px;background:transparent;color:var(--dark-meta);
  font:500 11px var(--mono);cursor:pointer}
.lx-test-out{margin-top:13px;padding-top:12px;border-top:1px solid var(--dark-line)}
.lx-verdict{font:500 9.5px var(--mono);letter-spacing:.11em;color:var(--dark-label);
  margin-bottom:9px}
.lx-test-rows{display:flex;flex-direction:column;gap:1px;border-radius:8px;
  overflow:hidden;background:var(--dark-line)}
.lx-test-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;
  align-items:baseline;background:var(--dark-2);padding:10px 11px}
.lx-test-row .t{font:400 13.5px var(--body);color:var(--dark-value);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-test-row .l{font:500 9.5px var(--mono);color:var(--dark-meta);letter-spacing:.06em}
.lx-test-row .d{font:500 11px var(--mono);color:var(--amber);letter-spacing:.04em}
.lx-test-none{font:400 13px/1.5 var(--body);color:var(--dark-meta);padding:2px 1px}

/* ---------- rules: warnings ---------- */
.lx-warns{border:1px solid var(--warn-line);background:var(--warn-bg);border-radius:11px;
  padding:11px 13px;margin-bottom:18px}
.lx-warns h4{margin:0 0 7px;font:600 9.5px var(--mono);letter-spacing:.12em;color:var(--warn)}
.lx-warnlist{display:flex;flex-direction:column;gap:5px}
.lx-warn{display:grid;grid-template-columns:10px 1fr;gap:8px;align-items:baseline}
.lx-warn i{width:5px;height:5px;border-radius:50%;background:var(--warn-dot);
  display:block;transform:translateY(-2px)}
.lx-warn span{font:400 12.5px/1.45 var(--body);color:var(--warn-text)}
.lx-warn strong{font-weight:600;color:var(--warn-ink)}

/* ---------- rules: the rule card ---------- */
.lx-rule{background:var(--card);border:1px solid var(--line-2);border-radius:13px;
  overflow:hidden}
.lx-rule.dead{border-color:var(--warn-line)}
.lx-rule-btn{width:100%;text-align:left;border:0;background:transparent;
  padding:13px 14px 12px;cursor:pointer;display:block}
.lx-rule-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.lx-rule-name{font:600 16.5px var(--body);color:var(--ink);letter-spacing:-.01em}
.lx-rule-caret{font:500 10px var(--mono);color:var(--mute-4);white-space:nowrap}
.lx-kw{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.lx-kw .k{font:500 10.5px var(--mono);color:var(--blue);background:var(--blue-bg);
  border-radius:4px;padding:4px 7px 3px}
.lx-kw .k.none{color:var(--warn);background:var(--warn-chip)}
.lx-ladder-wrap{display:flex;align-items:center;gap:10px;margin-top:11px}
.lx-ladder{position:relative;flex:1;height:16px}
.lx-ladder .base{position:absolute;left:0;right:0;top:7px;height:1px;background:var(--line-2)}
.lx-ladder .end{position:absolute;right:0;top:2px;width:3px;height:11px;background:var(--ink)}
.lx-ladder i{position:absolute;top:4px;width:8px;height:8px;margin-left:-4px;
  border-radius:50%;background:var(--blue);display:block}
.lx-ladder-sum{font:500 10px var(--mono);color:var(--mute-2);letter-spacing:.05em;
  white-space:nowrap}
.lx-rule-open{padding:2px 14px 14px;border-top:1px solid var(--line-3);margin-top:2px}
.lx-fieldlabel{font:500 9.5px var(--mono);letter-spacing:.12em;color:var(--mute-4);
  margin:18px 0 8px}
.lx-fieldlabel:first-child{margin-top:13px}
.lx-kwedit{display:flex;flex-wrap:wrap;gap:6px}
.lx-kwedit .k{font:500 12.5px var(--mono);color:var(--blue);background:var(--blue-bg);
  border:1px solid var(--blue-line);border-radius:9px;padding:0 4px 0 11px;
  min-height:var(--tap);display:inline-flex;align-items:center;gap:2px}
.lx-kwedit .k button{border:0;background:transparent;color:var(--blue-mute);
  font:500 16px var(--mono);cursor:pointer;line-height:1;
  /* Removing a keyword is its own target, the full height of the chip. */
  width:var(--tap);height:var(--tap);display:flex;
  align-items:center;justify-content:center}
.lx-add{height:var(--tap);padding:0 14px;border:1px dashed #cfd8e3;border-radius:9px;
  background:transparent;color:#7b8da0;font:500 12.5px var(--mono);cursor:pointer}
.lx-kwinput{height:var(--tap);width:140px;border:1px solid var(--blue-line);border-radius:9px;
  background:var(--card);color:var(--blue);font:500 var(--field-type) var(--mono);padding:0 10px;
  outline:none}
.lx-tasks{display:flex;flex-direction:column;gap:9px}
.lx-task{border:1px solid var(--line-4);border-radius:10px;padding:11px 11px 12px;
  background:var(--panel)}
.lx-task-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.lx-task-name{font:500 var(--field-type) var(--body);color:var(--ink);border:0;
  background:transparent;padding:6px 0;outline:none;min-width:0;flex:1;
  min-height:var(--tap)}
.lx-task-count{font:500 9.5px var(--mono);letter-spacing:.06em;color:var(--mute-3);
  white-space:nowrap}
.lx-task-count.dead{color:var(--warn)}
.lx-task-x{border:0;background:transparent;color:var(--mute-5);font:400 19px var(--body);
  cursor:pointer;line-height:1;flex:none;width:var(--tap);height:var(--tap);
  margin:-10px -12px -10px -4px;display:flex;align-items:center;justify-content:center}
.lx-leadchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.lx-leadchip{height:var(--tap);min-width:54px;padding:0 12px;border:1px solid #e0dbd0;
  border-radius:9px;background:transparent;color:var(--mute-3);
  font:500 12px var(--mono);cursor:pointer}
.lx-leadchip.on{background:var(--ink);border-color:var(--ink);color:var(--on-ink)}
.lx-task-dead{margin-top:9px;font:400 11.5px/1.4 var(--body);color:var(--warn)}
.lx-rule-act{display:flex;gap:8px;margin-top:14px}
.lx-btn-warn{width:96px;flex:none;height:var(--tap);border:1px solid var(--warn-line);
  border-radius:9px;background:transparent;color:var(--warn);font:500 14px var(--body);
  cursor:pointer}
.lx-catchall{margin-top:20px;background:var(--card);border:1px solid var(--line-2);
  border-radius:13px;padding:13px 14px}
.lx-catchall .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.lx-catchall .t{font:600 14.5px var(--body);color:var(--ink)}
.lx-catchall .d{font:400 12.5px/1.5 var(--body);color:var(--mute-2);margin-top:4px;
  text-wrap:pretty}

/* ---------- toggles ---------- */
.lx-toggle{flex:none;width:52px;height:32px;border-radius:16px;border:0;
  background:var(--field);position:relative;cursor:pointer;transition:background .16s ease}
.lx-toggle i{position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:13px;
  background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.25);
  transition:left .16s ease;display:block}
/* The switch reads at 52×32; the thing a thumb actually hits is 44 tall and
   overhangs it, which is why this is a pseudo-element and not padding. */
.lx-toggle::after{content:'';position:absolute;left:-4px;right:-4px;
  top:calc(50% - var(--tap) / 2);height:var(--tap)}
.lx-toggle.on{background:var(--ink)}
.lx-toggle.on i{left:23px}
.lx-toggle.lg{width:58px;height:34px;border-radius:17px}
.lx-toggle.lg i{top:3px;left:3px;width:28px;height:28px;border-radius:14px}
.lx-toggle.lg.on i{left:27px}

/* ---------- lists ---------- */
.lx-input{width:100%;height:48px;border:1px solid var(--field);border-radius:11px;
  background:var(--card);color:var(--ink);font:400 var(--field-type) var(--body);
  padding:0 14px;outline:none}
.lx-input.tall{height:52px}
.lx-input::placeholder{color:var(--mute-4)}
.lx-hit{border:0;background:var(--card);text-align:left;padding:12px 13px;cursor:pointer;
  min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.lx-hit .t{font:500 15px var(--body);color:var(--ink)}
.lx-hit .l{font:500 9.5px var(--mono);letter-spacing:.08em;color:var(--blue);
  white-space:nowrap}
.lx-seam.r11{border-radius:11px}
.lx-seam.r12{border-radius:12px}
.lx-listrow{border:0;background:var(--card);text-align:left;padding:0;cursor:pointer;
  display:grid;grid-template-columns:5px 1fr auto;align-items:stretch;min-height:64px;
  width:100%;-webkit-user-select:none;user-select:none}
.lx-listrow .bar{display:block}
.lx-listrow .mid{display:flex;flex-direction:column;justify-content:center;gap:5px;
  padding:11px 0 11px 13px;min-width:0}
.lx-listrow .name{font:600 15.5px var(--body);color:var(--ink);letter-spacing:-.005em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-listrow .meta{font:500 9.5px var(--mono);letter-spacing:.09em}
.lx-listrow .right{display:flex;align-items:center;gap:10px;padding:0 14px 0 12px}
.lx-listrow .count{font:500 15px var(--mono);color:var(--mute-2)}
.lx-listrow .caret{font:400 14px var(--mono);color:var(--field-3)}
.lx-dash{width:100%;height:48px;border:1px dashed var(--field-3);border-radius:11px;
  background:transparent;color:var(--mute-2);font:500 13px var(--body);cursor:pointer}
.lx-dash.sm{height:46px;font-size:12.5px}
.lx-back{height:44px;margin-left:-10px;padding:0 10px;text-align:left;border:0;
  background:transparent;color:var(--mute);font:500 12.5px var(--body);cursor:pointer}

/* ---------- lists: a swipeable to-do ---------- */
.lx-sw{position:relative;border-radius:0 12px 12px 0;overflow:hidden;touch-action:pan-y}
.lx-sw.flat{border-radius:0}
.lx-sw-under{position:absolute;inset:0;display:flex;align-items:center}
.lx-sw-under.done{background:var(--green)}
.lx-sw-under.del{background:var(--danger);justify-content:flex-end}
.lx-sw-under .lab{font:600 10.5px var(--mono);letter-spacing:.13em;color:#fff;
  padding:0 15px}
.lx-todo{position:relative;background:var(--card);border:1px solid var(--line-2);
  border-left:4px solid var(--line);border-radius:0 12px 12px 0;padding:12px 13px;
  cursor:pointer;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.lx-todo.plain{border:0;border-radius:0;padding:11px 13px}
.lx-todo.picked{background:var(--blue-bg);border-color:var(--blue)}
.lx-todo-grid{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start}
.lx-todo.plain .lx-todo-grid{align-items:center}
.lx-circle{width:44px;height:44px;margin:-8px -8px -8px -9px;border:0;
  background:transparent;cursor:pointer;display:flex;align-items:center;
  justify-content:center;padding:0}
.lx-circle i{width:28px;height:28px;border:1.5px solid var(--field-3);
  border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;
  font:600 13px var(--body);background:transparent;font-style:normal}
.lx-circle.on i{background:var(--blue);border-color:var(--blue)}
.lx-todo-t{font:500 15.5px/1.25 var(--body);color:var(--ink);text-wrap:pretty}
.lx-todo-t.one{font:400 15px var(--body);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;min-width:0}
.lx-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.lx-tag{font:500 10px var(--mono);letter-spacing:.06em;color:var(--mute);
  border:1px solid var(--line-2);border-radius:4px;padding:4px 6px 3px;white-space:nowrap}
.lx-tag.solid{border-color:transparent}
.lx-todo-caret{font:500 13px var(--mono);color:var(--mute-5);padding-top:5px}
.lx-todo.plain .lx-todo-caret{padding-top:0;color:var(--field-3)}
.lx-donetoggle{width:100%;margin-top:18px;height:44px;border:1px solid var(--line-2);
  border-radius:10px;background:transparent;color:var(--mute-2);
  font:500 11.5px var(--mono);letter-spacing:.08em;cursor:pointer}

/* ---------- lists: bulk bar ---------- */
.lx-bulk{position:absolute;left:0;right:0;bottom:var(--nav-h);background:var(--dark);
  box-shadow:0 -12px 30px rgba(23,22,15,.22);animation:lx-rise .16s ease both;z-index:6}
.lx-bulk-dates{display:flex;flex-wrap:wrap;gap:7px;padding:13px 14px 3px;
  border-bottom:1px solid var(--dark-line)}
.lx-bulk-date{height:var(--tap);padding:0 14px;border:1px solid var(--dark-border);
  border-radius:9px;background:var(--dark-2);color:var(--dark-value);
  font:600 10.5px var(--mono);letter-spacing:.1em;cursor:pointer;margin-bottom:10px}
.lx-bulk-lists{max-height:186px;overflow:auto;border-bottom:1px solid var(--dark-line)}
.lx-bulk-lists button{width:100%;height:46px;padding:0 15px;border:0;
  border-bottom:1px solid var(--dark-2);background:transparent;color:var(--dark-value);
  font:400 14.5px var(--body);cursor:pointer;display:flex;align-items:center;
  justify-content:space-between;gap:10px}
.lx-bulk-lists .n{font:500 10px var(--mono);color:var(--dark-label)}
.lx-bulk-head{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:11px 14px 8px}
.lx-bulk-n{font:600 10.5px var(--mono);letter-spacing:.13em;color:var(--amber)}
.lx-bulk-hint{font:400 12px var(--body);color:var(--dark-meta);margin-top:3px}
.lx-bulk-mini{height:var(--tap);padding:0 14px;border:1px solid var(--dark-border);
  border-radius:8px;background:transparent;color:var(--dark-meta);
  font:600 10px var(--mono);letter-spacing:.1em;cursor:pointer}
.lx-bulk-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 14px 14px}
.lx-bulk-act{height:46px;border:0;border-radius:10px;font:600 10.5px var(--mono);
  letter-spacing:.09em;cursor:pointer;color:#fff}
.lx-bulk-act.go{background:var(--green)}
.lx-bulk-act.kill{background:var(--danger)}
.lx-bulk-act.ghost{border:1px solid var(--dark-border);background:transparent;
  color:var(--dark-value)}
.lx-bulk-act.ghost.on{background:var(--blue);color:var(--on-ink)}

/* ---------- undo ----------
   Reversibility instead of confirmation dialogs. */
.lx-undo{position:absolute;left:12px;right:12px;bottom:calc(var(--nav-h) + 8px);
  background:var(--dark);
  border-radius:12px;padding:12px 12px 0;box-shadow:0 10px 28px rgba(23,22,15,.3);
  animation:lx-rise .18s ease both;z-index:5}
.lx-undo-in{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding-bottom:11px}
.lx-undo .t{font:500 13.5px var(--body);color:var(--on-ink);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-undo .m{font:500 9.5px var(--mono);color:var(--dark-meta);margin-top:3px;
  letter-spacing:.07em}
.lx-undo-btn{flex:none;height:var(--tap);padding:0 17px;border:1px solid var(--amber);
  border-radius:8px;background:transparent;color:var(--amber);font:600 13px var(--body);
  cursor:pointer}
.lx-undo-bar{height:2px;background:var(--dark-line);border-radius:1px;overflow:hidden}
.lx-undo-bar i{display:block;height:2px;background:var(--amber);transform-origin:left;
  animation:lx-undobar 9s linear both}

/* ---------- sheets ----------
   A sheet is a whole screen on a phone, and it is dismissed the way a phone
   dismisses things: dragged down by its head. The Close button stays for the
   keyboard and for anyone who would rather tap. */
.lx-sheet{position:absolute;left:0;right:0;top:0;bottom:0;background:var(--paper);
  display:flex;flex-direction:column;animation:lx-sheet-in .2s ease;z-index:12;
  will-change:transform}
.lx-sheet-head{flex:none;display:flex;align-items:center;justify-content:space-between;
  gap:10px;padding:6px 14px 12px;border-bottom:1px solid var(--line);
  background:var(--panel);touch-action:pan-x;-webkit-user-select:none;user-select:none}
.lx-sheet-head .title{font:600 11px var(--mono);letter-spacing:.13em;color:var(--mute-2)}
.lx-sheet-head .pad{width:56px;flex:none}
/* The grabber is the whole width of the head, so the drag starts wherever the
   thumb happens to land rather than only on the 36px pill it draws. */
.lx-grab{flex:none;display:flex;align-items:center;justify-content:center;height:22px;
  background:var(--panel);touch-action:pan-x;-webkit-user-select:none;user-select:none;
  cursor:grab}
.lx-grab i{display:block;width:38px;height:4px;border-radius:2px;background:var(--field-2)}
.lx-sheet-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch}
.lx-close{height:var(--tap);padding:0 10px;margin-left:-6px;flex:none;border:0;
  background:transparent;color:var(--mute);font:500 13.5px var(--body);cursor:pointer;
  text-align:left;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-edit{height:var(--tap);padding:0 16px;flex:none;border:1px solid var(--field);
  border-radius:10px;background:var(--card);color:var(--blue);font:600 11px var(--mono);
  letter-spacing:.1em;cursor:pointer}
.lx-cancel{height:var(--tap);padding:0 14px;flex:none;border:0;background:transparent;
  color:var(--mute-2);font:500 13.5px var(--body);cursor:pointer}
.lx-savenote{font:500 9.5px var(--mono);letter-spacing:.12em;color:var(--mute-5)}

/* ---------- sheets: reading an event ---------- */
.lx-cat{display:inline-block;font:600 9.5px var(--mono);letter-spacing:.12em;
  border-radius:4px;padding:4px 7px 3px}
.lx-sheet-h{margin:11px 0 16px;font:600 24px/1.15 var(--body);color:var(--ink);
  letter-spacing:-.018em;text-wrap:pretty}
.lx-table{display:flex;flex-direction:column;background:var(--card);
  border:1px solid var(--line-2);border-radius:12px;overflow:hidden}
.lx-table-row{display:grid;grid-template-columns:82px 1fr;gap:10px;padding:12px 13px}
.lx-table-row+.lx-table-row{border-top:1px solid var(--line-3)}
.lx-table-k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-4)}
.lx-table-v{font:400 13.5px/1.4 var(--body);color:var(--ink-2);text-wrap:pretty}
.lx-note{font:400 11.5px/1.5 var(--body);color:var(--mute-3);margin-top:10px}

/* ---------- sheets: forms ---------- */
.lx-form{padding:18px 16px 26px;display:flex;flex-direction:column;gap:15px}
.lx-form-h{font:600 20px var(--body);color:var(--ink);letter-spacing:-.012em}
.lx-lab{font:500 9.5px var(--mono);letter-spacing:.12em;color:var(--mute-4);
  margin-bottom:6px}
.lx-in{width:100%;height:50px;border:1px solid var(--field);border-radius:10px;
  background:var(--card);color:var(--ink);font:500 var(--field-type) var(--body);
  padding:0 12px;outline:none}
.lx-in.mono{font:500 var(--field-type) var(--mono)}
.lx-in.plain{font:400 var(--field-type) var(--body)}
.lx-in::placeholder{color:var(--mute-4)}
.lx-ta{width:100%;border:1px solid var(--field);border-radius:10px;background:var(--card);
  color:var(--ink-2);font:400 var(--field-type)/1.5 var(--body);padding:12px;outline:none;
  resize:none}
.lx-ta::placeholder{color:var(--mute-4)}
.lx-rowcard{display:flex;align-items:center;justify-content:space-between;gap:12px;
  background:var(--card);border:1px solid var(--line-2);border-radius:10px;
  padding:11px 13px}
.lx-rowcard .t{font:500 14px var(--body);color:var(--ink)}
.lx-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lx-daynote{font:400 11.5px var(--body);color:var(--mute-3);margin-top:6px}
.lx-save{flex:1;height:48px;border:0;border-radius:11px;background:var(--ink);
  color:var(--on-ink);font:600 12px var(--mono);letter-spacing:.1em;cursor:pointer}
.lx-kill{height:48px;padding:0 16px;flex:none;border:1px solid var(--danger-line);
  border-radius:11px;background:var(--danger-bg);color:var(--danger);
  font:600 12px var(--mono);letter-spacing:.1em;cursor:pointer}
.lx-chip{height:var(--tap);padding:0 15px;border:1px solid var(--field);border-radius:10px;
  background:var(--card);color:var(--mute);font:600 11px var(--mono);
  letter-spacing:.08em;cursor:pointer;white-space:nowrap}
/* "sm" is narrower, never shorter — the height is the part a thumb needs. */
.lx-chip.sm{padding:0 12px}
.lx-chip.on{background:var(--blue);border-color:var(--blue);color:#fff}
.lx-chip.ink.on{background:var(--ink);border-color:var(--ink);color:var(--on-ink)}
.lx-chip.danger{color:var(--danger);border-color:var(--danger-line)}
.lx-chip.off{background:var(--sunk);color:var(--mute-5);border-color:var(--line-2);
  cursor:default}

/* ---------- sheets: a to-do ---------- */
.lx-td-title{width:calc(100% + 18px);margin:0 -9px;padding:6px 9px;
  border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ink);
  font:600 23px/1.2 var(--body);letter-spacing:-.016em;outline:none;resize:none;
  field-sizing:content;text-wrap:pretty}
.lx-td-title:focus{border-color:var(--field);background:var(--card)}
.lx-td-card{background:var(--card);border:1px solid var(--line-2);border-radius:12px;
  padding:13px 13px 14px}
.lx-td-date{width:calc(100% + 8px);margin:0 -4px;padding:0 4px;height:46px;border:0;
  border-bottom:1px solid var(--line-3);border-radius:0;background:transparent;
  color:var(--ink);font:500 var(--field-type) var(--mono);outline:none}
.lx-hr{height:1px;background:var(--line-3);margin:14px 0 13px}
.lx-locked{font:400 11.5px/1.4 var(--body);color:var(--mute-3);margin-top:8px}
.lx-steps{display:flex;flex-direction:column;gap:1px;background:var(--seam);
  border:1px solid var(--line-2);border-radius:12px;overflow:hidden}
.lx-step{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;
  background:var(--card);padding:6px 10px}
.lx-step-box{width:44px;height:44px;margin:0 -10px 0 -12px;border:0;background:transparent;
  cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.lx-step-box i{width:22px;height:22px;border:1.5px solid var(--field-3);border-radius:5px;
  background:transparent;color:var(--on-ink);font:600 11px/20px var(--body);display:block;
  text-align:center;font-style:normal}
.lx-step-box.on i{background:var(--ink);border-color:var(--ink)}
.lx-step input{width:100%;height:var(--tap);border:0;background:transparent;color:var(--ink);
  font:400 var(--field-type) var(--body);padding:0;outline:none}
.lx-step input.draft{padding-left:31px}
.lx-step .when{font:500 9px var(--mono);color:var(--mute-4);letter-spacing:.06em;
  white-space:nowrap}
.lx-step-x{width:44px;height:44px;margin:0 -12px 0 -6px;border:0;background:transparent;
  color:var(--mute-5);font:400 17px var(--body);cursor:pointer;padding:0}
.lx-select-full{width:100%;height:50px;border:1px solid var(--line-2);border-radius:12px;
  background:var(--card);color:var(--ink);font:400 var(--field-type) var(--body);
  padding:0 10px;outline:none}
/* The commit row never scrolls away: on a phone the thing you came to do has to
   be under your thumb whatever the form's length. */
.lx-sheet-foot{flex:none;display:flex;gap:8px;padding:12px 14px;
  padding-bottom:max(16px, env(safe-area-inset-bottom));
  border-top:1px solid var(--line);background:var(--panel)}

/* ---------- settings ---------- */
.lx-set-label{font:600 10px var(--mono);letter-spacing:.14em;color:var(--mute-2);
  margin-bottom:8px}
.lx-set-group{background:var(--card);border:1px solid var(--line-2);border-radius:12px;
  overflow:hidden;margin-bottom:22px}
.lx-set-group>*+*{border-top:1px solid var(--line-3)}
.lx-set-row{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 13px}
.lx-set-row .t{font:500 14.5px var(--body);color:var(--ink)}
.lx-set-row .d{font:400 12px/1.45 var(--body);color:var(--mute-2);margin-top:3px;
  text-wrap:pretty}
.lx-set-block{padding:13px 13px}
.lx-set-block .t{font:500 14.5px var(--body);color:var(--ink);margin-bottom:9px}
.lx-seg{display:grid;gap:2px;padding:2px;background:var(--line-4);border-radius:9px}
.lx-seg button{height:40px;border:0;border-radius:7px;background:transparent;
  color:var(--mute-2);font:600 10.5px var(--mono);letter-spacing:.07em;cursor:pointer;
  white-space:nowrap;overflow:hidden}
.lx-seg button.on{background:var(--ink);color:var(--on-ink)}
.lx-select{flex:none;width:150px;height:var(--tap);border:1px solid var(--field);
  border-radius:9px;background:var(--panel);color:var(--ink);
  font:400 var(--field-type) var(--body);padding:0 8px;outline:none}
.lx-time{width:100%;height:48px;border:1px solid var(--field);border-radius:9px;
  background:var(--panel);color:var(--ink);font:500 var(--field-type) var(--mono);
  padding:0 10px;outline:none}
.lx-minilabel{font:500 9px var(--mono);letter-spacing:.11em;color:var(--mute-4);
  margin-bottom:5px}
.lx-btn-danger{width:100%;height:46px;border:1px solid var(--danger-line);
  border-radius:11px;background:var(--danger-bg);color:var(--danger);
  font:600 11.5px var(--mono);letter-spacing:.09em;cursor:pointer}
.lx-version{text-align:center;font:500 9.5px var(--mono);letter-spacing:.1em;
  color:var(--mute-5);margin-top:16px}
.lx-file{display:block;width:100%;font:400 14px var(--body);color:var(--mute-2);
  padding:10px 0}
.lx-warnline{background:var(--warn-bg);border:1px solid var(--warn-line);
  border-radius:10px;padding:10px 12px;font:400 12.5px/1.45 var(--body);
  color:var(--warn-text);margin-bottom:14px}

/* ---------- calendar ---------- */
.lx-cal-head{padding:0 16px 10px}
.lx-cal-top{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
.lx-cal-title{font:600 19px/1.1 var(--body);color:var(--ink);letter-spacing:-.014em;
  white-space:nowrap}
.lx-cal-sub{display:flex;align-items:center;gap:7px;margin-top:5px}
.lx-cal-sub .s{font:500 10px var(--mono);color:var(--mute-3);letter-spacing:.11em}
.lx-kwbadge{font:600 9.5px var(--mono);color:var(--mute);background:var(--line-4);
  border-radius:4px;padding:3px 6px 2px;letter-spacing:.08em;white-space:nowrap}
.lx-cal-nav{flex:none;display:flex;align-items:center;gap:4px}
.lx-cal-nav button{width:var(--tap);height:var(--tap);border:1px solid var(--line);
  border-radius:10px;background:var(--card);color:var(--mute);font:400 17px var(--body);
  cursor:pointer}
.lx-cal-nav button.today{width:auto;padding:0 13px;font:600 10.5px var(--mono);
  letter-spacing:.09em}
.lx-cal-seg{margin-top:12px}
.lx-cal-gridhead{display:flex;padding:0 10px 4px;border-bottom:1px solid var(--line)}
.lx-gutter{width:36px;flex:none;display:flex;align-items:flex-end;justify-content:center;
  padding-bottom:4px;font:600 8.5px var(--mono);color:var(--mute-4);letter-spacing:.04em}
.lx-col{flex:1;text-align:center;min-width:0}
.lx-col .dow{font:600 9px var(--mono);letter-spacing:.09em}
.lx-col .num{font:600 15px var(--body);margin-top:2px}
.lx-allday{display:flex;flex-direction:column;gap:2px;margin-top:4px;padding:0 2px}
.lx-allday button{border:0;border-radius:4px;font:500 8.5px/15px var(--mono);
  min-height:19px;padding:2px 3px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;cursor:pointer;text-align:left}
.lx-cal-body{display:flex;padding:0 10px}
.lx-hours{width:36px;flex:none;position:relative}
.lx-hour{height:44px;font:500 9px var(--mono);color:var(--mute-4);padding-top:3px}
.lx-colbody{flex:1;position:relative;min-width:0;border-left:1px solid var(--line-3)}
.lx-slot{position:absolute;left:0;right:0;height:44px;border:0;
  border-top:1px solid var(--line-3);background:transparent;cursor:pointer;padding:0;z-index:1}
.lx-ev{position:absolute;border:0;border-left:3px solid var(--ink);
  border-radius:0 5px 5px 0;padding:3px 4px;text-align:left;overflow:hidden;
  cursor:pointer;z-index:2}
/* Two lines before the ellipsis: on a narrow column one line is rarely a
   title, it is a prefix. */
.lx-ev .t{font:600 9.5px/1.2 var(--body);color:var(--ink);overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow-wrap:anywhere}
.lx-ev .m{font:500 8px var(--mono);color:var(--mute);margin-top:2px}
.lx-nowline{position:absolute;left:0;right:0;height:1.5px;background:var(--amber-ink);
  z-index:3;pointer-events:none}
.lx-cal-foot{padding:12px 16px 0}
.lx-month{padding:0 12px}
.lx-month-dow{display:grid;margin-bottom:4px}
.lx-month-dow div{text-align:center;font:600 9px var(--mono);letter-spacing:.08em;
  color:var(--mute-4)}
.lx-month-body{border-top:1px solid var(--line-3)}
.lx-month-row{display:grid;gap:1px;background:var(--line-4);border:1px solid var(--line-4);
  border-top:0;overflow:hidden}
.lx-weekno{background:var(--paper);display:flex;align-items:center;justify-content:center;
  font:600 8.5px var(--mono);color:var(--mute-4);letter-spacing:.04em}
.lx-day{height:56px;border:0;background:var(--card);cursor:pointer;padding:5px 0 0;
  display:flex;flex-direction:column;align-items:center;gap:3px}
.lx-day .n{width:23px;height:23px;border-radius:50%;display:block;
  font-family:var(--body);font-size:12.5px;line-height:23px}
.lx-day .bars{display:flex;flex-direction:column;gap:2px;width:70%}
.lx-day .bars i{height:3px;border-radius:2px;display:block}
.lx-day .more{font:500 8px var(--mono);color:var(--mute-4)}
.lx-selrow{border:0;background:var(--card);text-align:left;padding:11px 12px;
  cursor:pointer;display:grid;grid-template-columns:3px 1fr;gap:10px;align-items:stretch}
.lx-selrow .rail{border-radius:2px;display:block}
.lx-selrow .t{font:500 15px var(--body);color:var(--ink);display:block}
.lx-selrow .m{font:500 10px var(--mono);color:var(--mute-2);letter-spacing:.06em;
  display:block;margin-top:4px}
.lx-agenda-head{display:flex;align-items:center;gap:9px;margin-bottom:8px}
.lx-agenda-head .day{font:600 10px var(--mono);letter-spacing:.13em;color:var(--mute-2)}
.lx-agenda-head .tag{font:600 9px var(--mono);letter-spacing:.1em}
.lx-agenda-add{width:var(--tap);height:var(--tap);margin:-8px -12px -8px -6px;flex:none;
  border:0;background:transparent;color:var(--mute-4);font:400 18px var(--body);
  cursor:pointer}
.lx-ag-item{width:100%;border:1px solid var(--line-2);border-left:4px solid var(--ink);
  border-radius:0 12px 12px 0;background:var(--card);text-align:left;padding:11px 13px;
  cursor:pointer;display:flex;flex-direction:column;gap:5px}
.lx-ag-item .head{display:flex;align-items:baseline;justify-content:space-between;
  gap:10px;width:100%}
.lx-ag-item .t{font:500 15.5px/1.25 var(--body);color:var(--ink);min-width:0}
.lx-ag-item .time{font:500 10px var(--mono);color:var(--mute);white-space:nowrap;
  letter-spacing:.05em}
.lx-ag-item .where{display:block;font:400 12.5px/1.35 var(--body);color:var(--mute-2)}
.lx-newq{display:flex;flex-direction:column;gap:9px}

/* ---------- home: a swipeable ledger row ----------
   The ledger bleeds to both edges, so the wrapper carries the bleed and the row
   inside it goes back to zero margin. Without that the underlay would show in
   the gap between rows while a swipe is in flight. */
.lx-swb{position:relative;overflow:hidden;margin:0 -16px;touch-action:pan-y;
  -webkit-user-select:none;user-select:none}
.lx-swb.live{margin-bottom:22px}
.lx-swb .lx-led{margin-left:0;margin-right:0;margin-bottom:0}
.lx-swb-under{position:absolute;inset:0;display:flex;align-items:center;
  pointer-events:none}
.lx-swb-under.done{background:var(--green)}
.lx-swb-under.snooze{background:var(--ink);justify-content:flex-end}
.lx-swb-under .lab{font:600 10.5px var(--mono);letter-spacing:.13em;color:#fff;
  padding:0 18px}
.lx-swb-under.snooze .lab{color:var(--amber)}
/* The hint sits under the first row only, and only until the gesture has been
   used once. A gesture nobody knows about is not a control. */
.lx-gesture-hint{display:flex;align-items:center;justify-content:center;gap:7px;
  margin:0 0 18px;font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-4)}
.lx-gesture-hint b{font-weight:600;color:var(--mute-2)}

/* ---------- quick actions ----------
   What a long press opens: the row's whole verb list, one tap from the thumb,
   pinned to the bottom of the screen rather than floating in the middle. */
.lx-scrim{position:absolute;inset:0;background:rgba(23,22,15,.34);z-index:14;
  border:0;padding:0;width:100%;cursor:pointer;animation:lx-fade .14s ease both}
@keyframes lx-fade{from{opacity:0}to{opacity:1}}
.lx-quick{position:absolute;left:8px;right:8px;bottom:calc(var(--nav-h) + 8px);
  background:var(--dark);border-radius:16px;overflow:hidden;z-index:15;
  box-shadow:0 12px 34px rgba(23,22,15,.34);animation:lx-rise .17s ease both}
.lx-quick-head{padding:13px 16px 11px;border-bottom:1px solid var(--dark-line)}
.lx-quick-head .k{font:600 9.5px var(--mono);letter-spacing:.13em;color:var(--amber)}
.lx-quick-head .t{font:600 16px/1.25 var(--body);color:var(--on-ink);margin-top:5px;
  text-wrap:pretty}
.lx-quick-acts{display:flex;flex-direction:column}
.lx-quick-acts button{border:0;border-top:1px solid var(--dark-line);background:transparent;
  color:var(--dark-value);text-align:left;padding:0 16px;height:54px;
  font:400 15px var(--body);cursor:pointer;display:flex;align-items:center;
  justify-content:space-between;gap:12px}
.lx-quick-acts button:first-child{border-top:0}
.lx-quick-acts button .at{font:500 10px var(--mono);color:var(--dark-meta);
  letter-spacing:.06em}
.lx-quick-acts button.go{color:var(--amber);font-weight:600}
.lx-quick-acts button.kill{color:#e08b6a}

/* ---------- the sticky bits ----------
   Primary actions live at the bottom of the reach, not the bottom of the page. */
.lx-sticky-top{position:sticky;top:0;z-index:3;background:var(--paper);
  margin:0 -16px 18px;padding:2px 16px 10px;
  box-shadow:0 8px 10px -8px rgba(23,22,15,.14)}
.lx-sticky-act{position:sticky;bottom:0;z-index:3;background:var(--paper);
  margin:0 -16px;padding:10px 16px 8px;
  box-shadow:0 -8px 10px -8px rgba(23,22,15,.14)}

/* ---------- lists: naming, accent, deleting ---------- */
.lx-listhead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.lx-namebtn{flex:1;min-width:0;text-align:left;border:0;background:transparent;padding:0;
  cursor:pointer;display:block}
.lx-namebtn .pen{font:500 10px var(--mono);letter-spacing:.1em;color:var(--mute-4);
  margin-left:8px;vertical-align:middle;white-space:nowrap}
.lx-accents{display:flex;flex-wrap:wrap;gap:10px}
.lx-accent{width:var(--tap);height:var(--tap);border-radius:12px;border:2px solid transparent;
  cursor:pointer;padding:3px;background:transparent}
.lx-accent i{display:block;width:100%;height:100%;border-radius:9px}
.lx-accent.on{border-color:var(--ink)}
.lx-namefield{width:100%;height:56px;border:1px solid var(--field);border-radius:12px;
  background:var(--card);color:var(--ink);font:600 19px var(--body);padding:0 14px;
  outline:none}
.lx-namefield::placeholder{color:var(--mute-4);font-weight:400}
`;
