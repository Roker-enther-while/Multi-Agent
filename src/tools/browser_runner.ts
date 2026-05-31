import * as fs from "fs";
import * as path from "path";

export interface E2EStep {
  action: "goto" | "click" | "fill" | "waitForText" | "waitForSelector" | "screenshot" | "assert";
  url?: string;
  selector?: string;
  value?: string;
  text?: string;
}

export interface E2EScenario {
  id: string;
  name: string;
  steps: E2EStep[];
}

export interface E2EResult {
  scenarioId: string;
  status: "pass" | "fail" | "skipped";
  stepsCompleted: number;
  totalSteps: number;
  error?: string;
  screenshotPath?: string;
  tracePath?: string;
  durationMs: number;
}

export interface BrowserConfig {
  enabled: boolean;
  headless: boolean;
  baseUrl: string;
  timeoutMs: number;
}

export function loadBrowserConfig(): BrowserConfig {
  return {
    enabled: process.env.BROWSER_AUTOMATION_ENABLED === "true",
    headless: process.env.BROWSER_HEADLESS !== "false",
    baseUrl: process.env.BROWSER_BASE_URL || "http://localhost:3456",
    timeoutMs: parseInt(process.env.BROWSER_TIMEOUT_MS || "30000", 10),
  };
}

export async function runE2EScenario(
  scenario: E2EScenario,
  config: BrowserConfig,
  outputDir: string
): Promise<E2EResult> {
  const startTime = Date.now();

  if (!config.enabled) {
    return {
      scenarioId: scenario.id,
      status: "skipped",
      stepsCompleted: 0,
      totalSteps: scenario.steps.length,
      error: "Browser automation disabled (set BROWSER_AUTOMATION_ENABLED=true)",
      durationMs: Date.now() - startTime,
    };
  }

  // Try to load Playwright
  let playwright: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    playwright = require("playwright");
  } catch {
    return {
      scenarioId: scenario.id,
      status: "skipped",
      stepsCompleted: 0,
      totalSteps: scenario.steps.length,
      error: "Playwright not installed (run: npm run install:e2e)",
      durationMs: Date.now() - startTime,
    };
  }

  const pw = playwright as { chromium: { launch: (opts: unknown) => Promise<unknown> } };
  const browser = await pw.chromium.launch({ headless: config.headless }) as { newPage: () => Promise<unknown>; close: () => Promise<void> };
  const page = await browser.newPage() as {
    goto: (url: string) => Promise<void>;
    click: (selector: string) => Promise<void>;
    fill: (selector: string, value: string) => Promise<void>;
    waitForSelector: (selector: string, opts: unknown) => Promise<void>;
    screenshot: (opts: unknown) => Promise<void>;
    textContent: (selector: string) => Promise<string | null>;
  };

  fs.mkdirSync(outputDir, { recursive: true });

  let stepsCompleted = 0;
  let error: string | undefined;

  try {
    for (const step of scenario.steps) {
      try {
        switch (step.action) {
          case "goto":
            await page.goto(`${config.baseUrl}${step.url || "/"}`);
            break;
          case "click":
            if (step.selector) await page.click(step.selector);
            break;
          case "fill":
            if (step.selector && step.value) await page.fill(step.selector, step.value);
            break;
          case "waitForText":
            if (step.text) {
              await page.waitForSelector(`text=${step.text}`, { timeout: config.timeoutMs });
            }
            break;
          case "waitForSelector":
            if (step.selector) {
              await page.waitForSelector(step.selector, { timeout: config.timeoutMs });
            }
            break;
          case "screenshot":
            await page.screenshot({ path: path.join(outputDir, `${scenario.id}_step${stepsCompleted}.png`) });
            break;
          case "assert":
            if (step.selector && step.text) {
              const content = await page.textContent(step.selector);
              if (!content?.includes(step.text)) {
                throw new Error(`Assertion failed: expected "${step.text}" in ${step.selector}`);
              }
            }
            break;
        }
        stepsCompleted++;
      } catch (stepError) {
        error = `Step ${stepsCompleted} (${step.action}): ${stepError instanceof Error ? stepError.message : "Failed"}`;
        break;
      }
    }

    // Take final screenshot
    const screenshotPath = path.join(outputDir, `${scenario.id}_final.png`);
    await page.screenshot({ path: screenshotPath });

    return {
      scenarioId: scenario.id,
      status: error ? "fail" : "pass",
      stepsCompleted,
      totalSteps: scenario.steps.length,
      error,
      screenshotPath,
      durationMs: Date.now() - startTime,
    };
  } finally {
    await browser.close();
  }
}

export function parseE2EScenario(data: unknown): E2EScenario | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (!obj.id || !obj.name || !Array.isArray(obj.steps)) return null;
  return {
    id: String(obj.id),
    name: String(obj.name),
    steps: obj.steps.map((s) => {
      const step = s as Record<string, unknown>;
      return {
        action: String(step.action) as E2EStep["action"],
        url: step.url ? String(step.url) : undefined,
        selector: step.selector ? String(step.selector) : undefined,
        value: step.value ? String(step.value) : undefined,
        text: step.text ? String(step.text) : undefined,
      };
    }),
  };
}
