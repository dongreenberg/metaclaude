import express from "express";
export interface TrackedCommand {
    command: string;
    exitCode: number | null;
    timestamp: Date;
    cwd: string;
    terminalId?: string;
}
export interface Session {
    id: string;
    commands: TrackedCommand[];
    terminals: Set<string>;
    createdAt: Date;
    lastActivity: Date;
}
export interface DaemonConfig {
    port: number;
    maxCommandsPerSession: number;
    commandRetentionMinutes: number;
}
declare class MetaclaudeDaemon {
    private sessions;
    private config;
    private app;
    constructor(config?: Partial<DaemonConfig>);
    private setupRoutes;
    private getOrCreateSession;
    private cleanupOldCommands;
    start(): void;
    getApp(): express.Application;
}
export declare function startDaemon(config?: Partial<DaemonConfig>): void;
export { MetaclaudeDaemon };
