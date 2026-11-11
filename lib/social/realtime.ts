import { after } from "next/server";
import { NOTIFY_BATCH } from "@/lib/social/notifications";
import { toolsConfig } from "@/lib/tools/client";

// D80, task 90. Server-side only.
// "read": the account read something elsewhere, so its other pages ask for the counters.
export type RealtimeEvent =
  | { type: "notification" }
  | { type: "read" }
  | { type: "message"; conversationId: string };

const PUBLISH_TIMEOUT_MS = 3000;

// The public address of the tools gateway the browser connects to, or null: then the page only
// polls. Without the tools server nothing would publish, so the address counts only with it.
export function realtimeUrl(): string | null {
  const value = process.env.REALTIME_PUBLIC_URL?.trim();
  if (!value || !toolsConfig()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

// Called after the response (in after()); a failure only goes to the log. One request per
// NOTIFY_BATCH accounts, the service's limit.
export async function publishRealtime(
  userIds: string[],
  event: RealtimeEvent,
): Promise<void> {
  const config = toolsConfig();
  if (!config || !realtimeUrl()) return;
  const ids = [...new Set(userIds)];
  for (let i = 0; i < ids.length; i += NOTIFY_BATCH) {
    await publishBatch(config, ids.slice(i, i + NOTIFY_BATCH), event);
  }
}

async function publishBatch(
  config: { url: string; secret: string },
  userIds: string[],
  event: RealtimeEvent,
): Promise<void> {
  try {
    const response = await fetch(`${config.url}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tools-Secret": config.secret,
      },
      body: JSON.stringify({ userIds, event }),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Realtime publish failed", event.type, response.status);
    }
  } catch (error) {
    console.error("Realtime publish failed", event.type, error);
  }
}

// The account's other pages update their counters (task 90).
export function publishRead(userId: string): void {
  after(() => publishRealtime([userId], { type: "read" }));
}
