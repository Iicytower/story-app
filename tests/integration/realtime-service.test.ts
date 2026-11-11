import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:net";
import { Types } from "mongoose";
import { parse as parseYaml } from "yaml";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  markConversationRead,
  sendMessage,
  startConversation,
} from "@/app/[locale]/(protected)/messages/actions";
import {
  markAllNotificationsRead,
  realtimeToken,
} from "@/app/[locale]/(protected)/notifications/actions";
import { requireUser } from "@/lib/auth/session";
import { User } from "@/lib/models/user";
import { notify } from "@/lib/social/notify";
import { publishRealtime } from "@/lib/social/realtime";
import {
  createRealtimeToken,
  REALTIME_TOKEN_TTL_MS,
} from "@/lib/social/realtime-token";
import en from "@/messages/en.json";
import { flushAfter } from "../setup/next-server";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

// Task 90: docker/tools/realtime/server.mjs as a process, without Docker or the gateway.
const SERVER = "docker/tools/realtime/server.mjs";
const SECRET = "realtime-test-secret";
const APP_ORIGIN = "http://app.test";
const STAGING_ORIGIN = "http://staging.test";
const MAX_STREAMS = 4;
let base = "";
let server: ChildProcess;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

const health = async () =>
  (await (await fetch(`${base}/health`)).json()) as { streams: number };

beforeAll(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      TOOLS_API_SECRET: SECRET,
      APP_ORIGIN: `${APP_ORIGIN}, ${STAGING_ORIGIN}`,
      MAX_STREAMS: String(MAX_STREAMS),
    },
    stdio: "ignore",
  });
  await vi.waitFor(health, { timeout: 10_000, interval: 100 });
});

afterAll(() => {
  server?.kill();
});

const userA = new Types.ObjectId().toString();
const userB = new Types.ObjectId().toString();

// The data events of a stream as they come.
async function openStream(token: string | null, origin?: string) {
  const response = await fetch(
    `${base}/stream${token === null ? "" : `?token=${encodeURIComponent(token)}`}`,
    { headers: origin ? { Origin: origin } : {} },
  );
  const events: unknown[] = [];
  let ended = false;
  const reader = response.body!.getReader();
  void (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          for (const line of buffer.slice(0, end).split("\n")) {
            if (line.startsWith("data: "))
              events.push(JSON.parse(line.slice(6)));
          }
          buffer = buffer.slice(end + 2);
        }
      }
    } catch {}
    ended = true;
  })();
  return {
    response,
    events,
    ended: () => ended,
    close: () => reader.cancel().catch(() => {}),
  };
}

const publish = (body: unknown, secret: string | null = SECRET) =>
  fetch(`${base}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret !== null && { "X-Tools-Secret": secret }),
    },
    body: JSON.stringify(body),
  });

describe("the service (1 without Docker)", () => {
  it("answers the healthcheck", async () => {
    expect(await health()).toEqual({ streams: 0 });
  });

  it("refuses /publish without the secret or with a wrong one", async () => {
    const event = { userIds: [userA], event: { type: "notification" } };
    expect((await publish(event, null)).status).toBe(401);
    expect((await publish(event, "wrong")).status).toBe(401);
    const ok = await publish(event);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ delivered: 0 });
  });

  it("refuses a malformed publication", async () => {
    expect((await publish({ userIds: [], event: { type: "x" } })).status).toBe(
      400,
    );
    expect(
      (await publish({ userIds: ["nope"], event: { type: "x" } })).status,
    ).toBe(400);
    expect((await publish({ userIds: [userA], event: "x" })).status).toBe(400);
  });

  it("cuts off a body over 16 KB", async () => {
    const response = await publish({
      userIds: [userA],
      event: { type: "x", padding: "x".repeat(20_000) },
    }).catch(() => null);
    // The connection may close before the answer is read.
    if (response) expect(response.status).toBe(413);
    expect(await health()).toEqual({ streams: 0 });
  });

  it("opens only the stream route to the browser in the gateway", () => {
    const compose = parseYaml(
      fs.readFileSync("docker/tools/compose.yml", "utf8"),
    ) as { services: { gateway: { volumes: { content?: string }[] } } };
    const caddyfile = compose.services.gateway.volumes[0].content!;
    const open = caddyfile.slice(0, caddyfile.indexOf("@authorized"));
    expect(open).toContain("handle /rt/stream {");
    expect(open).toContain("uri strip_prefix /rt");
    expect(open).toContain("flush_interval -1");
    expect(open).not.toContain("handle_path");
    expect(open).not.toContain("/publish");
    expect(caddyfile.slice(caddyfile.indexOf("handle @authorized"))).toContain(
      "handle /publish {",
    );
  });

  it("keeps compose.yml's copy equal to the file, without a dollar sign", () => {
    const code = fs.readFileSync(SERVER, "utf8");
    const compose = parseYaml(
      fs.readFileSync("docker/tools/compose.yml", "utf8"),
    ) as {
      services: { realtime: { volumes: { content?: string }[] } };
    };
    expect(compose.services.realtime.volumes[0].content).toBe(code);
    expect(code).not.toContain("$");
  });
});

describe("the stream (2)", () => {
  it("refuses no token, a wrong, a forged and an expired one", async () => {
    const { token } = createRealtimeToken(userA, SECRET);
    const [, exp, signature] = token.split(".");
    const expired = createRealtimeToken(
      userA,
      SECRET,
      Date.now() - REALTIME_TOKEN_TTL_MS - 1000,
    ).token;
    for (const bad of [
      null,
      "",
      "garbage",
      createRealtimeToken(userA, "other-secret").token,
      `${userB}.${exp}.${signature}`,
      `${userA}.${Number(exp) + 600}.${signature}`,
      expired,
    ]) {
      const stream = await openStream(bad);
      expect(stream.response.status).toBe(401);
      // The browser sees the refusal (CORS), not a network error.
      expect(stream.response.headers.get("access-control-allow-origin")).toBe(
        APP_ORIGIN,
      );
      await stream.close();
    }
  });

  it("delivers only the events of the token's user", async () => {
    const a = await openStream(createRealtimeToken(userA, SECRET).token);
    const b = await openStream(createRealtimeToken(userB, SECRET).token);
    expect(a.response.status).toBe(200);
    expect(a.response.headers.get("content-type")).toBe("text/event-stream");
    expect(a.response.headers.get("access-control-allow-origin")).toBe(
      APP_ORIGIN,
    );
    await vi.waitFor(async () =>
      expect(await health()).toEqual({ streams: 2 }),
    );

    const toA = await publish({
      userIds: [userA, userA],
      event: { type: "notification" },
    });
    expect(await toA.json()).toEqual({ delivered: 1 });
    await publish({
      userIds: [userB],
      event: { type: "message", conversationId: "c" },
    });
    await vi.waitFor(() => {
      expect(a.events).toEqual([{ type: "notification" }]);
      expect(b.events).toEqual([{ type: "message", conversationId: "c" }]);
    });

    await a.close();
    await b.close();
    await vi.waitFor(async () =>
      expect(await health()).toEqual({ streams: 0 }),
    );
  });

  it("allows each listed app origin, and only those", async () => {
    const { token } = createRealtimeToken(userA, SECRET);
    for (const [origin, allowed] of [
      [STAGING_ORIGIN, STAGING_ORIGIN],
      [APP_ORIGIN, APP_ORIGIN],
      ["http://evil.test", APP_ORIGIN],
    ]) {
      const stream = await openStream(token, origin);
      expect(stream.response.headers.get("access-control-allow-origin")).toBe(
        allowed,
      );
      await stream.close();
    }
  });

  it("refuses a stream over the global limit with 503", async () => {
    const { token } = createRealtimeToken(userA, SECRET);
    const open = await Promise.all(
      Array.from({ length: MAX_STREAMS }, () => openStream(token)),
    );
    expect(open.map(({ response }) => response.status)).toEqual(
      Array(MAX_STREAMS).fill(200),
    );
    const over = await openStream(token);
    expect(over.response.status).toBe(503);
    await over.close();
    await open[0].close();
    await vi.waitFor(async () =>
      expect(await health()).toEqual({ streams: MAX_STREAMS - 1 }),
    );
    const again = await openStream(token);
    expect(again.response.status).toBe(200);
    await Promise.all([again, ...open.slice(1)].map(({ close }) => close()));
    await vi.waitFor(async () =>
      expect(await health()).toEqual({ streams: 0 }),
    );
  });

  it("ends the stream when its token expires", async () => {
    const { token, expiresAt } = createRealtimeToken(
      userA,
      SECRET,
      Date.now() - REALTIME_TOKEN_TTL_MS + 2000,
    );
    const stream = await openStream(token);
    expect(stream.response.status).toBe(200);
    await vi.waitFor(() => expect(stream.ended()).toBe(true), {
      timeout: 4000,
      interval: 100,
    });
    expect(Date.now()).toBeGreaterThanOrEqual(expiresAt - 50);
  });
});

describe("the app publishes and issues tokens (3)", () => {
  const saved = { ...process.env };
  let dave: Types.ObjectId;
  let erin: Types.ObjectId;

  beforeAll(() => {
    process.env.TOOLS_API_URL = base;
    process.env.TOOLS_API_SECRET = SECRET;
    process.env.REALTIME_PUBLIC_URL = "https://tools.example/";
  });

  afterAll(() => {
    for (const key of [
      "TOOLS_API_URL",
      "TOOLS_API_SECRET",
      "REALTIME_PUBLIC_URL",
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const signInAs = (userId: Types.ObjectId | null) =>
    vi
      .mocked(requireUser)
      .mockResolvedValue(
        userId
          ? { ok: true, userId: userId.toString() }
          : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
      );

  async function createUser(nickname: string) {
    const { insertedId } = await User.collection.insertOne({
      nickname,
      passwordHash: "x",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    return insertedId;
  }

  async function streamOf(userId: Types.ObjectId) {
    signInAs(userId);
    const result = await realtimeToken();
    if (!result.ok) throw new Error(result.message);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    return openStream(result.token);
  }

  beforeEach(async () => {
    dave = await createUser("Dave");
    erin = await createUser("Erin");
  });

  it("gives a token only to a session", async () => {
    signInAs(null);
    expect(await realtimeToken()).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Signed out",
    });
  });

  it("tells both parties of a new message, with no content", async () => {
    const erinStream = await streamOf(erin);
    const daveStream = await streamOf(dave);
    signInAs(dave);
    const started = await startConversation("Erin", "Hello");
    if (!started.ok) throw new Error(started.message);
    await flushAfter();
    signInAs(erin);
    expect(await sendMessage(started.id, "Hi")).toEqual({ ok: true });
    await flushAfter();
    const message = { type: "message", conversationId: started.id };
    // The sender's other pages too.
    await vi.waitFor(() => {
      expect(erinStream.events).toEqual([message, message]);
      expect(daveStream.events).toEqual([message, message]);
    });
    // Erin's answer left it unread for Dave.
    signInAs(dave);
    expect(await markConversationRead(started.id)).toEqual({ ok: true });
    // Read already: nothing changes, nothing is sent.
    expect(await markConversationRead(started.id)).toEqual({ ok: true });
    await flushAfter();
    await vi.waitFor(() =>
      expect(daveStream.events).toEqual([message, message, { type: "read" }]),
    );
    expect(erinStream.events).toHaveLength(2);
    await erinStream.close();
    await daveStream.close();
  });

  it("tells the recipients of a new notification", async () => {
    const erinStream = await streamOf(erin);
    await notify(erin, { type: "follower", actorId: dave });
    // The actor is never notified, so nothing reaches anyone.
    await notify(dave, { type: "follower", actorId: dave });
    await vi.waitFor(() =>
      expect(erinStream.events).toEqual([{ type: "notification" }]),
    );
    await erinStream.close();
  });

  it("tells the account's pages when its notifications are read", async () => {
    await notify(erin, { type: "follower", actorId: dave });
    const erinStream = await streamOf(erin);
    signInAs(erin);
    expect(await markAllNotificationsRead()).toEqual({ ok: true });
    expect(await markAllNotificationsRead()).toEqual({ ok: true });
    await flushAfter();
    await vi.waitFor(() =>
      expect(erinStream.events).toEqual([{ type: "read" }]),
    );
    await erinStream.close();
  });

  it("publishes to more than 500 accounts in batches of 500", async () => {
    const erinStream = await streamOf(erin);
    const others = Array.from({ length: 1000 }, () =>
      new Types.ObjectId().toString(),
    );
    const requests = vi.spyOn(globalThis, "fetch");
    try {
      await publishRealtime([...others, erin.toString()], {
        type: "notification",
      });
      const bodies = requests.mock.calls
        .filter(([url]) => String(url).endsWith("/publish"))
        .map(
          ([, init]) =>
            (JSON.parse(String(init!.body)) as { userIds: string[] }).userIds,
        );
      expect(bodies.map((ids) => ids.length)).toEqual([500, 500, 1]);
      expect(bodies[2]).toEqual([erin.toString()]);
    } finally {
      requests.mockRestore();
    }
    await vi.waitFor(() =>
      expect(erinStream.events).toEqual([{ type: "notification" }]),
    );
    await erinStream.close();
  });

  it("neither issues tokens nor publishes without REALTIME_PUBLIC_URL (4)", async () => {
    const erinStream = await streamOf(erin);
    delete process.env.REALTIME_PUBLIC_URL;
    try {
      signInAs(erin);
      expect(await realtimeToken()).toEqual({
        ok: false,
        error: "TOOL_UNAVAILABLE",
        message: en.errors.toolUnavailable,
      });
      await notify(erin, { type: "follower", actorId: dave });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(erinStream.events).toEqual([]);
    } finally {
      process.env.REALTIME_PUBLIC_URL = "https://tools.example/";
      await erinStream.close();
    }
  });

  it("only logs a failed publication", async () => {
    process.env.TOOLS_API_URL = "http://127.0.0.1:9";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        notify(erin, { type: "follower", actorId: dave }),
      ).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(
        "Realtime publish failed",
        "notification",
        expect.anything(),
      );
    } finally {
      log.mockRestore();
      process.env.TOOLS_API_URL = base;
    }
  });
});
