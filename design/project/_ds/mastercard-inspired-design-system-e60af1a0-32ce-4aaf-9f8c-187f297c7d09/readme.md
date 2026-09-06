# Mastercard-Inspired Design System

Guidelines-only design system modeled on Mastercard's current marketing site — warm editorial magazine aesthetic (cream canvas, oversized radii, circular "orbit" portraits). No codebase, Figma file, or slide deck was provided; the sole source is `uploads/DESIGN.md`, a written brand spec. Because no component library or screen source was attached, this system authors a standard component set from the brand rules rather than replicating an existing inventory.

**Sources**
- `uploads/DESIGN.md` — full written brand spec (colors, type, components, layout, motion) provided by the user. No Figma link, GitHub repo, or codebase path was given.

## Company / Product Context
Mastercard's public marketing site is a single surface: an editorial brand site (not a dashboard or transactional app) selling the brand's institutional-but-warm story to consumers, businesses, and partners. There is one product surface represented here — the **marketing website** — built as a UI kit in `ui_kits/marketing-site/`.

## Known Gaps / Substitutions
- **Font**: MarkForMC is proprietary/licensed and unavailable. Substituted with **Sofia Sans** (Google Fonts), which DESIGN.md itself lists as Mastercard's declared fallback. Headline letter-spacing (-2%) and body weight (450) are preserved. **Please supply real MarkForMC/MarkOffcForMC font files if you have licensed access** — swap them into `tokens/typography.css`.
- **Logo**: No logo asset was provided. Per instructions, no logo was drawn or approximated. Wherever a mark would go, the wordmark "Mastercard" renders in plain type. This is a placeholder — supply the real logo SVG for `assets/`.
- **Icons**: No icon codebase was provided. Substituted [Lucide](https://lucide.dev) via CDN (closest stroke-weight/fill match to a geometric arrow/utility icon system). Flagged for review.
- **Imagery**: No real photography was provided. Circular portraits and hero media use image placeholders — drop in real photography.

## Content Fundamentals
- **Voice**: Institutional confidence with editorial warmth — short, declarative marketing lines ("Learn more", "Explore", "Discover"), not corporate jargon or long paragraphs.
- **Person**: Speaks in third person about the brand/company in headlines ("We're always here when you need us" — first-person-plural, conversational), addresses the reader as "you" in supporting copy.
- **Casing**: Sentence case everywhere except the eyebrow label scale (14px/700/uppercase) and footer column headers — uppercase is reserved for these two small structural roles only, never for headlines or buttons.
- **Emoji**: Not used anywhere in the system — icons and the accent dot carry visual signal instead.
- **Labels**: Eyebrow labels use a tiny accent-dot prefix + short uppercase category noun ("• SERVICES", "• SOLUTIONS") — this is a recurring structural device, not just a style choice.
- **Button copy**: Verb-first, two words max ("Learn more", "Explore", "Discover", "Get started").
- **Vibe**: Premium annual-report magazine, not a fintech dashboard — copy is unhurried, spacious, one idea per section.

## Visual Foundations
- **Color**: Warm putty-cream canvas (`--surface-canvas`, #F3F0EE) instead of white everywhere. Ink Black (#141413) carries primary CTAs, headline text, and the footer. Signal Orange (#CF4500) is reserved strictly for consent/legal actions — never marketing CTAs. Light Signal Orange traces decorative orbital arcs only. Brand red/yellow appear only inside the logo mark, never as UI color.
- **Type**: One typeface family only (no serif/script accent). Headlines: weight 500, -2% letter-spacing, line-height tightens as size grows (1:1 at H1). Body: the distinctive weight 450 (not 400) for a softer reading tone. Uppercase confined to the 14px eyebrow/footer-header scale.
- **Spacing**: 8px base unit, powers-of-8 scale (8/16/24/32/48/64/96/128). Section rhythm is generous — 96–128px vertical padding between major sections on desktop, treating whitespace as structure that paces the reader.
- **Backgrounds**: No gradients in the core UI. The "gradient" impression comes from circular photo portraits fading into the cream canvas at their edge, and from very soft, large-spread card shadows. No repeating patterns/textures; imagery is full-bleed only in the hero.
- **Animation**: Not deeply specified in the source; treat as understated — soft blur-up image loads, no bouncy easing. Motion should read as calm, not playful.
- **Hover / press**: Hover states are largely implicit (no dramatic color swap documented); primary buttons compress slightly on press rather than shifting color — treat hover as a subtle opacity/shadow lift, not a hue change.
- **Borders**: Ink Black at 1.5px on pill buttons (crisp edge, same color as fill on primary); 1px at low opacity elsewhere (search input, footer country pill). Borders are preferred over shadows for functional delineation.
- **Shadows**: Atmospheric, not directional — large spread (24–110px), very low opacity (4–25%). 95% of surfaces sit directly on the canvas with zero shadow. See `guidelines/` elevation card.
- **Corner radii**: A three-tier system only — small (4px, decorative-only), signature mid (20/24/40px for buttons and stadium frames), or full pill/circle (50%/999px). The 8–12px "generic rounded corner" middle ground is deliberately absent.
- **Cards**: No boxy rounded-rectangle cards with left-border accents. Cards are either full pill/stadium shapes or perfect circles (portraits); flat surfaces use whitespace, not a bordered box, to separate.
- **Transparency/blur**: Used sparingly — nav pill can sit translucent-white over content; footer borders use white-at-30-40% opacity. No heavy backdrop-blur glass panels.
- **Imagery color vibe**: Warm-toned (oranges, skin tones, warm neutrals), not cool or black-and-white; no heavy grain.
- **Layout**: Floating pill nav (24px from top, never flush). Circular portraits are placed asymmetrically, never gridded — this asymmetry is the "constellation" effect.

## Iconography
No icon codebase, sprite sheet, or icon font was provided in the source material. **Substitution**: [Lucide](https://lucide.dev) icons loaded via CDN, chosen for its plain geometric stroke style that reads compatibly with the brand's minimal utility icons (arrow, search, chevron, hamburger, social marks). Loaded as `<script src="https://unpkg.com/lucide@latest"></script>` + `lucide.createIcons()` in components/kits that need icons. No emoji are used. No unicode glyphs are used as icons except the documented `↗` external-link marker and `→` arrow inside satellite CTAs (per DESIGN.md, these are treated as brand-documented text glyphs, not a general icon substitute). Flag for review if the real Mastercard icon set becomes available.

## Index
- `styles.css` — root stylesheet, imports every token file below.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadows.css`.
- `guidelines/` — foundation specimen cards (`@dsCard`-tagged) shown in the Design System tab: colors, type, spacing, radius, shadow, brand.
- `components/`
  - `forms/` — Button, IconButton, Input, Select, Checkbox, Radio, Switch
  - `feedback/` — Badge, Tag, Toast, Tooltip
  - `surfaces/` — Card, Dialog
  - `navigation/` — Tabs
- `ui_kits/marketing-site/` — interactive recreation of the Mastercard-style marketing homepage (nav, hero, service portraits, carousel, footer).
- `assets/` — no logo provided (see Known Gaps); placeholder imagery only.
- `SKILL.md` — Claude Code / Agent Skills-compatible packaging of this system.

## Intentional Additions
Standard component set (Button, IconButton, Input, Select, Checkbox, Radio, Switch, Card, Badge, Tag, Tabs, Dialog, Toast, Tooltip) was authored from brand rules since no component source was attached — sized and styled to the documented button/card/pill/shadow rules above.
