import { describe, it, expect } from "vitest";
import { generateContext } from "./context.js";
describe("generateContext", () => {
    it("should return empty string for session with no commands", () => {
        const session = {
            id: "test",
            commands: [],
            terminals: new Set(),
            createdAt: new Date(),
            lastActivity: new Date(),
        };
        const context = generateContext(session);
        expect(context).toBe("");
    });
    it("should include command list in context", () => {
        const session = {
            id: "test",
            commands: [
                {
                    command: "npm test",
                    exitCode: 1,
                    timestamp: new Date(),
                    cwd: "/tmp",
                    terminalId: "T1",
                },
                {
                    command: "git diff",
                    exitCode: 0,
                    timestamp: new Date(),
                    cwd: "/tmp",
                    terminalId: "T1",
                },
            ],
            terminals: new Set(["T1"]),
            createdAt: new Date(),
            lastActivity: new Date(),
        };
        const context = generateContext(session);
        expect(context).toContain("[metaclaude terminal context]");
        expect(context).toContain("npm test");
        expect(context).toContain("git diff");
        expect(context).toContain("Connected terminals: 1");
    });
    it("should show exit codes for failed commands", () => {
        const session = {
            id: "test",
            commands: [
                {
                    command: "npm test",
                    exitCode: 1,
                    timestamp: new Date(),
                    cwd: "/tmp",
                },
            ],
            terminals: new Set(),
            createdAt: new Date(),
            lastActivity: new Date(),
        };
        const context = generateContext(session);
        expect(context).toContain("exit 1");
    });
    it("should not show exit code for successful commands", () => {
        const session = {
            id: "test",
            commands: [
                {
                    command: "git status",
                    exitCode: 0,
                    timestamp: new Date(),
                    cwd: "/tmp",
                },
            ],
            terminals: new Set(),
            createdAt: new Date(),
            lastActivity: new Date(),
        };
        const context = generateContext(session);
        expect(context).not.toContain("exit 0");
    });
    it("should include suggestion categories", () => {
        const session = {
            id: "test",
            commands: [
                {
                    command: "npm test",
                    exitCode: 0,
                    timestamp: new Date(),
                    cwd: "/tmp",
                },
            ],
            terminals: new Set(),
            createdAt: new Date(),
            lastActivity: new Date(),
        };
        const context = generateContext(session);
        // Check for key suggestion categories
        expect(context).toContain("MEMORY & INSTRUCTIONS");
        expect(context).toContain("AUTOMATION (Hooks)");
        expect(context).toContain("PERMISSIONS");
        expect(context).toContain("CUSTOM SLASH COMMANDS");
        expect(context).toContain("SKILLS");
        expect(context).toContain("SUBAGENTS");
        expect(context).toContain("MCP SERVERS");
        expect(context).toContain("PLUGINS");
        expect(context).toContain("OUTPUT STYLE");
        expect(context).toContain("SANDBOXING");
    });
    it("should include example suggestions with runnable commands", () => {
        const session = {
            id: "test",
            commands: [
                {
                    command: "npm test",
                    exitCode: 0,
                    timestamp: new Date(),
                    cwd: "/tmp",
                },
            ],
            terminals: new Set(),
            createdAt: new Date(),
            lastActivity: new Date(),
        };
        const context = generateContext(session);
        // Check for runnable command examples
        expect(context).toContain("/hooks");
        expect(context).toContain("/memory");
        expect(context).toContain("/permissions");
        expect(context).toContain("/agents");
        expect(context).toContain("/mcp");
        expect(context).toContain("claude mcp add");
    });
    it("should include terminal IDs when present", () => {
        const session = {
            id: "test",
            commands: [
                {
                    command: "npm test",
                    exitCode: 0,
                    timestamp: new Date(),
                    cwd: "/tmp",
                    terminalId: "T1",
                },
                {
                    command: "git push",
                    exitCode: 0,
                    timestamp: new Date(),
                    cwd: "/tmp",
                    terminalId: "T2",
                },
            ],
            terminals: new Set(["T1", "T2"]),
            createdAt: new Date(),
            lastActivity: new Date(),
        };
        const context = generateContext(session);
        expect(context).toContain("[T1]");
        expect(context).toContain("[T2]");
        expect(context).toContain("Connected terminals: 2");
    });
});
