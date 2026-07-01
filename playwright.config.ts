import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
  `pnpm dev --hostname 127.0.0.1 --port ${port}`;
const windowsChromePath =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync(windowsChromePath) ? windowsChromePath : undefined);

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",
  timeout: 45_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "off",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: webServerCommand,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: baseURL,
      },
  workers: process.env.CI ? 1 : undefined,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
});
