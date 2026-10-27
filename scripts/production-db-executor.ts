import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SNIPPETS_DIR = path.resolve(process.cwd(), "scripts/drizzle-snippets");

// Human-friendly descriptions for known snippets
const SNIPPET_DESCRIPTIONS: Record<string, string> = {
  "list-messages.ts": "📩 消息列表（支持 20 分页、按用户/邮箱过滤、JSON 导出）",
  "stats.ts": "📊 数据库全表统计概览（用户、消息、会话、绑定数）",
};

function getEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const envFile = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, "utf-8");
    const match = content.match(new RegExp(`^(?:${name})=(.*)$`, "m"));
    if (match) {
      return match[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return undefined;
}

function getAvailableSnippets(): string[] {
  if (!fs.existsSync(SNIPPETS_DIR)) {
    return [];
  }
  return fs.readdirSync(SNIPPETS_DIR).filter((f) => f.endsWith(".ts"));
}

function chooseSnippetWithGum(snippets: string[]): string {
  if (snippets.length === 0) {
    console.error(`❌ No snippets found in ${SNIPPETS_DIR}`);
    process.exit(1);
  }

  // Format with descriptions
  const options = snippets.map((file) => {
    const desc = SNIPPET_DESCRIPTIONS[file];
    return desc ? `${file.padEnd(18)}  -  ${desc}` : file;
  });

  const proc = spawnSync(
    "gum",
    [
      "choose",
      "--header=Select a Drizzle snippet to run on production:",
      "--cursor=> ",
      ...options,
    ],
    {
      stdio: ["inherit", "pipe", "inherit"],
      encoding: "utf-8",
    }
  );

  if (proc.status !== 0 || !proc.stdout) {
    console.log("\nSelection canceled.");
    process.exit(0);
  }

  const chosenLine = proc.stdout.trim();
  const selectedFilename = chosenLine.split(" ")[0].trim();
  return selectedFilename;
}

const DEFAULT_REMOTE_HOST = "hz";

const args = process.argv.slice(2);
let remoteHost = getEnvVar("REMOTE_HOST") || getEnvVar("SSH_HOST") || DEFAULT_REMOTE_HOST;
let containerName = getEnvVar("REMOTE_CONTAINER") || getEnvVar("DOCKER_CONTAINER");
let targetSnippet: string | undefined;
const snippetArgs: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--host" && args[i + 1]) {
    remoteHost = args[++i];
  } else if (arg === "--container" && args[i + 1]) {
    containerName = args[++i];
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
WeBot Production DB Executor

Usage:
  bun run production:sql [snippet-name] [options] [-- snippet-options]

Options:
  --host <ssh-host>       Remote SSH host (default: 'hz', or via REMOTE_HOST in .env)
  --container <name>      Docker container name (default: auto-detected 'webot')
  -h, --help              Show this help message

Examples:
  # Interactively choose a snippet via gum and execute on hz:
  bun run production:sql

  # Run specific snippet with pagination args:
  bun run production:sql list-messages.ts --limit 20 --page 2

  # Filter messages by user:
  bun run production:sql list-messages.ts --user someone@example.com
    `.trim());
    process.exit(0);
  } else {
    // Check if arg corresponds to an existing snippet filename
    const candidateFile = arg.endsWith(".ts") ? arg : `${arg}.ts`;
    const fullPath = path.resolve(SNIPPETS_DIR, candidateFile);
    if (!targetSnippet && (fs.existsSync(fullPath) || fs.existsSync(path.resolve(process.cwd(), arg)))) {
      targetSnippet = candidateFile;
    } else {
      snippetArgs.push(arg);
    }
  }
}

// If no snippet specified, interactively select via gum
if (!targetSnippet) {
  const available = getAvailableSnippets();
  targetSnippet = chooseSnippetWithGum(available);
}

const snippetPath = path.resolve(SNIPPETS_DIR, targetSnippet);
if (!fs.existsSync(snippetPath)) {
  console.error(`❌ Error: Snippet file not found: ${snippetPath}`);
  process.exit(1);
}

if (!remoteHost) {
  console.error("❌ Error: REMOTE_HOST is not specified.");
  console.error("Provide it via --host <user@ip> or export REMOTE_HOST=<user@ip> in .env / terminal.");
  process.exit(1);
}

async function resolveContainer(host: string): Promise<string> {
  if (containerName) return containerName;
  console.log(`🔍 Detecting Docker container matching 'webot' on ${host}...`);

  return new Promise((resolve, reject) => {
    const proc = spawn("ssh", [
      host,
      "docker ps --filter 'name=webot' --format '{{.Names}}' | head -n 1",
    ]);
    let stdout = "";
    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.on("close", (code) => {
      const detected = stdout.trim();
      if (code === 0 && detected) {
        console.log(`📦 Target container: ${detected}`);
        resolve(detected);
      } else {
        reject(
          new Error(
            `Could not auto-detect container with name 'webot' on ${host}. Specify via --container <name>`
          )
        );
      }
    });
  });
}

async function run() {
  const container = await resolveContainer(remoteHost!);
  const rawContent = fs.readFileSync(snippetPath, "utf-8");

  // Transform alias `@/` -> `./src/` because the production Docker image does not contain tsconfig.json
  const snippetContent = rawContent.replace(/(from\s+["'])@\//g, '$1./src/');

  console.log(`🚀 Executing ${path.basename(snippetPath)} on ${remoteHost} (${container})...`);
  if (snippetArgs.length > 0) {
    console.log(`🔧 Snippet args: ${snippetArgs.join(" ")}`);
  }
  console.log("--------------------------------------------------------------------------------");

  // Construct remote docker command
  const remoteCmd = `docker exec -i ${container} bun run - -- ${snippetArgs.join(" ")}`;

  const child = spawn("ssh", ["-T", remoteHost!, remoteCmd], {
    stdio: ["pipe", "inherit", "inherit"],
  });

  child.stdin.write(snippetContent);
  child.stdin.end();

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

run().catch((err) => {
  console.error(`❌ Execution failed:`, err.message);
  process.exit(1);
});
