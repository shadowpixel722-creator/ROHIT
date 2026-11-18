import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Separate database so test accounts never mix with your real data, and a separate build folder (.next-e2e)
  // so tests can run while `npm run dev` is running. Requires `npm run build:e2e` first.
  webServer: {
    command: "npx prisma migrate deploy && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    // TRANSCRIBE_PROVIDER=fake: the handwriting pipeline runs end to end without calling OpenAI (no cost, no data sent).
    env: { DATABASE_URL: "file:./e2e.db", TRANSCRIBE_PROVIDER: "fake", OPENAI_API_KEY: "", NEXT_DIST_DIR: ".next-e2e" },
  },
});
