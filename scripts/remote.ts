// The real tools server (task 28): a VPS reached over SSH, set up by `npm run tools:remote` and
// given the dictionary databases by `npm run dict:upload:remote`. Its settings and secrets live in
// TOOLS_REMOTE_DIR (default .tools/mikrus, gitignored); docs/deploy/tools.md describes remote.env.
import { execFileSync, spawn, type StdioOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface Remote {
  dir: string;
  host: string;
  port: string;
  user: string;
  // A key of its own (the test server); otherwise ssh uses the user's keys and agent.
  key?: string;
  // The port from the pool that the tools gateway listens on.
  gatewayPort: string;
  // The gateway's public address: TOOLS_API_URL on Vercel.
  url: string;
}

const REQUIRED = ["SSH_HOST", "SSH_PORT", "GATEWAY_PORT", "TOOLS_API_URL"];

export function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*?)\r?$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export function readRemote(): Remote {
  const dir = path.resolve(process.env.TOOLS_REMOTE_DIR ?? ".tools/mikrus");
  const file = path.join(dir, "remote.env");
  const env = readEnvFile(file);
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `${file}: missing ${missing.join(", ")} (see docs/deploy/tools.md, "Serwer narzędzi na Mikrusie").`,
    );
  }
  return {
    dir,
    host: env.SSH_HOST,
    port: env.SSH_PORT,
    user: env.SSH_USER || "root",
    key: env.SSH_KEY ? path.resolve(env.SSH_KEY) : undefined,
    gatewayPort: env.GATEWAY_PORT,
    url: env.TOOLS_API_URL.replace(/\/+$/, ""),
  };
}

// Options of every ssh call: no prompts, and the server's host key remembered in the remote's
// directory on the first connection, then checked.
export function sshOptions(remote: Remote): string[] {
  return [
    "-p",
    remote.port,
    ...(remote.key ? ["-i", remote.key, "-o", "IdentitiesOnly=yes"] : []),
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    `UserKnownHostsFile=${path.join(remote.dir, "known_hosts")}`,
    "-o",
    "ServerAliveInterval=30",
  ];
}

// ssh joins its arguments into one shell command, so each one is quoted.
export const quote = (arg: string) => `'${arg.replaceAll("'", `'\\''`)}'`;

export function sshCommand(
  remote: Remote,
  args: string[],
  extra: string[] = [],
): [string, string[]] {
  return [
    "ssh",
    [
      ...sshOptions(remote),
      ...extra,
      `${remote.user}@${remote.host}`,
      args.map(quote).join(" "),
    ],
  ];
}

export function ssh(
  remote: Remote,
  args: string[],
  options: { input?: string; quiet?: boolean; inherit?: boolean } = {},
): string {
  const [command, sshArgs] = sshCommand(remote, args);
  const stdio: StdioOptions = options.inherit
    ? ["pipe", "inherit", "inherit"]
    : ["pipe", "pipe", options.quiet ? "ignore" : "inherit"];
  return (
    execFileSync(command, sshArgs, {
      input: options.input ?? "",
      encoding: "utf8",
      stdio,
      maxBuffer: 64 * 1024 * 1024,
    }) ?? ""
  );
}

// Forwards a local port to the server's loopback (the Coolify panel and API listen only there).
export async function tunnel(
  remote: Remote,
  localPort: number,
  remotePort: number,
): Promise<() => void> {
  const [command, args] = sshCommand(
    remote,
    [],
    [
      "-N",
      "-o",
      "ExitOnForwardFailure=yes",
      "-L",
      `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
    ],
  );
  // No remote command with -N: the empty quoted one is dropped.
  const child = spawn(command, args.slice(0, -1), {
    stdio: ["ignore", "ignore", "inherit"],
  });
  const close = () => {
    child.kill();
  };
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `The SSH tunnel to ${remote.host} closed (${child.exitCode}).`,
      );
    }
    const open = await fetch(`http://127.0.0.1:${localPort}/`, {
      signal: AbortSignal.timeout(2000),
    }).then(
      () => true,
      (error: Error & { cause?: { code?: string } }) =>
        // The tunnel is up even while nothing answers behind it yet.
        error.name !== "TimeoutError" && error.cause?.code !== "ECONNREFUSED",
    );
    if (open) return close;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  close();
  throw new Error(`Could not open an SSH tunnel to ${remote.host}.`);
}
