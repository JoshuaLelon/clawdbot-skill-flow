/**
 * Built-in action registry for declarative actions
 * Each action has a schema for validation and an execute function
 */

import { z } from "zod";
import type { FlowSession, FlowStep } from "../types.js";
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import {
  appendToSheet,
  querySheetHistory,
  createSpreadsheet,
} from "../hooks/google-sheets.js";
import {
  getRecentAverage,
  generateButtonRange,
} from "../hooks/dynamic-buttons.js";
import { scheduleNextSession } from "../hooks/scheduling.js";
import { scheduleOneTimeReminder } from "../hooks/clawdbot-scheduler.js";
import { withRetry } from "../hooks/common.js";
import type { GoogleServiceAccountCredentials, ButtonStrategy } from "../hooks/types.js";

export interface ActionContext {
  session: FlowSession;
  api: ClawdbotPluginApi;
  step?: FlowStep;
  capturedVariable?: string;
  capturedValue?: string | number;
}

export interface ActionDefinition {
  schema: z.ZodSchema;
  execute: (config: unknown, context: ActionContext) => Promise<unknown>;
}

/**
 * Google Sheets Actions
 */

const sheetsAppendSchema = z.object({
  spreadsheetId: z.string().describe("Google Sheets spreadsheet ID"),
  worksheetName: z.string().default("Sheet1").describe("Worksheet name"),
  columns: z.array(z.string()).optional().describe("Column names to include (or all variables if omitted)"),
  includeMetadata: z.boolean().default(true).describe("Include timestamp, userId, flowName, channel"),
  headerMode: z.enum(["append", "overwrite", "strict"]).default("append"),
  credentials: z
    .object({
      clientEmail: z.string(),
      privateKey: z.string(),
    })
    .optional(),
});

async function sheetsAppendExecute(
  config: unknown,
  context: ActionContext
): Promise<void> {
  const cfg = sheetsAppendSchema.parse(config);
  const { session } = context;

  // Prepare row data
  const row: Record<string, unknown> = {};

  // Add metadata if requested
  if (cfg.includeMetadata) {
    row.timestamp = new Date().toISOString();
    row.userId = session.senderId;
    row.flowName = session.flowName;
    row.channel = session.channel;
  }

  // Add variables
  if (cfg.columns && cfg.columns.length > 0) {
    for (const col of cfg.columns) {
      row[col] = session.variables[col] ?? "";
    }
  } else {
    Object.assign(row, session.variables);
  }

  // Append to sheet with retry
  await withRetry(
    () => appendToSheet(
      cfg.spreadsheetId,
      cfg.worksheetName,
      [row],
      cfg.credentials as GoogleServiceAccountCredentials | undefined,
      cfg.headerMode
    ),
    { maxAttempts: 3, delayMs: 1000, backoff: true }
  );
}

const sheetsQuerySchema = z.object({
  spreadsheetId: z.string(),
  worksheetName: z.string().default("Sheet1"),
  filters: z
    .object({
      flowName: z.string().optional(),
      userId: z.string().optional(),
      dateRange: z.tuple([z.string(), z.string()]).optional(),
    })
    .optional(),
  credentials: z
    .object({
      clientEmail: z.string(),
      privateKey: z.string(),
    })
    .optional(),
});

async function sheetsQueryExecute(
  config: unknown,
  _context: ActionContext
): Promise<Array<Record<string, unknown>>> {
  const cfg = sheetsQuerySchema.parse(config);

  // Convert date strings to Date objects if needed
  const filters = cfg.filters
    ? {
        ...cfg.filters,
        dateRange: cfg.filters.dateRange
          ? [new Date(cfg.filters.dateRange[0]), new Date(cfg.filters.dateRange[1])] as [Date, Date]
          : undefined,
      }
    : undefined;

  return await querySheetHistory(
    cfg.spreadsheetId,
    cfg.worksheetName,
    filters,
    cfg.credentials as GoogleServiceAccountCredentials | undefined
  );
}

const sheetsCreateSchema = z.object({
  title: z.string(),
  worksheetName: z.string().default("Sheet1"),
  headers: z.array(z.string()).optional(),
  folderId: z.string().optional(),
  credentials: z
    .object({
      clientEmail: z.string(),
      privateKey: z.string(),
    })
    .optional(),
  useGogOAuth: z.boolean().default(true).describe(
    "Use gog CLI OAuth instead of service account (recommended to avoid quota issues)"
  ),
});

async function sheetsCreateExecute(
  config: unknown,
  _context: ActionContext
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const cfg = sheetsCreateSchema.parse(config);

  return await createSpreadsheet({
    title: cfg.title,
    worksheetName: cfg.worksheetName,
    headers: cfg.headers,
    folderId: cfg.folderId,
    credentials: cfg.credentials as GoogleServiceAccountCredentials | undefined,
    useGogOAuth: cfg.useGogOAuth,
  });
}

/**
 * Button Generation Actions
 */

const buttonsGenerateRangeSchema = z.object({
  variable: z.string().describe("Variable name to generate buttons for"),
  spreadsheetId: z.string().optional().describe("Load history from Google Sheets"),
  worksheetName: z.string().default("Sheet1"),
  historyFile: z.string().optional().describe("Load history from local JSONL file"),
  strategy: z.enum(["centered", "progressive", "range"]).default("centered"),
  buttonCount: z.number().default(5),
  step: z.number().default(5),
  minValue: z.number().optional(),
  recentCount: z.number().default(10).describe("Number of recent values to average"),
  credentials: z
    .object({
      clientEmail: z.string(),
      privateKey: z.string(),
    })
    .optional(),
});

async function buttonsGenerateRangeExecute(
  config: unknown,
  context: ActionContext
): Promise<FlowStep> {
  const cfg = buttonsGenerateRangeSchema.parse(config);
  const { step, session } = context;

  if (!step) {
    throw new Error("buttonsGenerateRange requires step context");
  }

  // Only modify steps that capture the target variable
  if (step.capture !== cfg.variable) {
    return step;
  }

  // Load historical data
  let history: Array<Record<string, unknown>> = [];

  if (cfg.spreadsheetId) {
    history = await querySheetHistory(
      cfg.spreadsheetId,
      cfg.worksheetName,
      {
        flowName: session.flowName,
        userId: session.senderId,
      },
      cfg.credentials as GoogleServiceAccountCredentials | undefined
    );
  }

  // Calculate average for the target variable
  const avg = await getRecentAverage(cfg.variable, history, cfg.recentCount);

  if (avg === null || Number.isNaN(avg)) {
    // No history, return step unchanged
    return step;
  }

  // Generate button range
  const values = generateButtonRange(
    avg,
    cfg.buttonCount,
    cfg.step,
    cfg.strategy as ButtonStrategy,
    cfg.minValue
  );

  // Convert to button objects
  const buttons = values.map((val) => ({
    text: String(val),
    value: val,
  }));

  return {
    ...step,
    buttons,
  };
}

/**
 * Scheduling Actions
 */

const scheduleCronSchema = z.object({
  schedule: z.string().describe("Cron schedule string (e.g., '0 8 * * 1,3,5')"),
  timezone: z.string().optional().describe("Timezone (e.g., 'America/Los_Angeles')"),
  message: z.string().describe("Message to send when cron triggers"),
  channel: z.string().describe("Channel/platform (e.g., 'telegram', 'whatsapp')"),
  to: z.string().describe("Target user/chat ID"),
  name: z.string().optional().describe("Job name (defaults to flowName-senderId)"),
  sessionType: z.enum(["main", "isolated"]).default("isolated"),
  deleteAfterRun: z.boolean().default(false),
});

async function scheduleCronExecute(
  config: unknown,
  context: ActionContext
): Promise<void> {
  const cfg = scheduleCronSchema.parse(config);
  const { session, api } = context;

  // Use ClawdBot native cron system
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  const jobName = cfg.name || `${session.flowName}-${session.senderId}`;

  const args = [
    "clawdbot",
    "cron",
    "add",
    "--name",
    `"${jobName}"`,
    "--cron",
    `"${cfg.schedule}"`,
    "--session",
    cfg.sessionType,
    "--message",
    `"${cfg.message}"`,
    "--deliver",
    "--channel",
    cfg.channel,
    "--to",
    `"${cfg.to}"`,
  ];

  if (cfg.timezone) {
    args.push("--tz", `"${cfg.timezone}"`);
  }

  if (cfg.deleteAfterRun) {
    args.push("--delete-after-run");
  }

  const command = args.join(" ");
  const { stderr } = await execAsync(command);

  if (stderr) {
    api.logger.warn(`Cron scheduling warning: ${stderr}`);
  }

  api.logger.info(`Scheduled next session: ${jobName} (${cfg.schedule})`);
}

const scheduleOneTimeSchema = z.object({
  date: z.string().describe("ISO date string for one-time reminder"),
  message: z.string(),
  channel: z.string(),
  to: z.string(),
  name: z.string().optional(),
});

async function scheduleOneTimeExecute(
  config: unknown,
  context: ActionContext
): Promise<void> {
  const cfg = scheduleOneTimeSchema.parse(config);
  const { session, api } = context;

  await scheduleOneTimeReminder({
    at: cfg.date,
    message: cfg.message,
    channel: cfg.channel,
    to: cfg.to,
    name: cfg.name || `${session.flowName}-${session.senderId}-onetime`,
  });

  api.logger.info(`Scheduled one-time reminder for ${cfg.date}`);
}

const scheduleCalendarSchema = z.object({
  flowName: z.string(),
  senderId: z.string(),
  date: z.string().describe("ISO date string"),
  calendarId: z.string().default("primary"),
  credentials: z
    .object({
      clientEmail: z.string(),
      privateKey: z.string(),
    })
    .optional(),
});

async function scheduleCalendarExecute(
  config: unknown,
  _context: ActionContext
): Promise<void> {
  const cfg = scheduleCalendarSchema.parse(config);

  await scheduleNextSession(
    cfg.flowName,
    cfg.senderId,
    new Date(cfg.date),
    {
      calendarId: cfg.calendarId,
      credentials: cfg.credentials as GoogleServiceAccountCredentials | undefined,
    }
  );
}

/**
 * Notification Actions
 */

const notifyTelegramSchema = z.object({
  text: z.string().describe("Message text to send"),
  to: z.string().optional().describe("Target user/chat (defaults to current sender)"),
  parseMode: z.enum(["Markdown", "HTML"]).optional(),
});

async function notifyTelegramExecute(
  config: unknown,
  context: ActionContext
): Promise<void> {
  const cfg = notifyTelegramSchema.parse(config);
  const { session, api } = context;

  // Send message via runtime API
  // Note: This assumes the plugin has access to messaging capabilities
  // Users may need to implement this based on their platform
  api.logger.info(`Sending Telegram message to ${cfg.to || session.senderId}: ${cfg.text}`);

  // TODO: Implement actual message sending when api.runtime.message is available
  // For now, just log as this is a declarative action system proof of concept
}

/**
 * Data Transformation Actions
 */

const dataTransformSchema = z.object({
  operation: z.enum(["sum", "average", "min", "max", "concat", "format"]),
  inputs: z.array(z.union([z.string(), z.number()])).describe("Input values or variable names"),
  format: z.string().optional().describe("Format string for 'format' operation"),
});

async function dataTransformExecute(
  config: unknown,
  _context: ActionContext
): Promise<{ result: string | number }> {
  const cfg = dataTransformSchema.parse(config);

  let result: string | number;

  switch (cfg.operation) {
    case "sum": {
      const nums = cfg.inputs.map((v) => (typeof v === "number" ? v : parseFloat(String(v))));
      result = nums.reduce((a, b) => a + b, 0);
      break;
    }

    case "average": {
      const nums = cfg.inputs.map((v) => (typeof v === "number" ? v : parseFloat(String(v))));
      result = nums.reduce((a, b) => a + b, 0) / nums.length;
      break;
    }

    case "min": {
      const nums = cfg.inputs.map((v) => (typeof v === "number" ? v : parseFloat(String(v))));
      result = Math.min(...nums);
      break;
    }

    case "max": {
      const nums = cfg.inputs.map((v) => (typeof v === "number" ? v : parseFloat(String(v))));
      result = Math.max(...nums);
      break;
    }

    case "concat": {
      result = cfg.inputs.map((v) => String(v)).join("");
      break;
    }

    case "format": {
      if (!cfg.format) {
        throw new Error("format operation requires format string");
      }
      result = cfg.format;
      // Simple placeholder replacement
      cfg.inputs.forEach((val, idx) => {
        result = String(result).replace(`{${idx}}`, String(val));
      });
      break;
    }

    default:
      throw new Error(`Unknown operation: ${cfg.operation}`);
  }

  return { result };
}

/**
 * HTTP Request Actions
 */

const httpRequestSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  headers: z.record(z.string()).optional(),
  body: z.record(z.unknown()).optional(),
  timeout: z.number().default(10000),
  retries: z.number().default(3),
});

async function httpRequestExecute(
  config: unknown,
  _context: ActionContext
): Promise<unknown> {
  const cfg = httpRequestSchema.parse(config);

  return await withRetry(
    async () => {
      const fetchOptions: RequestInit = {
        method: cfg.method,
        headers: {
          "Content-Type": "application/json",
          ...cfg.headers,
        },
        signal: AbortSignal.timeout(cfg.timeout),
      };

      // Only include body for non-GET requests
      if (cfg.method !== "GET" && cfg.body) {
        fetchOptions.body = JSON.stringify(cfg.body);
      }

      const response = await fetch(cfg.url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await response.json();
      }

      return await response.text();
    },
    { maxAttempts: cfg.retries, delayMs: 1000, backoff: true }
  );
}

/**
 * Built-in action registry
 */
export const builtInActions: Record<string, ActionDefinition> = {
  // Google Sheets
  "sheets.append": {
    schema: sheetsAppendSchema,
    execute: sheetsAppendExecute,
  },
  "sheets.query": {
    schema: sheetsQuerySchema,
    execute: sheetsQueryExecute,
  },
  "sheets.create": {
    schema: sheetsCreateSchema,
    execute: sheetsCreateExecute,
  },

  // Buttons
  "buttons.generateRange": {
    schema: buttonsGenerateRangeSchema,
    execute: buttonsGenerateRangeExecute,
  },

  // Scheduling
  "schedule.cron": {
    schema: scheduleCronSchema,
    execute: scheduleCronExecute,
  },
  "schedule.oneTime": {
    schema: scheduleOneTimeSchema,
    execute: scheduleOneTimeExecute,
  },
  "schedule.calendar": {
    schema: scheduleCalendarSchema,
    execute: scheduleCalendarExecute,
  },

  // Notifications
  "notify.telegram": {
    schema: notifyTelegramSchema,
    execute: notifyTelegramExecute,
  },

  // Utilities
  "data.transform": {
    schema: dataTransformSchema,
    execute: dataTransformExecute,
  },
  "http.request": {
    schema: httpRequestSchema,
    execute: httpRequestExecute,
  },
};
