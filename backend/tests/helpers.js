/**
 * Shared helpers for the MediQueue API end-to-end tests.
 *
 * The suite runs against BASE_URL. `npm test` starts a temporary backend with
 * USE_MEMORY_DB=true and points BASE_URL at it, so no real database is touched.
 */

const BASE_URL = (
  process.env.BASE_URL ||
  process.env.TEST_BASE_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

function makeClient(base = BASE_URL) {
  const jar = new Map();

  function cookieHeader() {
    return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async function req(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const cookie = cookieHeader();
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(`${base}${path}`, {
      ...options,
      headers,
      redirect: "manual",
    });

    for (const entry of response.headers.getSetCookie?.() || []) {
      const [pair, ...attributes] = entry.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const expired = attributes.some((attribute) =>
        /max-age=0|expires=thu, 01 jan 1970/i.test(attribute.trim())
      );
      if (!name) continue;
      if (expired || value === "") jar.delete(name);
      else jar.set(name, value);
    }

    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return { status: response.status, body, headers: response.headers };
  }

  return { req, cookieHeader };
}

function makeChecker() {
  const results = [];

  function check(name, ok, detail = "") {
    results.push({ name, ok: Boolean(ok) });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  }

  function finish() {
    const failed = results.filter((result) => !result.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) process.exitCode = 1;
  }

  return { results, check, finish };
}

/**
 * Log in first, then make sure the next chat session starts from a clean slate.
 * Chat sessions are reused for 12 hours, so without this a previous test (or a
 * previous run) could leave the conversation mid-flow.
 */
async function startFreshSession(client) {
  const existing = await client.req("/api/chat/session", {
    method: "POST",
    body: "{}",
  });
  const conversationId = existing.body?.conversation?.id;
  if (conversationId) {
    await client.req(`/api/chat/${conversationId}`, { method: "DELETE" });
  }

  return client.req("/api/chat/session", { method: "POST", body: "{}" });
}

async function giveConsent(client, conversationId) {
  return client.req(`/api/chat/${conversationId}/consent`, {
    method: "POST",
    body: JSON.stringify({ version: "2026-01" }),
  });
}

module.exports = {
  BASE_URL,
  makeClient,
  makeChecker,
  startFreshSession,
  giveConsent,
};
