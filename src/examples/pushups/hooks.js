/**
 * Example hooks for pushups flow demonstrating step-level actions
 *
 * This example shows:
 * - Fetch actions: Getting data before rendering
 * - BeforeRender actions: Modifying steps dynamically
 * - AfterCapture actions: Side effects after variable capture
 * - Global lifecycle hooks: Flow completion handling
 *
 * ## Configuration Loading Options
 *
 * If you need to load external configuration (API keys, spreadsheet IDs, etc.),
 * here are three approaches:
 *
 * ### Option 1: Import Assertions (Node 17.1+, Stage 3 proposal)
 * ```javascript
 * import config from './config.json' assert { type: 'json' };
 * ```
 * - ✅ Simple and clean syntax
 * - ⚠️  Requires Node 17.1+ and --experimental-json-modules flag
 * - ⚠️  Stage 3 proposal, not yet standard
 *
 * ### Option 2: Dynamic import (All Node versions)
 * ```javascript
 * import { readFileSync } from 'fs';
 * import { fileURLToPath } from 'url';
 * import path from 'path';
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 * const config = JSON.parse(
 *   readFileSync(path.join(__dirname, 'config.json'), 'utf8')
 * );
 * ```
 * - ✅ Works in all Node versions
 * - ✅ No experimental flags needed
 * - ⚠️  More verbose
 *
 * ### Option 3: Use .js config file (Recommended for compatibility)
 * ```javascript
 * // config.js:
 * export default {
 *   google: {
 *     spreadsheetId: "1234...",
 *     range: "Workouts!A:E"
 *   },
 *   schedule: {
 *     cron: "0 9 * * 1,3,5",
 *     timezone: "America/Los_Angeles"
 *   }
 * };
 *
 * // hooks.js:
 * import config from './config.js';
 * ```
 * - ✅ Works everywhere, no special flags
 * - ✅ Can include comments and logic
 * - ✅ Better IDE support
 * - ✅ Native ES module support
 */

// Mock data store (in real implementation, this would be Google Sheets, etc.)
const mockHistory = [
  { date: "2024-01-20", set1: 25, set2: 22, set3: 20, set4: 18 },
  { date: "2024-01-18", set1: 24, set2: 21, set3: 19, set4: 17 },
  { date: "2024-01-16", set1: 23, set2: 20, set3: 18, set4: 16 },
];

const mockWorkouts = [];

/**
 * Fetch action: Get historical average from past workouts
 *
 * Fetch actions are called BEFORE rendering a step to retrieve data
 * that will be used in the step's message or buttons. They must return
 * an object with variables to inject into the session.
 *
 * @param {FlowSession} session - Current session state with variables and metadata
 * @param {string} session.flowName - Name of the current flow
 * @param {string} session.senderId - Unique identifier for the user
 * @param {string} session.channel - Channel the flow is running on (telegram, slack, etc.)
 * @param {Record<string, string | number>} session.variables - Previously captured variables
 * @returns {Promise<{historicalAverage: number}>} Object with variables to inject into session
 *
 * @example
 * // In flow JSON:
 * {
 *   "actions": {
 *     "fetch": { "historicalAverage": "getHistoricalAverage" }
 *   },
 *   "message": "Your average is {{historicalAverage}} pushups"
 * }
 */
export async function getHistoricalAverage(session) {
  // In real implementation: query Google Sheets
  if (mockHistory.length === 0) {
    return { historicalAverage: 25 };
  }

  const totals = mockHistory.map(w =>
    (w.set1 || 0) + (w.set2 || 0) + (w.set3 || 0) + (w.set4 || 0)
  );
  const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length / 4);

  return { historicalAverage: avg };
}

/**
 * BeforeRender action: Generate dynamic buttons based on historical average
 *
 * BeforeRender actions are called AFTER fetch actions to modify the
 * step before it's displayed to the user. They receive the step object
 * and can return a modified version with updated buttons, message, etc.
 *
 * @param {FlowStep} step - The step about to be rendered
 * @param {string} step.id - Unique identifier for the step
 * @param {string} step.message - Message text (can contain {{variable}} placeholders)
 * @param {Array<string | number | Button>} [step.buttons] - Optional buttons to display
 * @param {string} [step.capture] - Optional variable name to capture from user input
 * @param {FlowSession} session - Current session with variables (injected by fetch actions)
 * @param {Record<string, string | number>} session.variables - All captured and fetched variables
 * @returns {Promise<FlowStep>} Modified step with dynamic buttons
 *
 * @example
 * // In flow JSON:
 * {
 *   "actions": {
 *     "fetch": { "historicalAverage": "getHistoricalAverage" },
 *     "beforeRender": ["generateDynamicButtons"]
 *   }
 * }
 * // If historicalAverage is 25, generates buttons: [15, 20, 25, 30, 35]
 */
export async function generateDynamicButtons(step, session) {
  const avg = session.variables.historicalAverage || 25;
  const buttonStep = 5;
  const buttonCount = 5;

  const buttons = [];
  const start = avg - Math.floor(buttonCount / 2) * buttonStep;

  for (let i = 0; i < buttonCount; i++) {
    const value = start + i * buttonStep;
    if (value > 0) {
      buttons.push(value);
    }
  }

  return { ...step, buttons };
}

/**
 * AfterCapture action: Log reps to Google Sheets
 *
 * AfterCapture actions execute AFTER a variable is captured from user
 * input. They are used for side effects like logging, notifications,
 * or external API calls. Return values are ignored.
 *
 * @param {string} variable - Name of the variable that was captured
 * @param {string | number} value - Value captured from the user's input
 * @param {FlowSession} session - Current session state with all variables
 * @param {string} session.senderId - User ID for logging/tracking
 * @param {string} session.flowName - Flow name for context
 * @param {Record<string, string | number>} session.variables - All captured variables
 * @returns {Promise<void>} No return value (side effects only)
 *
 * @example
 * // In flow JSON:
 * {
 *   "id": "set1",
 *   "capture": "set1",
 *   "actions": {
 *     "afterCapture": ["logToSheets"]
 *   }
 * }
 * // When user enters "25", logToSheets("set1", 25, session) is called
 */
export async function logToSheets(variable, value, session) {
  // In real implementation: append to Google Sheets
  console.log(`[Google Sheets] ${variable} = ${value}`);

  // Find or create current workout
  let currentWorkout = mockWorkouts.find(w =>
    w.userId === session.senderId &&
    w.date === new Date().toISOString().split('T')[0]
  );

  if (!currentWorkout) {
    currentWorkout = {
      userId: session.senderId,
      date: new Date().toISOString().split('T')[0],
      flowName: session.flowName,
    };
    mockWorkouts.push(currentWorkout);
  }

  currentWorkout[variable] = value;
}

/**
 * Global lifecycle hooks (default export)
 */
export default {
  async onFlowComplete(session) {
    console.log('Flow completed! Variables:', session.variables);

    // Calculate total reps
    const total = (session.variables.set1 || 0) +
                  (session.variables.set2 || 0) +
                  (session.variables.set3 || 0) +
                  (session.variables.set4 || 0);

    console.log(`Total reps: ${total}`);

    // In real implementation: schedule next workout, send summary, etc.
  },

  async onFlowAbandoned(session, reason) {
    console.log(`Flow abandoned: ${reason}`);
    // In real implementation: log abandonment, send reminder, etc.
  }
};
