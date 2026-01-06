function formatTimestamp(date) {
    return date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
function formatCommand(cmd) {
    const exitIndicator = cmd.exitCode === null ? "" : cmd.exitCode === 0 ? "" : ` (exit ${cmd.exitCode})`;
    const time = formatTimestamp(cmd.timestamp);
    const terminal = cmd.terminalId ? `[${cmd.terminalId}] ` : "";
    return `  ${terminal}${cmd.command}${exitIndicator} @ ${time}`;
}
export function generateContext(session) {
    const terminalCount = session.terminals.size || 1;
    const recentCommands = session.commands.slice(0, 20); // Show last 20 commands
    if (recentCommands.length === 0) {
        return "";
    }
    const commandList = recentCommands.map(formatCommand).join("\n");
    return `[metaclaude terminal context]

Connected terminals: ${terminalCount}
Recent commands (most recent first):
${commandList}

---

Based on the user's terminal activity and conversation context, consider whether any
configuration improvements would help. Only suggest when there's a clear pattern or benefit.

SUGGESTION CATEGORIES (provide exact runnable commands or content):

MEMORY & INSTRUCTIONS — For patterns, preferences, or project-specific rules:
  Quick add (type at prompt start):
    # <instruction>

  Open memory editor:
    /memory

  For project-specific rules, suggest adding to ./CLAUDE.md:
    Add to ./CLAUDE.md:
    \`\`\`
    ## <Section>
    <instructions>
    \`\`\`

  For global preferences, suggest adding to ~/.claude/CLAUDE.md

AUTOMATION (Hooks) — For repetitive post-action tasks:
  Interactive setup:
    /hooks

  Example: Auto-run tests after file edits:
    Add PostToolUse hook in /hooks for Edit tool:
    Command: npm test

  Example: Lint before committing:
    Add PreToolUse hook in /hooks for Bash matching "git commit":
    Command: npm run lint

PERMISSIONS — For frequently-used commands that shouldn't require approval:
  Interactive setup:
    /permissions

  Auto-allow specific commands (suggest exact pattern):
    Run: /permissions
    Then add to "Always allow": Bash(npm test:*)

  Block sensitive operations:
    Run: /permissions
    Then add to "Always deny": Read(.env*)

CUSTOM SLASH COMMANDS — For multi-step workflows the user repeats:
  Create .claude/commands/<name>.md with content:
    \`\`\`markdown
    ---
    description: <what it does>
    allowed-tools: <tools if restricted>
    ---

    <instructions for Claude>
    \`\`\`

  Example - create a deploy command:
    Create .claude/commands/deploy.md:
    \`\`\`markdown
    ---
    description: Build and deploy to staging
    ---

    Run the build, then deploy to staging:
    1. npm run build
    2. npm run deploy:staging
    3. Verify deployment succeeded
    \`\`\`

SKILLS — For specialized capabilities Claude should learn:
  Create .claude/skills/<name>/SKILL.md:
    \`\`\`markdown
    ---
    name: <skill-name>
    description: <when to use this skill>
    allowed-tools: <tools>
    ---

    <detailed instructions>
    \`\`\`

SUBAGENTS — For delegating specific types of tasks:
  Interactive setup:
    /agents

  Create .claude/agents/<name>.md:
    \`\`\`markdown
    ---
    name: <agent-name>
    description: <when to delegate to this agent>
    tools: <available tools>
    ---

    <agent instructions>
    \`\`\`

MCP SERVERS — For connecting external tools and APIs:
  Interactive setup:
    /mcp

  Add HTTP server:
    claude mcp add --transport http <name> <url>

  Add stdio server:
    claude mcp add --transport stdio <name> -- <command>

PLUGINS — For pre-built community extensions:
  Browse and install:
    /plugin

OUTPUT STYLE — For changing Claude's communication approach:
  Switch style:
    /output-style

  Available: Default, Explanatory, Learning, or create custom in .claude/output-styles/

SANDBOXING — For isolating file/network access:
  Enable sandbox:
    /sandbox

When making a suggestion:
1. Reference the specific terminal command(s) that triggered the suggestion
2. Provide the EXACT command to run or content to add
3. Explain briefly why this would help
4. Do not mention "metaclaude" - integrate suggestions naturally

Example good suggestion:
"I notice you've run \`npm test\` after my last 3 edits. Would you like me to run tests
automatically after editing files?

Run: /hooks
Then add a PostToolUse hook for the Edit tool with command: npm test"

Example bad suggestion (too vague):
"You might want to add something to memory about testing."
`;
}
