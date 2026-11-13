import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

// Realtime (task 90, D80): Server-Sent Events per account. The browser connects through the
// gateway's /rt/stream (no secret) with a token from the app (lib/social/realtime-token.ts), the app
// publishes through /publish with the secret. Events carry no content: the page asks the app
// again. No dollar sign in the code: Compose would interpolate it (the copy in compose.yml).
const SECRET = process.env.TOOLS_API_SECRET;
// The app's origins, comma-separated: production and staging share one tools server.
const APP_ORIGINS = (process.env.APP_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const PORT = Number(process.env.PORT || 8000);
const HEARTBEAT_MS = 25000;
const MAX_BODY = 16 * 1024;
// NOTIFY_BATCH in lib/social/notifications.ts.
const MAX_USERS = 500;
const MAX_EVENT = 50;
// One account's tabs; the oldest stream goes first.
const MAX_STREAMS_PER_USER = 10;
// All streams; above it a new one gets 503 and the page polls.
const MAX_STREAMS = Number(process.env.MAX_STREAMS || 2000);

if (!SECRET) {
  console.error("TOOLS_API_SECRET is required");
  process.exit(1);
}
const KEY = createHmac("sha256", SECRET)
  .update("story-app realtime token")
  .digest();

const isId = (value) =>
  typeof value === "string" && value.length === 24 && !/[^0-9a-f]/.test(value);

const sign = (payload) =>
  createHmac("sha256", KEY).update(payload).digest("base64url");

// Digests of equal length, so the comparison tells nothing of either length.
const digest = (value) => createHash("sha256").update(value).digest();
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));

// "<userId>.<exp in seconds>.<signature>" → the user and the expiry, or null.
function verify(token, now) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, signature] = parts;
  if (!isId(userId) || !exp || exp.length > 12 || /[^0-9]/.test(exp))
    return null;
  if (!equal(signature, sign(userId + "." + exp))) return null;
  const expiresAt = Number(exp) * 1000;
  return expiresAt > now ? { userId, expiresAt } : null;
}

const streams = new Map();
let total = 0;

function add(userId, response) {
  const own = streams.get(userId) ?? new Set();
  streams.set(userId, own);
  own.add(response);
  total += 1;
  if (own.size > MAX_STREAMS_PER_USER) own.values().next().value.end();
}

function remove(userId, response) {
  const own = streams.get(userId);
  if (!own || !own.delete(response)) return;
  total -= 1;
  if (own.size === 0) streams.delete(userId);
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function stream(request, response, url) {
  const origin = request.headers.origin;
  const cors = {
    "Access-Control-Allow-Origin": APP_ORIGINS.includes(origin)
      ? origin
      : APP_ORIGINS[0],
    Vary: "Origin",
  };
  const token = verify(url.searchParams.get("token"), Date.now());
  if (!token) return send(response, 401, { error: "UNAUTHORIZED" }, cors);
  if (total >= MAX_STREAMS) return send(response, 503, { error: "FULL" }, cors);
  response.writeHead(200, {
    ...cors,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.write("retry: 10000\n\n");
  add(token.userId, response);
  const heartbeat = setInterval(
    () => response.write(": ping\n\n"),
    HEARTBEAT_MS,
  );
  // The page renews the token before it expires; an expired one ends the stream.
  const expiry = setTimeout(
    () => response.end(),
    Math.min(token.expiresAt - Date.now(), 2147483647),
  );
  const close = () => {
    clearInterval(heartbeat);
    clearTimeout(expiry);
    remove(token.userId, response);
  };
  response.on("close", close);
  request.on("close", close);
}

const validEvent = (event) =>
  event !== null &&
  typeof event === "object" &&
  !Array.isArray(event) &&
  typeof event.type === "string" &&
  event.type.length > 0 &&
  event.type.length <= MAX_EVENT;

function publish(request, response) {
  const secret = request.headers["x-tools-secret"];
  if (typeof secret !== "string" || !equal(secret, SECRET))
    return send(response, 401, { error: "UNAUTHORIZED" });
  let body = "";
  let tooLarge = false;
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    if (tooLarge) return;
    body += chunk;
    if (body.length <= MAX_BODY) return;
    tooLarge = true;
    response.setHeader("Connection", "close");
    send(response, 413, { error: "TOO_LARGE" });
    request.destroy();
  });
  request.on("end", () => {
    if (tooLarge) return;
    let input;
    try {
      input = JSON.parse(body);
    } catch {}
    const userIds = input?.userIds;
    if (
      !Array.isArray(userIds) ||
      userIds.length === 0 ||
      userIds.length > MAX_USERS ||
      !userIds.every(isId) ||
      !validEvent(input.event)
    ) {
      return send(response, 400, { error: "BAD_REQUEST" });
    }
    const data = "data: " + JSON.stringify(input.event) + "\n\n";
    let delivered = 0;
    for (const userId of new Set(userIds)) {
      for (const own of streams.get(userId) ?? []) {
        // A reader that does not keep up misses events; the page's safety poll catches up.
        if (own.writableNeedDrain) continue;
        own.write(data);
        delivered += 1;
      }
    }
    send(response, 200, { delivered });
  });
}

createServer((request, response) => {
  const url = new URL(request.url, "http://realtime");
  if (request.method === "GET" && url.pathname === "/health")
    return send(response, 200, { streams: total });
  if (request.method === "GET" && url.pathname === "/stream")
    return stream(request, response, url);
  if (request.method === "POST" && url.pathname === "/publish")
    return publish(request, response);
  send(response, 404, { error: "NOT_FOUND" });
}).listen(PORT);
