/**
 * Server-sent-events (SSE) keep-alive stream.
 *
 * Emits an empty `data:` tick every few seconds so connected clients can
 * refresh their dashboard data. This is intentionally a "poke", not a data
 * channel — the /api routes stay the single source of truth, so nothing
 * sensitive is exposed here and clients still need their own auth.
 *
 * Netlify may idle-close the connection; the client reconnect logic in
 * src/hooks/useLive.ts falls back to polling until the stream reconnects.
 */

export type Handler = (req: Request, options: { path: string }) => Response | Promise<Response>;

const TICK_MS = 4000;
const MAX_OPEN_MS = 45 * 1000;

export const handler: Handler = () => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tick", at: Date.now() })}\n\n`));
        } catch {
          /* client gone */
        }
      };

      const heartbeat = setInterval(send, TICK_MS);
      const guard = setTimeout(() => {
        if (!closed && typeof controller.close === "function") {
          closed = true;
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }, MAX_OPEN_MS);

      send();

      return () => {
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(guard);
      };
    },
    cancel() {
      /* cleanup handled in start() teardown */
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
};