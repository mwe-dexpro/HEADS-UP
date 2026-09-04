import { defineConfig } from "drizzle-kit";

// `dialect: "sqlite"` is enough for `drizzle-kit generate` (schema diff → SQL
// migration files under ./drizzle). Migrations are applied with
// `wrangler d1 migrations apply` (see package.json db:migrate:*), not
// drizzle-kit push, so no D1 HTTP API credentials need to live here.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
