/* Rasterise web/icons/*.svg into every PNG the web manifest, iOS and Android
   need. Run only when the mark changes — the PNGs are committed, so a normal
   build and deploy needs neither this script nor Playwright:

     npm i -D playwright && node tools/make-icons.mjs

   Three shapes come out of the same drawing:
     icon.svg             full bleed, ink ground — web manifest, iOS, favicon
     icon-maskable.svg    same, inside the 80% safe circle — web maskable
     icon-foreground.svg  no ground, inside the 66% safe box — Android adaptive
*/

import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const icons = path.join(root, "web", "icons");
const res = path.join(root, "android", "app", "src", "main", "res");

/* [source svg, output path, pixel size, round?, transparent?] */
const WEB = [
  ["icon.svg", "web/icons/icon-192.png", 192],
  ["icon.svg", "web/icons/icon-512.png", 512],
  ["icon.svg", "web/icons/apple-touch-icon.png", 180],
  ["icon.svg", "web/icons/favicon-32.png", 32],
  ["icon-maskable.svg", "web/icons/icon-maskable-192.png", 192],
  ["icon-maskable.svg", "web/icons/icon-maskable-512.png", 512],
];

/* Android densities. The adaptive foreground is drawn on a 108dp canvas; the
   legacy square and round icons are 48dp. */
const DENSITIES = [
  ["mdpi", 1],
  ["hdpi", 1.5],
  ["xhdpi", 2],
  ["xxhdpi", 3],
  ["xxxhdpi", 4],
];

const browser = await chromium.launch();

async function render(
  svgFile,
  size,
  { round = false, transparent = false } = {},
) {
  const svg = await readFile(path.join(icons, svgFile), "utf8");
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<!doctype html><style>
       html,body{margin:0;background:transparent}
       svg{display:block;width:${size}px;height:${size}px;${round ? "border-radius:50%;overflow:hidden" : ""}}
     </style>${svg}`,
  );
  const buf = await page
    .locator("svg")
    .screenshot({ omitBackground: transparent || round });
  await page.close();
  return buf;
}

for (const [src, out, size] of WEB) {
  await writeFile(path.join(root, out), await render(src, size));
  console.log(`  ${out}  ${size}×${size}`);
}

for (const [density, scale] of DENSITIES) {
  const dir = path.join(res, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  const fg = Math.round(108 * scale);
  const legacy = Math.round(48 * scale);
  await writeFile(
    path.join(dir, "ic_launcher_foreground.png"),
    await render("icon-foreground.svg", fg, { transparent: true }),
  );
  await writeFile(
    path.join(dir, "ic_launcher.png"),
    await render("icon.svg", legacy),
  );
  await writeFile(
    path.join(dir, "ic_launcher_round.png"),
    await render("icon.svg", legacy, { round: true }),
  );
  console.log(`  android mipmap-${density}  fg ${fg}, legacy ${legacy}`);
}

await browser.close();
