import http from "http";
export async function status(port) {
    const daemonUrl = `http://127.0.0.1:${port}`;
    console.log("metaclaude status\n");
    // Check daemon health
    try {
        const health = await httpGet(`${daemonUrl}/health`);
        console.log(`Daemon: running on port ${port}`);
        console.log(`Active sessions: ${health.sessions}`);
    }
    catch {
        console.log(`Daemon: not running`);
        console.log(`\nStart the daemon with: metaclaude daemon`);
        return;
    }
    // Get session details
    try {
        const sessionsResponse = await httpGet(`${daemonUrl}/sessions`);
        if (sessionsResponse.sessions.length === 0) {
            console.log(`\nNo active sessions.`);
            console.log(`Start Claude Code and connect terminals with: metaclaude track <session_id>`);
            return;
        }
        console.log(`\nSessions:`);
        for (const session of sessionsResponse.sessions) {
            const lastActivity = new Date(session.lastActivity).toLocaleTimeString();
            console.log(`  ${session.id.substring(0, 8)}...`);
            console.log(`    Terminals: ${session.terminalCount}`);
            console.log(`    Commands: ${session.commandCount}`);
            console.log(`    Last activity: ${lastActivity}`);
        }
    }
    catch (error) {
        console.error("Error fetching sessions:", error);
    }
}
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 2000 }, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error("Invalid JSON response"));
                }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timeout"));
        });
    });
}
