#!/usr/bin/env node
import { program } from "commander";
import { startDaemon } from "./daemon.js";
import { install, uninstall } from "./commands/install.js";
import { track } from "./commands/track.js";
import { status } from "./commands/status.js";
program
    .name("metaclaude")
    .description("Terminal-aware configuration assistant for Claude Code")
    .version("0.1.0");
program
    .command("daemon")
    .description("Start the metaclaude daemon")
    .option("-p, --port <port>", "Port to listen on", "9999")
    .action((options) => {
    startDaemon({ port: parseInt(options.port, 10) });
});
program
    .command("track [sessionId]")
    .description("Track terminal commands for a Claude Code session (auto-detects if not provided)")
    .option("-t, --terminal-id <id>", "Identifier for this terminal")
    .action((sessionId, options) => {
    track(sessionId, options.terminalId);
});
program
    .command("install")
    .description("Install metaclaude hooks into Claude Code")
    .option("--global", "Install to user config instead of project")
    .action((options) => {
    install(options.global);
});
program
    .command("uninstall")
    .description("Remove metaclaude hooks from Claude Code")
    .option("--global", "Uninstall from user config instead of project")
    .action((options) => {
    uninstall(options.global);
});
program
    .command("status")
    .description("Show metaclaude daemon status and active sessions")
    .option("-p, --port <port>", "Daemon port", "9999")
    .action((options) => {
    status(parseInt(options.port, 10));
});
program.parse();
