import type { CapacitorConfig } from "@capacitor/cli";

// Same application id as the prior "Ladder" build (de.dexpro.headsup) —
// this is a from-scratch rebuild of the same app, not a new one, so it
// should be upgradable in Play Store terms rather than a fresh listing.
const config: CapacitorConfig = {
  appId: "de.dexpro.headsup",
  appName: "Heads Up",
  // apps/web builds to ../web/dist — `npm run android` at the repo root
  // builds that first, then `cap sync` copies it in.
  webDir: "../web/dist",
};

export default config;
