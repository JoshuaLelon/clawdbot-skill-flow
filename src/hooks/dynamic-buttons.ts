/**
 * Dynamic buttons utilities - generate button options based on historical data
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { FlowHooks, FlowSession, FlowStep, Button } from "../types.js";
import type { DynamicButtonsConfig, ButtonStrategy } from "./types.js";
import { querySheetHistory } from "./google-sheets.js";

/**
 * Create a hook that generates dynamic buttons based on historical data.
 * Returns an onStepRender hook function.
 *
 * @example
 * ```ts
 * export default {
 *   onStepRender: createDynamicButtons({
 *     spreadsheetId: '1ABC...xyz',
 *     variable: 'reps',
 *     strategy: 'centered',
 *     buttonCount: 5,
 *     step: 5
 *   })
 * };
 * ```
 */
export function createDynamicButtons(
  config: DynamicButtonsConfig
): NonNullable<FlowHooks["onStepRender"]> {
  const {
    spreadsheetId,
    historyFile,
    variable,
    strategy,
    buttonCount = 5,
    step = 5,
  } = config;

  return async (flowStep: FlowStep, session: FlowSession): Promise<FlowStep> => {
    // Only modify steps that capture the target variable
    if (flowStep.capture !== variable) {
      return flowStep;
    }

    try {
      // Load historical data
      let history: Array<Record<string, unknown>> = [];

      if (spreadsheetId) {
        // Load from Google Sheets
        history = await querySheetHistory(spreadsheetId, "Sheet1", {
          flowName: session.flowName,
          userId: session.senderId,
        });
      } else if (historyFile) {
        // Load from local .jsonl file
        history = await loadHistoryFromFile(historyFile);
      }

      // Calculate average for the target variable
      const avg = await getRecentAverage(variable, history, 10);

      if (avg === null || Number.isNaN(avg)) {
        // No history or invalid data, return step unchanged
        return flowStep;
      }

      // Generate button range based on strategy
      const values = generateButtonRange(avg, buttonCount, step, strategy);

      // Convert to button objects
      const buttons: Button[] = values.map((val) => ({
        text: String(val),
        value: val,
      }));

      // Return modified step with dynamic buttons
      return {
        ...flowStep,
        buttons,
      };
    } catch (error) {
      // Enhanced error message with context
      const errorMessage = error instanceof Error ? error.message : String(error);
      const dataSource = spreadsheetId
        ? `Google Sheets (${spreadsheetId})`
        : historyFile
          ? `local file (${historyFile})`
          : "unknown source";
      console.error(
        `Failed to generate dynamic buttons for variable "${variable}" from ${dataSource}: ${errorMessage}. ` +
          `Using original step without dynamic buttons.`
      );
      // Return step unchanged on error
      return flowStep;
    }
  };
}

/**
 * Get the recent average value for a variable from historical data.
 * Returns null if no valid data found.
 *
 * @param variable - The variable name to calculate average for
 * @param history - Array of historical session data
 * @param count - Number of recent values to average (default: 10)
 * @param precision - Number of decimal places (default: 0 for integers)
 * @returns Average value rounded to specified precision, or null if no data
 *
 * @example
 * ```ts
 * // Integer average (default)
 * const avgReps = await getRecentAverage('reps', history, 10);
 *
 * // Decimal average for weight tracking
 * const avgWeight = await getRecentAverage('weight', history, 10, 1); // 155.5 lbs
 * ```
 */
export async function getRecentAverage(
  variable: string,
  history: Array<Record<string, unknown>>,
  count = 10,
  precision = 0
): Promise<number | null> {
  // Filter for entries with the target variable
  const values = history
    .map((entry) => entry[variable])
    .filter((val): val is number | string => val !== undefined && val !== null)
    .map((val) => (typeof val === "number" ? val : Number(val)))
    .filter((val) => !Number.isNaN(val));

  if (values.length === 0) {
    return null;
  }

  // Take most recent N values
  const recent = values.slice(-count);

  // Calculate average
  const sum = recent.reduce((acc, val) => acc + val, 0);
  const average = sum / recent.length;

  // Round to specified precision
  return precision === 0
    ? Math.round(average)
    : Number(average.toFixed(precision));
}

/**
 * Generate a range of button values based on a center point and strategy.
 *
 * @param center - The center value (typically the historical average)
 * @param count - Number of buttons to generate
 * @param step - Increment between buttons
 * @param strategy - Button generation strategy
 * @param minValue - Optional minimum value (no minimum by default)
 *
 * @example
 * ```ts
 * // Centered: [10, 15, 20, 25, 30] (center=20, count=5, step=5)
 * const buttons = generateButtonRange(20, 5, 5, 'centered');
 *
 * // Progressive: [20, 22, 24, 26, 28] (increasing difficulty)
 * const buttons = generateButtonRange(20, 5, 2, 'progressive');
 *
 * // Range: [15, 20, 25, 30, 35] (centered with larger steps)
 * const buttons = generateButtonRange(25, 5, 5, 'range');
 *
 * // With minimum value (no negatives): [0, 5, 10, 15, 20]
 * const buttons = generateButtonRange(10, 5, 5, 'centered', 0);
 *
 * // Temperature tracking (allows negatives): [-10, -5, 0, 5, 10]
 * const buttons = generateButtonRange(0, 5, 5, 'centered');
 * ```
 */
export function generateButtonRange(
  center: number,
  count: number,
  step: number,
  strategy: ButtonStrategy = "centered",
  minValue?: number
): number[] {
  const buttons: number[] = [];

  switch (strategy) {
    case "centered": {
      // Generate buttons centered around the average
      // For count=5: [avg-2*step, avg-step, avg, avg+step, avg+2*step]
      const offset = Math.floor(count / 2);
      for (let i = -offset; i <= offset; i++) {
        if (buttons.length < count) {
          const value = center + i * step;
          buttons.push(minValue !== undefined ? Math.max(minValue, value) : value);
        }
      }
      break;
    }

    case "progressive": {
      // Generate buttons with increasing values (progressive difficulty)
      // Start at previous average, then increase
      for (let i = 0; i < count; i++) {
        const value = center + i * step;
        buttons.push(minValue !== undefined ? Math.max(minValue, value) : value);
      }
      break;
    }

    case "range": {
      // Generate evenly-spaced range
      // Similar to centered but extends beyond average
      const offset = Math.floor(count / 2);
      for (let i = -offset; i <= offset; i++) {
        if (buttons.length < count) {
          const value = center + i * step;
          buttons.push(minValue !== undefined ? Math.max(minValue, value) : value);
        }
      }
      break;
    }

    default:
      throw new Error(`Unknown button strategy: ${strategy}`);
  }

  return buttons;
}

/**
 * Load history from a local .jsonl file
 */
async function loadHistoryFromFile(
  filePath: string
): Promise<Array<Record<string, unknown>>> {
  try {
    // Expand ~ to home directory
    const expandedPath = filePath.startsWith("~")
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;

    // Read file
    const content = await fs.readFile(expandedPath, "utf-8");

    // Parse JSONL (one JSON object per line)
    const lines = content.trim().split("\n");
    const history: Array<Record<string, unknown>> = [];

    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line) as Record<string, unknown>;
          history.push(entry);
        } catch (error) {
          console.warn("Failed to parse JSONL line:", line, error);
        }
      }
    }

    return history;
  } catch (error) {
    // File doesn't exist or can't be read
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []; // No history yet
    }
    throw error;
  }
}
