import express from "express";
import { generateContext } from "./context.js";
const DEFAULT_CONFIG = {
    port: 9999,
    maxCommandsPerSession: 50,
    commandRetentionMinutes: 30,
};
class MetaclaudeDaemon {
    sessions = new Map();
    config;
    app;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.app = express();
        this.setupRoutes();
    }
    setupRoutes() {
        this.app.use(express.json());
        // Health check
        this.app.get("/health", (_req, res) => {
            res.json({ status: "ok", sessions: this.sessions.size });
        });
        // Register a new session (called by SessionStart hook)
        this.app.post("/session/:sessionId", (req, res) => {
            const { sessionId } = req.params;
            this.getOrCreateSession(sessionId);
            res.json({ success: true, sessionId });
        });
        // Track a command (called by metaclaude track)
        this.app.post("/track/:sessionId", (req, res) => {
            const { sessionId } = req.params;
            const { command, exitCode, cwd, terminalId } = req.body;
            const session = this.getOrCreateSession(sessionId);
            if (terminalId) {
                session.terminals.add(terminalId);
            }
            session.commands.unshift({
                command,
                exitCode: exitCode ?? null,
                timestamp: new Date(),
                cwd,
                terminalId,
            });
            // Trim to max commands
            if (session.commands.length > this.config.maxCommandsPerSession) {
                session.commands = session.commands.slice(0, this.config.maxCommandsPerSession);
            }
            session.lastActivity = new Date();
            res.json({ success: true, commandCount: session.commands.length });
        });
        // Get context for injection (called by UserPromptSubmit hook)
        this.app.get("/context/:sessionId", (req, res) => {
            const { sessionId } = req.params;
            const session = this.sessions.get(sessionId);
            if (!session || session.commands.length === 0) {
                // No context to inject
                res.json({ context: null });
                return;
            }
            const context = generateContext(session);
            res.json({ context });
        });
        // Clear commands for a session
        this.app.post("/clear/:sessionId", (req, res) => {
            const { sessionId } = req.params;
            const session = this.sessions.get(sessionId);
            if (session) {
                session.commands = [];
            }
            res.json({ success: true });
        });
        // List all sessions (for debugging)
        this.app.get("/sessions", (_req, res) => {
            const sessions = Array.from(this.sessions.entries()).map(([id, session]) => ({
                id,
                commandCount: session.commands.length,
                terminalCount: session.terminals.size,
                lastActivity: session.lastActivity,
            }));
            res.json({ sessions });
        });
        // Delete a session
        this.app.delete("/session/:sessionId", (req, res) => {
            const { sessionId } = req.params;
            this.sessions.delete(sessionId);
            res.json({ success: true });
        });
    }
    getOrCreateSession(sessionId) {
        let session = this.sessions.get(sessionId);
        if (!session) {
            session = {
                id: sessionId,
                commands: [],
                terminals: new Set(),
                createdAt: new Date(),
                lastActivity: new Date(),
            };
            this.sessions.set(sessionId, session);
        }
        return session;
    }
    cleanupOldCommands() {
        const cutoff = new Date(Date.now() - this.config.commandRetentionMinutes * 60 * 1000);
        for (const session of this.sessions.values()) {
            session.commands = session.commands.filter((cmd) => cmd.timestamp > cutoff);
        }
    }
    start() {
        // Start cleanup interval
        setInterval(() => this.cleanupOldCommands(), 60 * 1000);
        const server = this.app.listen(this.config.port, "127.0.0.1", () => {
            console.log(`metaclaude daemon listening on http://127.0.0.1:${this.config.port}`);
        });
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.log(`Port ${this.config.port} is already in use.`);
                console.log(`Another metaclaude daemon may be running.`);
                console.log(`\nTo check: metaclaude status`);
                console.log(`To kill:  lsof -ti:${this.config.port} | xargs kill`);
                process.exit(1);
            }
            else {
                console.error("Daemon error:", err.message);
                process.exit(1);
            }
        });
    }
    getApp() {
        return this.app;
    }
}
export function startDaemon(config = {}) {
    const daemon = new MetaclaudeDaemon(config);
    daemon.start();
}
export { MetaclaudeDaemon };
