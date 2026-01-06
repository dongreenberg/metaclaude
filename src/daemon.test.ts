import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MetaclaudeDaemon } from "./daemon.js";
import http from "http";

describe("MetaclaudeDaemon", () => {
  let daemon: MetaclaudeDaemon;
  let server: http.Server;
  const TEST_PORT = 19999;

  beforeAll(async () => {
    daemon = new MetaclaudeDaemon({ port: TEST_PORT });
    const app = daemon.getApp();
    server = app.listen(TEST_PORT, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; data: unknown }> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path,
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode!, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode!, data });
          }
        });
      });

      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  it("should return health status", async () => {
    const { status, data } = await request("GET", "/health");
    expect(status).toBe(200);
    expect(data).toEqual({ status: "ok", sessions: 0 });
  });

  it("should create a session", async () => {
    const { status, data } = await request("POST", "/session/test-session-1");
    expect(status).toBe(200);
    expect(data).toEqual({ success: true, sessionId: "test-session-1" });
  });

  it("should track commands", async () => {
    const { status, data } = await request("POST", "/track/test-session-1", {
      command: "npm test",
      exitCode: 0,
      cwd: "/tmp",
      terminalId: "T1",
    });
    expect(status).toBe(200);
    expect(data).toEqual({ success: true, commandCount: 1 });
  });

  it("should return context with tracked commands", async () => {
    const { status, data } = await request("GET", "/context/test-session-1");
    expect(status).toBe(200);
    expect((data as { context: string }).context).toContain("npm test");
    expect((data as { context: string }).context).toContain(
      "[metaclaude terminal context]"
    );
  });

  it("should return null context for unknown session", async () => {
    const { status, data } = await request("GET", "/context/unknown-session");
    expect(status).toBe(200);
    expect((data as { context: null }).context).toBeNull();
  });

  it("should list sessions", async () => {
    const { status, data } = await request("GET", "/sessions");
    expect(status).toBe(200);
    expect((data as { sessions: unknown[] }).sessions.length).toBeGreaterThan(
      0
    );
  });

  it("should clear session commands", async () => {
    await request("POST", "/clear/test-session-1");
    const { data } = await request("GET", "/context/test-session-1");
    expect((data as { context: null }).context).toBeNull();
  });

  it("should delete a session", async () => {
    await request("DELETE", "/session/test-session-1");
    const { data } = await request("GET", "/sessions");
    const sessions = (data as { sessions: { id: string }[] }).sessions;
    expect(sessions.find((s) => s.id === "test-session-1")).toBeUndefined();
  });
});
