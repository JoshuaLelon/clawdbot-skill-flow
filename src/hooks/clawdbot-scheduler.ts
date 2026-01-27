/**
 * ClawdBot native cron job scheduler
 * Uses ClawdBot's built-in Gateway cron API via CLI to schedule recurring tasks
 */

import type { FlowHooks, FlowSession } from "../types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ClawdBotScheduleConfig {
  /** Cron schedule string (e.g., "0 8 * * 1,3,5" for Mon/Wed/Fri at 8am) */
  schedule: string;

  /** Timezone for schedule (e.g., "America/Los_Angeles") */
  timezone?: string;

  /** Message to send when cron triggers */
  message: string;

  /** Channel/platform to send to (e.g., "telegram", "whatsapp") */
  channel: string;

  /** Target user/chat ID */
  to: string;

  /** Job name (defaults to flow name) */
  name?: string;

  /** Session type: "main" or "isolated" */
  sessionType?: "main" | "isolated";

  /** Delete job after first successful run */
  deleteAfterRun?: boolean;
}

/**
 * Create a hook that schedules the next workflow session using ClawdBot's native cron system.
 *
 * @example
 * ```ts
 * import { createClawdBotScheduler } from '@joshualelon/clawdbot-skill-flow/hooks/clawdbot-scheduler';
 *
 * export default {
 *   onFlowComplete: createClawdBotScheduler({
 *     schedule: '0 8 * * 1,3,5',  // Mon/Wed/Fri at 8am
 *     timezone: 'America/Los_Angeles',
 *     message: '/flow_start pushups',
 *     channel: 'telegram',
 *     to: '@your_username'
 *   })
 * };
 * ```
 */
export function createClawdBotScheduler(
  config: ClawdBotScheduleConfig
): NonNullable<FlowHooks["onFlowComplete"]> {
  return async (session: FlowSession): Promise<void> => {
    try {
      const jobName = config.name || `${session.flowName}-${session.senderId}`;

      // Build clawdbot cron add command
      const args = [
        'clawdbot',
        'cron',
        'add',
        '--name',
        `"${jobName}"`,
        '--cron',
        `"${config.schedule}"`,
        '--session',
        config.sessionType || 'isolated',
        '--message',
        `"${config.message}"`,
        '--deliver',
        '--channel',
        config.channel,
        '--to',
        `"${config.to}"`
      ];

      if (config.timezone) {
        args.push('--tz', `"${config.timezone}"`);
      }

      if (config.deleteAfterRun) {
        args.push('--delete-after-run');
      }

      const command = args.join(' ');
      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        console.warn(`Cron scheduling warning: ${stderr}`);
      }

      console.log(`✓ Scheduled next session: ${jobName} (${config.schedule})`);
      if (stdout) {
        console.log(`  ${stdout.trim()}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to schedule cron job for flow "${session.flowName}": ${errorMessage}`
      );
      // Don't throw - scheduling failures shouldn't break the flow
    }
  };
}

/**
 * Schedule a one-time reminder at a specific time using ClawdBot's cron system.
 *
 * @example
 * ```ts
 * await scheduleOneTimeReminder({
 *   at: '2026-01-27T15:00:00Z',  // ISO timestamp
 *   message: '/flow_start pushups',
 *   channel: 'telegram',
 *   to: '@username'
 * });
 * ```
 */
export async function scheduleOneTimeReminder(config: {
  /** ISO timestamp or relative time (e.g., "20m", "2h") */
  at: string;
  message: string;
  channel: string;
  to: string;
  name?: string;
}): Promise<void> {
  const args = [
    'clawdbot',
    'cron',
    'add',
    '--name',
    `"${config.name || 'one-time-reminder'}"`,
    '--at',
    `"${config.at}"`,
    '--session',
    'isolated',
    '--message',
    `"${config.message}"`,
    '--deliver',
    '--channel',
    config.channel,
    '--to',
    `"${config.to}"`,
    '--delete-after-run'
  ];

  const command = args.join(' ');
  await execAsync(command);
}

/**
 * List all active cron jobs.
 */
export async function listCronJobs(): Promise<unknown[]> {
  const { stdout } = await execAsync('clawdbot cron list --json');
  return JSON.parse(stdout);
}

/**
 * Remove a cron job by ID.
 */
export async function removeCronJob(jobId: string): Promise<void> {
  await execAsync(`clawdbot cron rm "${jobId}"`);
}
