# metaclaude

Terminal-aware configuration assistant for Claude Code.

metaclaude watches your terminal commands and injects that context into Claude Code, enabling Claude to proactively suggest configuration improvements based on your actual workflow patterns.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  You run commands in your terminal                              │
│  $ npm test                                                     │
│  $ git diff                                                     │
│  $ npm test (again, after Claude edits a file)                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  metaclaude tracks these commands                               │
│  and injects them into Claude Code's context                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Claude sees your workflow and suggests:                        │
│                                                                 │
│  "I notice you've run `npm test` after my last 3 edits.        │
│   Would you like me to run tests automatically?                 │
│                                                                 │
│   Run: /hooks                                                   │
│   Then add a PostToolUse hook for Edit with: npm test"          │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Install globally
npm install -g metaclaude

# Install hooks into Claude Code (user-level)
metaclaude install --global
```

## Usage

### 1. Start Claude Code

```bash
claude
```

When Claude Code starts, you'll see:
```
📡 metaclaude active. Connect terminals with:
   metaclaude track abc123def456...
```

The daemon starts automatically - no manual setup needed.

### 2. Connect your terminals

In any terminal where you want Claude to see your commands:

```bash
metaclaude track
```

That's it - no session ID needed. It auto-detects the active Claude session.

You'll see:
```
📡 metaclaude tracking active
   Session: abc123...
   Terminal: T4f2a
   Shell: zsh
```

Now use your terminal normally. Claude Code will see what you run and can suggest configuration improvements.

### 3. Check status

```bash
metaclaude status
```

### Manual daemon control (optional)

The daemon auto-starts when needed, but you can also control it manually:

```bash
metaclaude daemon          # Start in foreground (for debugging)
metaclaude status          # Check if running
lsof -ti:9999 | xargs kill # Stop the daemon
```

## What Claude Can Suggest

Based on your terminal activity, Claude can suggest:

| Pattern | Suggestion |
|---------|------------|
| Running tests after edits | Add post-edit hook to run tests automatically |
| Repeatedly running same command | Create a slash command for it |
| Undoing Claude's commits | Add to CLAUDE.md to ask before committing |
| Running linter manually | Add pre-commit hook |
| Complex multi-step workflows | Create a custom skill or subagent |

All suggestions come with **exact runnable commands**, not vague advice.

## Commands

| Command | Description |
|---------|-------------|
| `metaclaude track` | Track terminal commands (auto-detects session) |
| `metaclaude install [--global]` | Install hooks into Claude Code |
| `metaclaude uninstall [--global]` | Remove hooks from Claude Code |
| `metaclaude status` | Show daemon status and active sessions |
| `metaclaude daemon` | Start the tracking daemon (usually auto-started) |

## Architecture

```
metaclaude daemon (localhost:9999)
    ↑                           ↓
    │                    UserPromptSubmit hook
    │                    (injects terminal context)
    │                           ↓
metaclaude track ──────→ Claude Code Session
(in user terminals)
```

- **Daemon**: HTTP server tracking commands per Claude Code session
- **SessionStart hook**: Shows session ID when Claude Code starts
- **UserPromptSubmit hook**: Injects terminal context before each prompt
- **track command**: Wraps shell to capture commands

## Privacy

- All data stays local (localhost only)
- Commands are session-scoped and ephemeral
- No persistence across daemon restarts
- You explicitly choose which terminals to track

## Configuration

Default config location: `~/.config/metaclaude/config.json`

```json
{
  "port": 9999,
  "maxCommandsPerSession": 50,
  "commandRetentionMinutes": 30
}
```

## Uninstall

```bash
metaclaude uninstall --global
npm uninstall -g metaclaude
```

## Development

```bash
git clone https://github.com/dongreenber/metaclaude
cd metaclaude
npm install
npm run build
npm test     # run tests
npm run dev  # watch mode
```

## Status

🚧 **Early development** - This project is experimental and under active development.

## License

MIT
