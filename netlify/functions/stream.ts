/**
 * Server-sent-events (SSE) push channel.
 *
 * Emits an empty `data:` tick on a short schedule, then closes. Netlify's
 * function proxy buffers a response body until it completes, so an
 * indefinitely-open stream never flushes; instead we send a bounded burst and
 * the client (src/hooks/useLive.ts) immediately reconnects for the next one.
 * This yields near-real-time refresh through the buffering proxy, and the hook
 * falls back to classic polling if this endpoint is unavailable.
 *
 * This is a "poke" channel only — no sensitive data, so no auth required.
 * Dashboards read the /api routes, which stay the single source of truth.
 */

const TICK_MS = 3000;
const MAX_TICKS = 4;

export default async function handler(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let ticks = 0;
      let closed = false;
      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const send = () => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "tick", at: Date.now() })}\n\n`)
          );
        } catch {
          finish();
          return;
        }
        ticks += 1;
        if (ticks >= MAX_TICKS) finish();
      };

      const heartbeat = setInterval(send, TICK_MS);
      send();
    },
    cancel() {
      /* teardown handled in start() */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}