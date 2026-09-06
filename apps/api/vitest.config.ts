import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations("./drizzle");
  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              MS_TENANT: "common",
              MS_CLIENT_ID: "test-client-id",
              MS_CLIENT_SECRET: "test-client-secret",
              API_BASE_URL: "https://api.test.example",
              FRONTEND_ORIGINS: "https://app.test.example,https://second.test.example",
              FRONTEND_APP_PATH: "/HEADS-UP/",
              REFRESH_TOKEN_PEPPER: "test-pepper-do-not-use-in-prod",
              // A fixed, throwaway ES256 JWK — generated once for the test
              // suite only, never used outside it. See src/lib/jwt.ts.
              JWT_SIGNING_KEY:
                '{"kty":"EC","x":"pNxXrFEHpJZmuCrZYehWyOBki33TeVNKn6bEz2mgc6w","y":"PSar1zqcOAnby_ZQ7b_w5_9H-PWNUZfs2hA0DAuTHpQ","crv":"P-256","d":"z9c-Nuo_RIPTroqz82_sQcdLaADjMd5_v-Qgml7kRA0","alg":"ES256"}',
            },
          },
        },
      },
    },
  };
});
