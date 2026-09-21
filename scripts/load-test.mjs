/**
 * Minimal concurrency load test for the Netlify function API.
 *
 *   BASE=${FUNCTION_URL} CONCURRENT=32 TOTAL=400 SCENARIO=dashboard node scripts/load-test.mjs
 *
 * SCENARIOS:
 *   health    - GET /api/health (public, no auth)
 *   login     - POST /api/auth/login (exercises auth + DB write)
 *   dashboard - GET /api/student/dashboard (authenticated read-heavy)
 *   stream    - authenticated SSE: open /api/stream?channel=loadtest, collect 2 ticks, close
 */
const BASE = process.env.BASE || "https://freshcodeeuphoriaatkare.netlify.app/.netlify/functions/api";
const CONCURRENT = Number(process.env.CONCURRENT || 20);
const TOTAL = Number(process.env.TOTAL || 200);
const SCENARIO = process.env.SCENARIO || "health";
const USER = process.env.USERNAME || "ST2026001";
const PASS = process.env.PASSWORD || "student@2026";

let token = "";
const durations = [];
let errors = 0;

async function call(path, options = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(BASE + path, { ...options, signal: ctrl.signal });
    const text = await res.text();
    const duration = Date.now() - started;
    durations.push(duration);
    if (!res.ok) errors += 1;
    return { res, text, duration };
  } catch (error) {
    errors += 1;
    durations.push(Date.now() - started);
    return { res: null, text: "", duration: Date.now() - started, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  for (let i = 0; i < CONCURRENT && i < 3; i++) {
    const r = await call("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: USER, password: PASS }),
    });
    try {
      const body = JSON.parse(r.text);
      token = body?.session_token || body?.token || token;
      if (token) break;
    } catch {
      /* non-JSON response */
    }
  }
  if (!token) {
    console.log(`[load-test] login failed (${errors} errors so far) — continuing with health only.`);
  }

  const authHeaders = token ? { authorization: `Bearer ${token}` } : {};
  const scenario = async () => {
    if (SCENARIO === "login") {
      await call("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
body: JSON.stringify({ userId: USER, password: PASS }),
      });
    } else if (SCENARIO === "dashboard") {
      if (!token) return;
      await call("/student/dashboard", { headers: authHeaders });
    } else if (SCENARIO === "stream") {
      if (!token) return;
      const ctrl = new AbortController();
      const started = Date.now();
      try {
        const res = await fetch(BASE + "/stream?channel=loadtest", { headers: authHeaders, signal: ctrl.signal });
        if (res && res.body) {
          const reader = res.body.getReader();
          let ticks = 0;
          const decoder = new TextDecoder();
          while (ticks < 2) {
            const { done, value } = await reader.read();
            if (done) break;
            if (decoder.decode(value).includes("\"type\":\"tick\"")) ticks += 1;
          }
          reader.cancel().catch(() => {});
        }
      } catch {
        errors += 1;
      }
      durations.push(Date.now() - started);
    } else {
      await call("/health");
    }
  };

  const startedAll = Date.now();
  const workers = [];
  for (let w = 0; w < CONCURRENT; w++) {
    workers.push(
      (async () => {
        const jobs = Math.ceil((TOTAL - (w < TOTAL % CONCURRENT ? 0 : TOTAL % CONCURRENT)) / CONCURRENT);
        for (let j = 0; j < jobs + (w < TOTAL % CONCURRENT ? 1 : 0); j++) await scenario();
      })()
    );
  }
  await Promise.all(workers);
  const wallMs = Date.now() - startedAll;

  const sorted = [...durations].sort((a, b) => a - b);
  const p = (q) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((q / 100) * sorted.length)));
    return sorted[idx] ?? 0;
  };
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  console.log(
    `[load-test] scenario=${SCENARIO} total=${durations.length} concurrent=${CONCURRENT} wall=${wallMs}ms ` +
      `rps=${(durations.length / (wallMs / 1000)).toFixed(1)} ` +
      `avg=${avg.toFixed(0)}ms p50=${p(50)}ms p95=${p(95)}ms p99=${p(99)}ms errors=${errors}`
  );
  process.exit(errors > 0 && errors >= TOTAL ? 1 : 0);
}

run().catch((error) => {
  console.error("[load-test] fatal:", error);
  process.exit(1);
});