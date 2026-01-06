import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
const DAEMON_HOST = "127.0.0.1";
const DAEMON_PORT = 9999;
export async function isDaemonRunning() {
    return new Promise((resolve) => {
        const req = http.get({
            hostname: DAEMON_HOST,
            port: DAEMON_PORT,
            path: "/health",
            timeout: 1000,
        }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });
    });
}
export async function startDaemonBackground() {
    // Check if already running
    if (await isDaemonRunning()) {
        return true;
    }
    // Get path to the daemon script
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const daemonScript = path.join(__dirname, "index.js");
    // Spawn daemon as detached background process
    const child = spawn("node", [daemonScript, "daemon"], {
        detached: true,
        stdio: "ignore",
        cwd: process.cwd(),
    });
    child.unref();
    // Wait for daemon to be ready (up to 3 seconds)
    for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (await isDaemonRunning()) {
            return true;
        }
    }
    return false;
}
export async function ensureDaemonRunning() {
    if (await isDaemonRunning()) {
        return true;
    }
    console.log("Starting metaclaude daemon...");
    const started = await startDaemonBackground();
    if (started) {
        console.log("Daemon started on port 9999");
        return true;
    }
    else {
        console.error("Failed to start daemon");
        return false;
    }
}
