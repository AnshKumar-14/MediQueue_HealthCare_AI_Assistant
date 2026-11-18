/* eslint-disable no-console */
/**
 * Test runner for the MediQueue backend.
 *
 *   npm test
 *
 * Starts the API on a temporary port with an in-memory MongoDB (nothing is
 * written to Atlas), runs every suite in order, then shuts the server down.
 * Set BASE_URL to run the suites against an already-running server instead.
 */

const path = require("path");
const { spawn } = require("child_process");

const TEST_PORT = process.env.TEST_PORT || "5055";
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${TEST_PORT}`;
const useExternalServer = Boolean(process.env.BASE_URL);

const SUITES = [
  "chat-smoke.js",
  "booking-e2e.js",
  "triage-intake-e2e.js",
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
      lastError = new Error(`Health check returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }

  throw lastError || new Error("Timed out waiting for the API");
}

function runSuite(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      env: { ...process.env, BASE_URL },
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", (error) => {
      console.error(`Could not start ${file}:`, error.message);
      resolve(false);
    });
  });
}

async function main() {
  let server = null;
  const serverOutput = [];

  if (!useExternalServer) {
    console.log(`Starting API on ${BASE_URL} with an in-memory database...`);
    server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
      env: {
        ...process.env,
        PORT: TEST_PORT,
        USE_MEMORY_DB: "true",
        NODE_ENV: "test",
        CHAT_REQUESTS_PER_MINUTE: "500",
        CHAT_SESSIONS_PER_MINUTE: "200",
        CHAT_REMINDERS_ENABLED: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const collect = (chunk) => {
      const text = chunk.toString();
      serverOutput.push(text);
      if (process.env.TEST_VERBOSE) process.stdout.write(`[api] ${text}`);
    };
    server.stdout.on("data", collect);
    server.stderr.on("data", collect);

    try {
      await waitForHealth(BASE_URL);
    } catch (error) {
      console.error(`API did not become ready: ${error.message}`);
      console.error(serverOutput.join(""));
      server.kill();
      process.exit(1);
    }
  } else {
    console.log(`Running against the existing API at ${BASE_URL}`);
  }

  let failures = 0;
  for (const suite of SUITES) {
    console.log(`\n=== ${suite} ===`);
    const passed = await runSuite(suite);
    if (!passed) failures += 1;
  }

  if (server) server.kill();

  console.log(
    `\n${SUITES.length - failures}/${SUITES.length} suites passed`
  );
  if (failures) {
    if (!process.env.TEST_VERBOSE) {
      console.error("\n--- API output ---");
      console.error(serverOutput.join(""));
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
