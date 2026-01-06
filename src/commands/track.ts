import { spawn } from "child_process";
import path from "path";
import os from "os";
import http from "http";
import fs from "fs";
import { ensureDaemonRunning } from "../daemon-client.js";

const DAEMON_HOST = "127.0.0.1";
const DAEMON_PORT = 9999;

function sendCommand(
  sessionId: string,
  command: string,
  exitCode: number | null,
  cwd: string,
  terminalId?: string
): void {
  const data = JSON.stringify({
    command,
    exitCode,
    cwd,
    terminalId,
  });

  const options = {
    hostname: DAEMON_HOST,
    port: DAEMON_PORT,
    path: `/track/${encodeURIComponent(sessionId)}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
    timeout: 1000, // 1 second timeout
  };

  const req = http.request(options);

  req.on("error", () => {
    // Silently ignore errors (daemon might not be running)
  });

  req.write(data);
  req.end();
}

function getShell(): string {
  return process.env.SHELL || "/bin/bash";
}

function generateTerminalId(): string {
  const random = Math.random().toString(36).substring(2, 6);
  return `T${random}`;
}

export async function track(sessionId?: string, terminalId?: string): Promise<void> {
  // If no session ID provided, try to read from the well-known file
  let resolvedSessionId = sessionId;
  if (!resolvedSessionId) {
    const sessionFile = path.join(os.tmpdir(), "metaclaude-session");
    if (fs.existsSync(sessionFile)) {
      const content = fs.readFileSync(sessionFile, "utf-8").trim();
      // File may contain "metaclaude start --session <id>" or just the ID
      const match = content.match(/--session\s+(\S+)/) || content.match(/metaclaude\s+\S+\s+(\S+)/);
      if (match) {
        resolvedSessionId = match[1];
      } else {
        // Maybe it's just the session ID
        resolvedSessionId = content;
      }
    }
  }

  if (!resolvedSessionId) {
    console.error("No session ID provided and no recent session found.");
    console.error("Start Claude Code first, then run: metaclaude start");
    process.exit(1);
  }

  // Ensure daemon is running (auto-start if needed)
  const daemonReady = await ensureDaemonRunning();
  if (!daemonReady) {
    console.error("Could not start metaclaude daemon. Exiting.");
    process.exit(1);
  }

  const shell = getShell();
  const shellName = path.basename(shell);
  const tId = terminalId || generateTerminalId();
  const cwd = process.cwd();

  console.log(`📡 metaclaude active`);
  console.log(`   Session: ${resolvedSessionId}`);
  console.log(`   Terminal: ${tId}`);
  console.log(`   Shell: ${shellName}`);
  console.log(``);
  console.log(`   To connect another terminal to this session:`);
  console.log(`   metaclaude start --session ${resolvedSessionId}`);
  console.log(``);
  console.log(`   Press Ctrl+D to exit\n`);

  // For bash, we use PROMPT_COMMAND to capture commands
  // For zsh, we use precmd and preexec hooks
  let rcContent: string;

  if (shellName === "zsh") {
    rcContent = `
# metaclaude tracking
_metaclaude_session="${resolvedSessionId}"
_metaclaude_terminal="${tId}"
_metaclaude_last_cmd=""

# Disable job notifications for background tasks
setopt NO_NOTIFY
setopt NO_MONITOR

_metaclaude_escape_json() {
  local str="$1"
  str=\${str//\\\\/\\\\\\\\}
  str=\${str//\\"/\\\\\\"}
  str=\${str//$'\\n'/\\\\n}
  str=\${str//$'\\r'/\\\\r}
  str=\${str//$'\\t'/\\\\t}
  echo "$str"
}

preexec() {
  _metaclaude_last_cmd="$1"
}

precmd() {
  local exit_code=$?
  if [[ -n "$_metaclaude_last_cmd" ]]; then
    local escaped_cmd=$(_metaclaude_escape_json "$_metaclaude_last_cmd")
    local escaped_cwd=$(_metaclaude_escape_json "$(pwd)")
    (curl -s -X POST "http://${DAEMON_HOST}:${DAEMON_PORT}/track/$_metaclaude_session" \\
      -H "Content-Type: application/json" \\
      -d "{\\"command\\":\\"$escaped_cmd\\",\\"exitCode\\":$exit_code,\\"cwd\\":\\"$escaped_cwd\\",\\"terminalId\\":\\"$_metaclaude_terminal\\"}" \\
      >/dev/null 2>&1 &) 2>/dev/null
    _metaclaude_last_cmd=""
  fi
}

# Update prompt to show tracking
PS1="[📡] $PS1"
`;
  } else {
    // Bash
    rcContent = `
# metaclaude tracking
_metaclaude_session="${resolvedSessionId}"
_metaclaude_terminal="${tId}"
_metaclaude_last_cmd=""

_metaclaude_escape_json() {
  local str="$1"
  str=\${str//\\\\/\\\\\\\\}
  str=\${str//\\"/\\\\\\"}
  str=\${str//$'\\n'/\\\\n}
  str=\${str//$'\\r'/\\\\r}
  str=\${str//$'\\t'/\\\\t}
  echo "$str"
}

_metaclaude_preexec() {
  _metaclaude_last_cmd="$BASH_COMMAND"
}

_metaclaude_precmd() {
  local exit_code=$?
  if [[ -n "$_metaclaude_last_cmd" && "$_metaclaude_last_cmd" != "_metaclaude_precmd" ]]; then
    local escaped_cmd=$(_metaclaude_escape_json "$_metaclaude_last_cmd")
    local escaped_cwd=$(_metaclaude_escape_json "$(pwd)")
    (curl -s -X POST "http://${DAEMON_HOST}:${DAEMON_PORT}/track/$_metaclaude_session" \\
      -H "Content-Type: application/json" \\
      -d "{\\"command\\":\\"$escaped_cmd\\",\\"exitCode\\":$exit_code,\\"cwd\\":\\"$escaped_cwd\\",\\"terminalId\\":\\"$_metaclaude_terminal\\"}" \\
      >/dev/null 2>&1 &) 2>/dev/null
    _metaclaude_last_cmd=""
  fi
}

trap '_metaclaude_preexec' DEBUG
PROMPT_COMMAND="_metaclaude_precmd; $PROMPT_COMMAND"

# Update prompt to show tracking
PS1="[📡] $PS1"
`;
  }

  // Create a temporary RC file
  const tmpRcFile = path.join(
    os.tmpdir(),
    `metaclaude-rc-${Date.now()}.${shellName}rc`
  );

  // Read existing rc file and append our content
  const homeRc = path.join(
    os.homedir(),
    shellName === "zsh" ? ".zshrc" : ".bashrc"
  );
  let existingRc = "";
  if (fs.existsSync(homeRc)) {
    existingRc = fs.readFileSync(homeRc, "utf-8");
  }

  fs.writeFileSync(tmpRcFile, existingRc + "\n" + rcContent);

  // Spawn shell with our custom RC
  const env = { ...process.env };

  let shellArgs: string[];
  if (shellName === "zsh") {
    env.ZDOTDIR = path.dirname(tmpRcFile);
    // Rename the file to .zshrc in that directory
    const zshrcPath = path.join(path.dirname(tmpRcFile), ".zshrc");
    fs.renameSync(tmpRcFile, zshrcPath);
    shellArgs = ["-i"];
  } else {
    shellArgs = ["--rcfile", tmpRcFile, "-i"];
  }

  const child = spawn(shell, shellArgs, {
    stdio: "inherit",
    env,
    cwd,
  });

  child.on("exit", (code) => {
    // Cleanup temp files
    try {
      if (shellName === "zsh") {
        const zshrcPath = path.join(path.dirname(tmpRcFile), ".zshrc");
        if (fs.existsSync(zshrcPath)) fs.unlinkSync(zshrcPath);
      } else {
        if (fs.existsSync(tmpRcFile)) fs.unlinkSync(tmpRcFile);
      }
    } catch {
      // Ignore cleanup errors
    }

    console.log(`\n📡 metaclaude tracking ended`);
    process.exit(code || 0);
  });
}
