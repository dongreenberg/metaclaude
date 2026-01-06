import fs from "fs";
import path from "path";
import os from "os";

interface ClaudeSettings {
  hooks?: {
    SessionStart?: HookConfig[];
    UserPromptSubmit?: HookConfig[];
    [key: string]: HookConfig[] | undefined;
  };
  [key: string]: unknown;
}

interface HookConfig {
  matcher?: string;  // Optional - not needed for SessionStart, UserPromptSubmit
  hooks: {
    type: string;
    command: string;
  }[];
}

function getSettingsPath(global: boolean): string {
  if (global) {
    return path.join(os.homedir(), ".claude", "settings.json");
  }
  return path.join(process.cwd(), ".claude", "settings.json");
}

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readSettings(settingsPath: string): ClaudeSettings {
  if (fs.existsSync(settingsPath)) {
    const content = fs.readFileSync(settingsPath, "utf-8");
    return JSON.parse(content);
  }
  return {};
}

function writeSettings(settingsPath: string, settings: ClaudeSettings): void {
  ensureDirectoryExists(settingsPath);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

function getHooksDir(global: boolean): string {
  if (global) {
    return path.join(os.homedir(), ".claude", "hooks");
  }
  return path.join(process.cwd(), ".claude", "hooks");
}

function createHookScripts(hooksDir: string): void {
  ensureDirectoryExists(path.join(hooksDir, "placeholder"));

  // SessionStart hook script
  // Outputs to context AND shows macOS notification with session ID
  const sessionStartScript = `#!/usr/bin/env node
// metaclaude SessionStart hook
// Outputs session ID to context and shows notification

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;

    if (!sessionId) {
      process.exit(0);
    }

    // Try to start daemon in background (fire and forget, don't wait)
    try {
      const child = spawn('metaclaude', ['daemon'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
    } catch (e) {
      // Ignore spawn errors
    }

    // Register session with daemon (fire and forget)
    const req = http.request({
      hostname: '127.0.0.1',
      port: 9999,
      path: '/session/' + encodeURIComponent(sessionId),
      method: 'POST',
      timeout: 500
    });
    req.on('error', () => {});
    req.end();

    // Write session ID to well-known file for easy access
    const sessionFile = path.join(os.tmpdir(), 'metaclaude-session');
    fs.writeFileSync(sessionFile, 'metaclaude track ' + sessionId + '\\n');

    // Output to context (Claude will see this)
    console.log('📡 metaclaude active. Run "metaclaude track" in another terminal to connect.');
  } catch (e) {
    // Silently exit on errors
  }
  process.exit(0);
});
`;

  // UserPromptSubmit hook script
  const userPromptSubmitScript = `#!/usr/bin/env node
// metaclaude UserPromptSubmit hook
// Injects terminal context into Claude's view

const http = require('http');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;

    if (!sessionId) {
      process.exit(0);
    }

    // Query daemon for context
    const req = http.get({
      hostname: '127.0.0.1',
      port: 9999,
      path: '/context/' + encodeURIComponent(sessionId),
      timeout: 2000
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.context) {
            // Output plain text context for injection
            console.log(result.context);
          }
        } catch (e) {
          // Ignore parse errors
        }
        process.exit(0);
      });
    });

    req.on('error', () => process.exit(0));
    req.on('timeout', () => {
      req.destroy();
      process.exit(0);
    });
  } catch (e) {
    process.exit(0);
  }
});
`;

  fs.writeFileSync(
    path.join(hooksDir, "metaclaude-session-start.js"),
    sessionStartScript
  );
  fs.chmodSync(path.join(hooksDir, "metaclaude-session-start.js"), "755");

  fs.writeFileSync(
    path.join(hooksDir, "metaclaude-inject.js"),
    userPromptSubmitScript
  );
  fs.chmodSync(path.join(hooksDir, "metaclaude-inject.js"), "755");
}

const METACLAUDE_HOOK_MARKER = "metaclaude";

function addMetaclaudeHooks(
  settings: ClaudeSettings,
  hooksDir: string
): ClaudeSettings {
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Add SessionStart hook (no matcher needed for SessionStart)
  const sessionStartHook: HookConfig = {
    hooks: [
      {
        type: "command",
        command: path.join(hooksDir, "metaclaude-session-start.js"),
      },
    ],
  };

  // Add UserPromptSubmit hook (no matcher needed)
  const userPromptSubmitHook: HookConfig = {
    hooks: [
      {
        type: "command",
        command: path.join(hooksDir, "metaclaude-inject.js"),
      },
    ],
  };

  // Remove existing metaclaude hooks before adding
  if (settings.hooks.SessionStart) {
    settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
      (h) => !h.hooks.some((hh) => hh.command.includes(METACLAUDE_HOOK_MARKER))
    );
  }
  if (settings.hooks.UserPromptSubmit) {
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      (h) => !h.hooks.some((hh) => hh.command.includes(METACLAUDE_HOOK_MARKER))
    );
  }

  // Add new hooks
  settings.hooks.SessionStart = [
    ...(settings.hooks.SessionStart || []),
    sessionStartHook,
  ];
  settings.hooks.UserPromptSubmit = [
    ...(settings.hooks.UserPromptSubmit || []),
    userPromptSubmitHook,
  ];

  return settings;
}

function removeMetaclaudeHooks(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks) {
    return settings;
  }

  if (settings.hooks.SessionStart) {
    settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
      (h) => !h.hooks.some((hh) => hh.command.includes(METACLAUDE_HOOK_MARKER))
    );
    if (settings.hooks.SessionStart.length === 0) {
      delete settings.hooks.SessionStart;
    }
  }

  if (settings.hooks.UserPromptSubmit) {
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      (h) => !h.hooks.some((hh) => hh.command.includes(METACLAUDE_HOOK_MARKER))
    );
    if (settings.hooks.UserPromptSubmit.length === 0) {
      delete settings.hooks.UserPromptSubmit;
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  return settings;
}

export function install(global: boolean): void {
  const settingsPath = getSettingsPath(global);
  const hooksDir = getHooksDir(global);
  const scope = global ? "user" : "project";

  console.log(`Installing metaclaude hooks (${scope} scope)...`);

  // Create hook scripts
  createHookScripts(hooksDir);
  console.log(`  Created hook scripts in ${hooksDir}`);

  // Update settings
  let settings = readSettings(settingsPath);
  settings = addMetaclaudeHooks(settings, hooksDir);
  writeSettings(settingsPath, settings);
  console.log(`  Updated ${settingsPath}`);

  console.log(`
metaclaude installed successfully!

Next steps:
1. Start Claude Code:    claude
2. In another terminal:  metaclaude track
   (Auto-connects to the active Claude session)
`);
}

export function uninstall(global: boolean): void {
  const settingsPath = getSettingsPath(global);
  const hooksDir = getHooksDir(global);
  const scope = global ? "user" : "project";

  console.log(`Uninstalling metaclaude hooks (${scope} scope)...`);

  // Remove hook scripts
  const sessionStartPath = path.join(hooksDir, "metaclaude-session-start.js");
  const injectPath = path.join(hooksDir, "metaclaude-inject.js");

  if (fs.existsSync(sessionStartPath)) {
    fs.unlinkSync(sessionStartPath);
  }
  if (fs.existsSync(injectPath)) {
    fs.unlinkSync(injectPath);
  }
  console.log(`  Removed hook scripts from ${hooksDir}`);

  // Update settings
  if (fs.existsSync(settingsPath)) {
    let settings = readSettings(settingsPath);
    settings = removeMetaclaudeHooks(settings);
    writeSettings(settingsPath, settings);
    console.log(`  Updated ${settingsPath}`);
  }

  console.log(`
metaclaude uninstalled successfully!
`);
}
