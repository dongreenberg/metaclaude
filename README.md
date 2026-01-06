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

### 2. Connect your terminals

In any terminal where you want Claude to see your commands:

```bash
metaclaude start
```

This connects to your most recently started Claude Code session.

You'll see:
```
📡 metaclaude active
   Session: abc123...
   Terminal: T4f2a
   Shell: zsh

   To connect another terminal to this session:
   metaclaude start --session abc123...
```

Now use your terminal normally. Claude Code will see what you run and can suggest configuration improvements.

### 3. Check status

```bash
metaclaude status
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
| `metaclaude start` | Start tracking terminal commands (connects to most recent session) |
| `metaclaude start --session <id>` | Connect to a specific Claude Code session |
| `metaclaude install [--global]` | Install hooks into Claude Code |
| `metaclaude uninstall [--global]` | Remove hooks from Claude Code |
| `metaclaude status` | Show status and active sessions |

## Privacy

- All data stays local (localhost only)
- Commands are session-scoped and ephemeral
- No persistence across restarts
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
