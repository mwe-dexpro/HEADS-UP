import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// GitHub Pages has no server config at all — no custom response headers are
// possible — so the CSP has to ride as a <meta http-equiv> tag instead of a
// real Content-Security-Policy header. That only covers the directives a
// meta tag supports (no frame-ancestors, no report-uri) but it's what a
// static host allows; GH Pages being HTTPS-only covers transport security
// separately. Injected at build time only, not in dev: Vite's dev server
// relies on inline/eval'd HMR code that this policy would break.
function cspPlugin(): Plugin {
  return {
    name: "heads-up-csp",
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html; // dev server: leave HTML untouched
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        // workers.dev covers any Cloudflare Worker subdomain; narrow this to
        // the API's exact origin once it's on a custom domain.
        "connect-src 'self' https://*.workers.dev",
        "img-src 'self' data:",
        "base-uri 'none'",
        "form-action 'self'",
        "object-src 'none'",
      ].join("; ");
      return {
        html,
        tags: [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: csp }, injectTo: "head-prepend" }],
      };
    },
  };
}

// GitHub Pages serves a project site from /<repo>/, so the production build
// needs every asset path to be relative to that subpath — see
// docs/DECISIONS.md ADR-010 (same reasoning the prior "Ladder" build used,
// its ADR-023). Local dev stays at "/". CI sets VITE_BASE_PATH=/HEADS-UP/.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), cspPlugin()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
});
