/**
 * Type declarations for external modules without types
 */

declare module "lockfile" {
  export function lock(
    path: string,
    opts: { wait?: number; retries?: number },
    callback: (err: Error | null) => void
  ): void;

  export function unlock(path: string, callback: (err: Error | null) => void): void;
}

declare module "clawdbot/plugin-sdk" {
  export interface ClawdbotPluginApi {
    logger: {
      info(...args: any[]): void;
      error(...args: any[]): void;
      warn(...args: any[]): void;
      debug(...args: any[]): void;
    };
    runtime: {
      state: {
        resolveStateDir(): string;
      };
    };
    registerCommand(config: {
      name: string;
      description: string;
      acceptsArgs: boolean;
      requireAuth: boolean;
      handler: (args: any) => Promise<any>;
    }): void;
  }
}
