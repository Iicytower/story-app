// Client of the tools server (D56): every tool behind the gateway goes through toolsFetch.
// Server-side only: the address and the secret never reach the browser.

export interface ToolsConfig {
  url: string;
  secret: string;
}

// The tools are off until both variables are set (D56), with no network call.
export function toolsConfig(): ToolsConfig | null {
  const url = process.env.TOOLS_API_URL?.trim();
  const secret = process.env.TOOLS_API_SECRET?.trim();
  return url && secret ? { url: url.replace(/\/+$/, ""), secret } : null;
}

export type ToolsFailure = "UNAVAILABLE" | "TIMEOUT";

export class ToolsError extends Error {
  constructor(readonly failure: ToolsFailure) {
    super(`Tools server: ${failure}`);
  }
}

// The timeout covers reading the body too. Error details (and the server's error body) stay
// here, so a result sent to the browser carries only the failure kind.
export async function toolsJson(
  config: ToolsConfig,
  path: string,
  init: { method?: string; body?: BodyInit; timeoutMs: number },
): Promise<unknown> {
  try {
    const response = await fetch(`${config.url}${path}`, {
      method: init.method ?? "GET",
      body: init.body,
      headers: { "X-Tools-Secret": config.secret },
      signal: AbortSignal.timeout(init.timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) throw new ToolsError("UNAVAILABLE");
    return await response.json();
  } catch (error) {
    if (error instanceof ToolsError) throw error;
    throw new ToolsError(
      error instanceof Error && error.name === "TimeoutError"
        ? "TIMEOUT"
        : "UNAVAILABLE",
    );
  }
}
