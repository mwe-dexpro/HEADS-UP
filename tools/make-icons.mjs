/* Rasterise web/icons/*.svg into the PNGs the manifest and iOS need.
   Run only when the mark changes — the PNGs are committed, so a normal build
   and deploy needs neither this script nor Playwright:

     npm i -D playwright && node tools/make-icons.mjs

   iOS ignores SVG icons and does not apply a mask, so apple-touch-icon gets
   the full-bleed mark on its own opaque ground. */

import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "web", "icons");

const JOBS = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon.svg", "apple-touch-icon.png", 180],
  ["icon.svg", "favicon-32.png", 32],
  ["icon-maskable.svg", "icon-maskable-192.png", 192],
  ["icon-maskable.svg", "icon-maskable-512.png", 512],
];

const browser = await chromium.launch();
for (const [src, out, size] of JOBS) {
  const svg = await readFile(path.join(dir, src), "utf8");
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
  );
  await writeFile(path.join(dir, out), await page.locator("svg").screenshot({ omitBackground: false }));
  await page.close();
  console.log(`  ${out}  ${size}×${size}`);
}
await browser.close();
