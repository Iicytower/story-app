// Local tools server (task 54, D56): `npm run up` starts MongoDB, Coolify and the tools server, then
// deploys the tools service through the Coolify API; `npm run down` stops everything.
// Secrets live in .tools/ (gitignored) and .env.local and are never printed.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const TOOLS_DIR = path.join(ROOT, ".tools");
const COOLIFY_ENV = path.join(TOOLS_DIR, "coolify.env");
const TOOLS_ENV = path.join(TOOLS_DIR, "tools.env");
const SSH_DIR = path.join(TOOLS_DIR, "ssh");
const SSH_KEY = path.join(SSH_DIR, "id_ed25519");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const SERVICE_COMPOSE = path.join(ROOT, "docker/tools/compose.yml");
const DEPLOYED_HASH = path.join(TOOLS_DIR, "deployed-compose.sha256");

const PANEL_URL = "http://localhost:8000";
const API_URL = "http://127.0.0.1:8000/api/v1";
const TOOLS_API_URL = "http://127.0.0.1:8110";
const ADMIN_EMAIL = "admin@story-app.localhost";
const NAME = "story-app-tools";
const TOKEN_NAME = "story-app-tools-script";

type Env = Record<string, string>;

function compose(
  args: string[],
  options: { input?: string; env?: Env; quiet?: boolean } = {},
) {
  return execFileSync("docker", ["compose", "--profile", "tools", ...args], {
    cwd: ROOT,
    input: options.input,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: ["pipe", "pipe", options.quiet ? "ignore" : "inherit"],
  });
}

function readEnvFile(file: string): Env {
  if (!fs.existsSync(file)) return {};
  const env: Env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function writeSecretFile(file: string, content: string) {
  fs.writeFileSync(file, content, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function hex(bytes: number) {
  return randomBytes(bytes).toString("hex");
}

// Values from the first run stay: Coolify must not get new APP_KEY or database passwords later.
function ensureSecrets() {
  fs.mkdirSync(TOOLS_DIR, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(COOLIFY_ENV)) {
    const dbPassword = hex(32);
    const env: Env = {
      APP_ID: hex(16),
      APP_NAME: "Coolify",
      APP_KEY: `base64:${randomBytes(32).toString("base64")}`,
      DB_USERNAME: "coolify",
      DB_PASSWORD: dbPassword,
      POSTGRES_USER: "coolify",
      POSTGRES_PASSWORD: dbPassword,
      POSTGRES_DB: "coolify",
      REDIS_PASSWORD: hex(32),
      PUSHER_APP_ID: hex(16),
      PUSHER_APP_KEY: hex(16),
      PUSHER_APP_SECRET: hex(16),
    };
    writeSecretFile(COOLIFY_ENV, toEnvFile(env));
  }
  if (!fs.existsSync(TOOLS_ENV)) {
    const env: Env = {
      ADMIN_EMAIL,
      // Coolify requires upper and lower case letters, digits and a symbol.
      ADMIN_PASSWORD: `Aa1!${hex(16)}`,
      TOOLS_API_SECRET: hex(32),
    };
    writeSecretFile(TOOLS_ENV, toEnvFile(env));
  }
  return readEnvFile(TOOLS_ENV);
}

function toEnvFile(env: Env) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}\n`)
    .join("");
}

function ensureSshKey() {
  if (fs.existsSync(SSH_KEY)) return;
  fs.mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 });
  // ssh-keygen from the tools server image, so the host needs nothing but Docker.
  compose(["build", "tools-server"]);
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      "-v",
      `${SSH_DIR}:/keys`,
      "story_app-tools-server",
      "-c",
      // ssh-keygen needs a passwd entry, so it runs as root and hands the files to the host user.
      `ssh-keygen -q -t ed25519 -N '' -C coolify@story-app -f /keys/id_ed25519 && chown ${process.getuid!()}:${process.getgid!()} /keys/id_ed25519 /keys/id_ed25519.pub`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

// Coolify's own root user seeder validates the e-mail against DNS and the password against
// HaveIBeenPwned, so the account, the API switch and the token are set up directly instead.
function createApiToken(tools: Env) {
  const php = `
    $user = App\\Models\\User::find(0);
    if (! $user) {
      $user = (new App\\Models\\User)->forceFill([
        'id' => 0,
        'name' => 'Admin',
        'email' => getenv('ADMIN_EMAIL'),
        'password' => Illuminate\\Support\\Facades\\Hash::make(getenv('ADMIN_PASSWORD')),
        'email_verified_at' => now(),
      ]);
      $user->save();
    }
    if (! $user->teams()->where('team_id', 0)->exists()) {
      $user->teams()->attach(0, ['role' => 'owner']);
    }
    App\\Models\\InstanceSettings::get()->update(['is_api_enabled' => true, 'is_registration_enabled' => false]);
    $user->tokens()->where('name', '${TOKEN_NAME}')->delete();
    echo 'TOKEN=' . $user->createToken('${TOKEN_NAME}', ['root'], null, 0)->plainTextToken . PHP_EOL;
  `;
  const output = compose(
    [
      "exec",
      "-T",
      "-e",
      "ADMIN_EMAIL",
      "-e",
      "ADMIN_PASSWORD",
      "coolify",
      "php",
      "artisan",
      "tinker",
      "--execute",
      php,
    ],
    {
      env: {
        ADMIN_EMAIL: tools.ADMIN_EMAIL,
        ADMIN_PASSWORD: tools.ADMIN_PASSWORD,
      },
    },
  );
  const token = /^TOKEN=(.+)$/m.exec(output)?.[1];
  if (!token) throw new Error("Could not create a Coolify API token.");
  return token;
}

function api(token: string) {
  return async function request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      // Response bodies can echo secrets (e.g. service envs), so only the status is reported.
      throw new Error(
        `Coolify API ${method} ${endpoint}: HTTP ${response.status}`,
      );
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  };
}

type Named = { uuid: string; name: string };

async function poll<T>(
  description: string,
  check: () => Promise<T | undefined>,
  timeoutMs: number,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await check().catch(() => undefined);
    if (result !== undefined) return result;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function healthStatus(secret: string) {
  const response = await fetch(`${TOOLS_API_URL}/health`, {
    headers: { "X-Tools-Secret": secret },
  });
  return response.status;
}

// The first Polish check after a start takes about a minute on one CPU; this one makes it
// before the app does (the container healthcheck does the same after unplanned restarts).
async function languageToolStatus(secret: string) {
  const response = await fetch(`${TOOLS_API_URL}/lt/v2/check`, {
    method: "POST",
    headers: { "X-Tools-Secret": secret },
    body: new URLSearchParams({ language: "pl-PL", text: "Ala ma kota." }),
    // poll checks its deadline only between attempts.
    signal: AbortSignal.timeout(90_000),
  });
  return response.status;
}

type Request = ReturnType<typeof api>;

// `content:` files of the compose file, by mount target.
function contentFiles(composeContent: string): Map<string, string> {
  const compose = parseYaml(composeContent) as {
    services: Record<string, { volumes?: (string | { target?: string; content?: string })[] }>;
  };
  const files = new Map<string, string>();
  for (const { volumes = [] } of Object.values(compose.services)) {
    for (const volume of volumes) {
      if (typeof volume === "object" && volume.target && volume.content) {
        files.set(volume.target, volume.content);
      }
    }
  }
  return files;
}

// Coolify writes a `content:` file only when it is missing on the server and keeps the old
// content when the compose file changes, so changed content goes through the storages API.
// Coolify then writes the file in a queued job; the restart must wait for it.
async function syncContentFiles(
  request: Request,
  serviceUuid: string,
  composeContent: string,
): Promise<boolean> {
  const wanted = contentFiles(composeContent);
  const { file_storages: storages } = await request<{
    file_storages: {
      uuid: string;
      mount_path: string;
      fs_path: string;
      content: string | null;
    }[];
  }>("GET", `/services/${serviceUuid}/storages`);
  let changed = false;
  for (const storage of storages) {
    const content = wanted.get(storage.mount_path);
    // Coolify stores the content without the final newline of a YAML `|` block.
    const same = (written: string | null) =>
      written?.trimEnd() === content?.trimEnd();
    if (content === undefined || same(storage.content)) continue;
    await request("PATCH", `/services/${serviceUuid}/storages`, {
      uuid: storage.uuid,
      type: "file",
      content,
    });
    console.log(`Waiting for Coolify to write ${storage.mount_path}…`);
    await poll(
      `${storage.mount_path} on the tools server`,
      async () =>
        same(
          compose(["exec", "-T", "tools-server", "cat", storage.fs_path], {
            quiet: true,
          }),
        )
          ? true
          : undefined,
      2 * 60_000,
    );
    changed = true;
  }
  return changed;
}

async function deploy(token: string, secret: string) {
  const request = api(token);

  const keys = await request<Named[]>("GET", "/security/keys");
  const key =
    keys.find((k) => k.name === NAME) ??
    (await request<Named>("POST", "/security/keys", {
      name: NAME,
      description: "SSH key for the local tools server (task 54).",
      private_key: fs.readFileSync(SSH_KEY, "utf8"),
    }));

  const servers = await request<Named[]>("GET", "/servers");
  const server =
    servers.find((s) => s.name === NAME) ??
    (await request<Named>("POST", "/servers", {
      name: NAME,
      description: "Local tools server in Docker (task 54).",
      ip: "tools-server",
      port: 22,
      user: "root",
      private_key_uuid: key.uuid,
      proxy_type: "none",
      instant_validate: true,
    }));
  console.log("Waiting for Coolify to validate the tools server…");
  const validated = await poll(
    "server validation",
    async () => {
      const details = await request<{
        is_validating: boolean;
        validation_logs: string | null;
        settings: { is_reachable: boolean; is_usable: boolean };
      }>("GET", `/servers/${server.uuid}`);
      if (details.validation_logs) return details;
      return details.settings.is_reachable &&
        details.settings.is_usable &&
        !details.is_validating
        ? details
        : undefined;
    },
    5 * 60_000,
  );
  // Coolify keeps the last validation error until the server is validated again.
  if (validated.validation_logs) {
    throw new Error(
      `Coolify could not validate the tools server (fix it, then use Validate in the Coolify panel): ${validated.validation_logs.replace(/<[^>]+>/g, " ")}`,
    );
  }

  const projects = await request<Named[]>("GET", "/projects");
  const project =
    projects.find((p) => p.name === NAME) ??
    (await request<Named>("POST", "/projects", {
      name: NAME,
      description: "Tools for Story App (task 54).",
    }));

  const composeContent = fs.readFileSync(SERVICE_COMPOSE, "utf8");
  const composeRaw = Buffer.from(composeContent).toString("base64");
  const composeHash = createHash("sha256").update(composeContent).digest("hex");
  // Coolify only applies a changed compose file on restart.
  const composeChanged =
    !fs.existsSync(DEPLOYED_HASH) ||
    fs.readFileSync(DEPLOYED_HASH, "utf8") !== composeHash;
  const services = await request<Named[]>("GET", "/services");
  let service = services.find((s) => s.name === NAME);
  if (service) {
    await request("PATCH", `/services/${service.uuid}`, {
      docker_compose_raw: composeRaw,
    });
  } else {
    service = await request<Named>("POST", "/services", {
      name: NAME,
      description: "Tools gateway and services (task 54).",
      project_uuid: project.uuid,
      environment_name: "production",
      server_uuid: server.uuid,
      docker_compose_raw: composeRaw,
      instant_deploy: false,
    });
  }

  const filesChanged = await syncContentFiles(
    request,
    service.uuid,
    composeContent,
  );

  const envs = await request<{ key: string; value: string }[]>(
    "GET",
    `/services/${service.uuid}/envs`,
  );
  const current = envs.find((e) => e.key === "TOOLS_API_SECRET");
  const secretChanged = current?.value !== secret;
  if (secretChanged) {
    await request(
      current ? "PATCH" : "POST",
      `/services/${service.uuid}/envs`,
      { key: "TOOLS_API_SECRET", value: secret },
    );
  }

  if (
    (await healthStatus(secret).catch(() => 0)) !== 200 ||
    secretChanged ||
    composeChanged ||
    filesChanged
  ) {
    const requestedAt = Date.now();
    await request("POST", `/services/${service.uuid}/restart`);
    // The restart is queued and the old gateway keeps answering /health until it is replaced.
    console.log("Waiting for Coolify to restart the tools service…");
    await poll(
      "the tools service restart",
      async () => {
        const startedAt = compose(
          [
            "exec",
            "-T",
            "tools-server",
            "docker",
            "inspect",
            "--format",
            "{{.State.Running}} {{.State.StartedAt}}",
            `gateway-${service.uuid}`,
          ],
          // The container is missing for a moment while Coolify recreates it.
          { quiet: true },
        ).trim();
        const [running, time] = startedAt.split(" ");
        return running === "true" && Date.parse(time) >= requestedAt
          ? true
          : undefined;
      },
      // The first deploy pulls LanguageTool (about 0.75 GB) before starting anything.
      15 * 60_000,
    );
  }
  return composeHash;
}

function updateEnvLocal(secret: string) {
  const values: Env = {
    TOOLS_API_URL,
    TOOLS_API_SECRET: secret,
  };
  const lines = fs.existsSync(ENV_LOCAL)
    ? fs.readFileSync(ENV_LOCAL, "utf8").replace(/\n$/, "").split("\n")
    : [];
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index === -1) lines.push(`${key}=${value}`);
    else lines[index] = `${key}=${value}`;
  }
  fs.writeFileSync(ENV_LOCAL, `${lines.join("\n")}\n`);
}

async function up() {
  const tools = ensureSecrets();
  ensureSshKey();
  console.log("Starting MongoDB, Coolify and the tools server…");
  compose(["up", "-d", "--build", "--wait"]);
  const token = createApiToken(tools);
  const composeHash = await deploy(token, tools.TOOLS_API_SECRET);
  console.log("Waiting for the tools gateway…");
  await poll(
    "the tools gateway /health",
    async () =>
      (await healthStatus(tools.TOOLS_API_SECRET)) === 200 ? true : undefined,
    5 * 60_000,
  );
  console.log("Waiting for LanguageTool…");
  await poll(
    "LanguageTool",
    async () =>
      (await languageToolStatus(tools.TOOLS_API_SECRET)) === 200
        ? true
        : undefined,
    10 * 60_000,
  );
  fs.writeFileSync(DEPLOYED_HASH, composeHash);
  updateEnvLocal(tools.TOOLS_API_SECRET);
  console.log(
    [
      "Ready.",
      `  Coolify panel: ${PANEL_URL} (login ${tools.ADMIN_EMAIL}, password in .tools/tools.env)`,
      `  Tools gateway: ${TOOLS_API_URL} (TOOLS_API_URL and TOOLS_API_SECRET written to .env.local)`,
      `  LanguageTool: ${TOOLS_API_URL}/lt/v2/check`,
    ].join("\n"),
  );
}

function down() {
  compose(["down"]);
}

const command = process.argv[2];
if (command === "up") {
  up().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else if (command === "down") {
  down();
} else {
  console.error("Usage: tsx scripts/tools.ts up|down");
  process.exitCode = 1;
}
