# metaclaude Design

## Overview

metaclaude is a hook-based extension for Claude Code that:
1. Tracks terminal commands from user's shells
2. Injects that context into Claude Code sessions
3. Enables Claude to suggest configuration improvements based on user behavior

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User's Environment                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐         ┌──────────────────────────────────┐ │
│  │ Claude Code      │         │ User's Terminal(s)               │ │
│  │ Session abc123   │         │                                  │ │
│  │                  │         │  $ metaclaude track abc123       │ │
│  │ [SessionStart]───┼────┐    │  $ npm test                      │ │
│  │    outputs ID    │    │    │  $ git diff                      │ │
│  │                  │    │    │                                  │ │
│  │ [UserPromptSubmit]◄───┼────┼──────────────────────────┐       │ │
│  │    injects ctx   │    │    └──────────────────────────┼───────┘ │
│  └──────────────────┘    │                               │         │
│                          │                               │         │
│                          ▼                               │         │
│  ┌───────────────────────────────────────────────────────┴───────┐ │
│  │                    metaclaude daemon                          │ │
│  │                    localhost:9999                             │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │ Sessions:                                               │  │ │
│  │  │   abc123 → [{cmd: "npm test", exit: 1, ts: ...}, ...]  │  │ │
│  │  │   xyz789 → [{cmd: "docker build", exit: 0, ts: ...}]   │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                                                               │ │
│  │  Endpoints:                                                   │ │
│  │    POST /track/:session_id  ← receives commands               │ │
│  │    GET  /context/:session_id → returns injected context       │ │
│  │    POST /clear/:session_id  ← clears command buffer           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. metaclaude daemon (`src/daemon.ts`)

A lightweight HTTP server that:
- Tracks commands per session ID
- Generates context for injection
- Manages session lifecycle

Runs on `localhost:9999` by default.

### 2. SessionStart hook

Outputs the session ID and connection instructions when a Claude Code session starts:
```
📡 metaclaude active. Connect terminals with:
   metaclaude track <session_id>
```

### 3. UserPromptSubmit hook

Queries the daemon for context and outputs it for injection into Claude's context.

### 4. `metaclaude track <session_id>` command

Wraps the user's shell, intercepting commands and sending them to the daemon.
Uses shell's DEBUG trap (bash) or preexec (zsh) to capture commands.

### 5. `metaclaude install` command

Sets up:
- Hooks in `~/.claude/settings.json`
- Daemon autostart (launchd on macOS, systemd on Linux)

## Injected Context Template

The UserPromptSubmit hook injects context in this format:

```
[metaclaude terminal context]

Connected terminals: 2
Recent commands (most recent first):
  • npm test (exit 1) @ 14:32:05
  • npm test (exit 1) @ 14:31:42
  • git diff @ 14:31:30
  • vim src/api.ts @ 14:30:15

---

Based on the user's terminal activity and conversation context, consider suggesting
configuration improvements. Available options (suggest as runnable commands):

MEMORY & INSTRUCTIONS:
  • # <instruction> — Quick-add to project memory (type at prompt start)
  • /memory — Open memory files in editor
  • Add to ~/.claude/CLAUDE.md — Global instructions for all projects
  • Add to ./CLAUDE.md — Project-specific instructions

AUTOMATION (Hooks):
  • /hooks — Configure hooks interactively
  • Add to settings.json hooks.PostToolUse — Run scripts after Claude uses tools
  • Add to settings.json hooks.PreToolUse — Validate/modify tool inputs

PERMISSIONS:
  • /permissions — Manage tool permissions
  • permissions.allow in settings: ["Bash(npm test:*)"] — Auto-allow specific commands
  • permissions.deny in settings: ["Read(.env)"] — Block specific actions

CUSTOM COMMANDS:
  • Create .claude/commands/<name>.md — Reusable slash commands
  • /plugin — Install community plugins with pre-built commands

SKILLS:
  • Create .claude/skills/<name>/SKILL.md — Teach Claude specialized capabilities

SUBAGENTS:
  • /agents — Manage specialized AI assistants
  • Create .claude/agents/<name>.md — Custom agents for specific tasks

MCP SERVERS (External Tools):
  • claude mcp add --transport http <name> <url> — Add external API tools
  • /mcp — Manage MCP server connections

OTHER:
  • /output-style — Change Claude's communication style
  • /sandbox — Enable filesystem/network isolation
  • /config — Open settings UI

When suggesting, provide the exact command or content. For example:
  - "Run: # Always run tests before committing"
  - "Run: /hooks then add a PostToolUse hook for Bash that runs 'npm test'"
  - "Add to ./CLAUDE.md:\n```\n## Testing\nAlways run `npm test` after editing source files.\n```"

Only suggest when there's a clear pattern or benefit. Do not mention metaclaude explicitly.
```

## File Structure

```
metaclaude/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # CLI entry point
│   ├── daemon.ts         # HTTP server for tracking
│   ├── commands/
│   │   ├── install.ts    # Sets up hooks
│   │   ├── track.ts      # Shell wrapper
│   │   ├── start.ts      # Start daemon
│   │   └── status.ts     # Show daemon status
│   ├── hooks/
│   │   ├── session-start.sh
│   │   └── user-prompt-submit.sh
│   └── context.ts        # Context generation logic
├── hooks/                # Installed hook scripts
│   ├── metaclaude-session-start.sh
│   └── metaclaude-inject.sh
└── README.md
```

## Session ID

Claude Code provides session_id in hook input JSON. The SessionStart hook:
1. Receives session_id from Claude Code
2. Registers session with metaclaude daemon
3. Outputs connection instructions to user

## Command Tracking Protocol

When `metaclaude track <session_id>` wraps a shell:

1. Sets up preexec/DEBUG trap
2. On each command:
   ```
   POST http://localhost:9999/track/<session_id>
   {
     "command": "npm test",
     "exit_code": 1,
     "timestamp": "2024-01-15T14:32:05Z",
     "cwd": "/Users/donny/project"
   }
   ```

## Context Injection Flow

1. User submits prompt in Claude Code
2. UserPromptSubmit hook fires
3. Hook reads session_id from stdin JSON
4. Hook calls `GET http://localhost:9999/context/<session_id>`
5. Daemon returns formatted context string
6. Hook outputs context to stdout (exit 0)
7. Claude sees context prepended to user's message

## Configuration

Default config stored in `~/.config/metaclaude/config.json`:
```json
{
  "port": 9999,
  "maxCommandsPerSession": 50,
  "commandRetentionMinutes": 30
}
```

## Privacy Considerations

- All data stays local (localhost only)
- Commands are session-scoped and ephemeral
- No persistence across daemon restarts (by default)
- User explicitly connects terminals to sessions
