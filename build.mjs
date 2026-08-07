/* ============================================================
   Build — esbuild, one file, no config format to learn
   ------------------------------------------------------------
     node build.mjs            production bundle into dist/
     node build.mjs --serve    watch + dev server on :8000

   esbuild is the only build dependency on purpose. src/HeadsUp.jsx
   is plain React with no bundler-specific imports, so all this
   does is transform JSX and concatenate. Swapping esbuild for
   anything else is a half-hour job, and the app does not care.

   Everything the build emits is referenced by a relative path, so
   dist/ can be served from a domain root or from a subdirectory —
   /HEADS-UP/ on GitHub Pages — with no rebuild and no base flag.
   ============================================================ */

import { build, context } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, rm } from "node:fs/promises";

const serve = process.argv.includes("--serve");
const PORT = Number(process.env.PORT || 8000);
const { version } = JSON.parse(await readFile("package.json", "utf8"));

const icons = (await readdir("web/icons")).map((f) => `web/icons/${f}`);

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: [
    "web/main.jsx",
    "web/index.html",
    "web/manifest.webmanifest",
    ...icons,
  ],
  /* outbase keeps web/icons/x.png at dist/icons/x.png instead of flattening it. */
  outbase: "web",
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: ["es2020", "chrome100", "safari15", "firefox100"],
  jsx: "automatic",
  loader: {
    ".html": "copy",
    ".webmanifest": "copy",
    ".png": "copy",
    ".svg": "copy",
  },
  /* React reads this to strip its development warnings and checks. */
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      serve ? "development" : "production",
    ),
  },
  minify: !serve,
  sourcemap: serve ? "inline" : "linked",
  logLevel: "info",
  metafile: true,
};

/* The worker is copied rather than bundled — it has no imports — and stamped
   with a hash of the bundle it belongs to. Same bytes, same cache name, so a
   rebuild that changed nothing does not evict a user's offline copy. */
async function emitServiceWorker() {
  const bundle = await readFile("dist/main.js");
  const hash = createHash("sha256").update(bundle).digest("hex").slice(0, 10);
  const src = await readFile("web/sw.js", "utf8");
  await writeFile(
    "dist/sw.js",
    src.replace(/__BUILD__/g, `${version}-${hash}`),
  );
  return `${version}-${hash}`;
}

/* GitHub Pages runs Jekyll unless told not to, and Jekyll drops files and
   directories beginning with an underscore. Nothing here starts with one today;
   this is one byte of insurance against the day something does. */
const emitNoJekyll = () => writeFile("dist/.nojekyll", "");

await rm("dist", { recursive: true, force: true });

if (!serve) {
  const result = await build(options);
  const build_id = await emitServiceWorker();
  await emitNoJekyll();
  const js = Object.entries(result.metafile.outputs).find(([f]) =>
    f.endsWith("main.js"),
  );
  console.log(`\n  build ${build_id}`);
  if (js)
    console.log(
      `  dist/main.js  ${(js[1].bytes / 1024).toFixed(0)} kB minified`,
    );
  console.log("  Serve dist/ from any static host. See README § Hosting it.\n");
} else {
  const ctx = await context({
    ...options,
    plugins: [
      {
        name: "sw",
        setup(b) {
          /* Re-stamp on every rebuild so the dev server never serves a worker
             pointing at a cache name that no longer exists. */
          b.onEnd(async () => {
            await emitServiceWorker().catch(() => {});
            await emitNoJekyll().catch(() => {});
          });
        },
      },
    ],
  });
  await ctx.watch();
  const { hosts, port } = await ctx.serve({
    servedir: "dist",
    port: PORT,
    host: "0.0.0.0",
  });
  const host = hosts.includes("127.0.0.1") ? "localhost" : hosts[0];
  console.log(`\n  Heads Up  →  http://${host}:${port}`);
  console.log("  Watching. Ctrl-C to stop.\n");
}
