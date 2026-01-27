# Hooks & Actions Reference

This document covers:
1. **Step-Level Actions System** - How to write action functions
2. **Hooks Utility Library** - Pre-built integrations (work in progress)

## Step-Level Actions System

Skill-flow v1.0+ uses **explicit step-level actions** declared in flow JSON, replacing implicit global hooks.

### Quick Comparison

**Old Way (Global Hooks):**
```json
{ "id": "set1", "capture": "set1" }
```
```javascript
export default {
  async onStepRender(step, session) {
    if (step.id === 'set1') { /* logic */ }
  }
}
```

**New Way (Step-Level Actions):**
```json
{
  "id": "set1",
  "actions": {
    "fetch": { "avg": "getAverage" },
    "beforeRender": ["generateButtons"],
    "afterCapture": ["logToSheets"]
  }
}
```
```javascript
export async function getAverage(session) { /* ... */ }
export async function generateButtons(step, session) { /* ... */ }
export async function logToSheets(variable, value, session) { /* ... */ }
```

### Action Types

#### 1. Fetch Actions

**Purpose:** Get data before rendering (e.g., query database, fetch external data)

**Signature:**
```typescript
async function fetchAction(session: FlowSession): Promise<Record<string, any>>
```

**Returns:** Object with variables to inject into session

**Example:**
```javascript
export async function getHistoricalAverage(session) {
  const history = await querySheets(spreadsheetId);
  const totals = history.map(w => w.set1 + w.set2 + w.set3 + w.set4);
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length / 4;
  return { historicalAverage: Math.round(avg) };
}
```

**Usage in Flow:**
```json
{
  "actions": {
    "fetch": {
      "historicalAverage": "getHistoricalAverage"
    }
  }
}
```

#### 2. BeforeRender Actions

**Purpose:** Modify step before displaying to user (e.g., dynamic buttons, personalized messages)

**Signature:**
```typescript
async function beforeRenderAction(
  step: FlowStep,
  session: FlowSession
): Promise<FlowStep>
```

**Returns:** Modified step object

**Example:**
```javascript
export async function generateDynamicButtons(step, session) {
  const avg = session.variables.historicalAverage || 25;
  const buttons = [avg - 5, avg, avg + 5, avg + 10];
  return { ...step, buttons };
}
```

**Usage in Flow:**
```json
{
  "actions": {
    "beforeRender": ["generateDynamicButtons"]
  }
}
```

#### 3. AfterCapture Actions

**Purpose:** Side effects after capturing variable (e.g., logging, notifications, validation)

**Signature:**
```typescript
async function afterCaptureAction(
  variable: string,
  value: string | number,
  session: FlowSession
): Promise<void>
```

**Returns:** Nothing (side effects only)

**Example:**
```javascript
export async function logToSheets(variable, value, session) {
  await appendToSheet(spreadsheetId, 'Workouts', [{
    timestamp: new Date().toISOString(),
    userId: session.senderId,
    [variable]: value
  }]);
}
```

**Usage in Flow:**
```json
{
  "capture": "set1",
  "actions": {
    "afterCapture": ["logToSheets", "sendNotification"]
  }
}
```

### Action Execution Order

Actions execute in a **guaranteed sequential order** to ensure predictable behavior and access to previous results.

#### Per-Step Execution Flow

When a step is rendered, actions execute in this order:

1. **Fetch Actions** (sequential)
   ```json
   "fetch": {
     "var1": "action1",  // Executes first
     "var2": "action2"   // Executes second, can use var1
   }
   ```
   - Each fetch action waits for the previous to complete
   - Variables are injected immediately after each fetch completes
   - Subsequent fetch actions can access previously fetched variables
   - **Security:** Only the requested variable name is injected into session (e.g., if `var1` maps to `action1`, only `var1` from the action's return object is used)

2. **BeforeRender Actions** (sequential)
   ```json
   "beforeRender": ["action1", "action2", "action3"]
   ```
   - Execute in array order
   - Each receives the step modified by previous actions
   - Final modified step is rendered to user
   - All fetched variables are available in `session.variables`

3. **User Response** - User clicks button or sends input

4. **Variable Capture** - Input validated and stored in session

5. **AfterCapture Actions** (sequential)
   ```json
   "afterCapture": ["action1", "action2", "action3"]
   ```
   - Execute in array order after variable is captured
   - All receive the same captured value
   - Return values are ignored (side effects only)
   - Useful for logging, notifications, external API calls

#### Why Sequential?

Actions are awaited sequentially to ensure:
- **Predictable execution order** - No race conditions or timing issues
- **Data dependencies** - Later actions can use results from earlier actions
- **Easier debugging** - Linear execution flow is simpler to trace
- **Error handling** - Failures can be handled in order

#### Parallel Execution

If you need parallel execution for performance, do it **within a single action**:

```javascript
export async function fetchMultipleSources(session) {
  // Parallel fetches within one action
  const [weather, traffic, news] = await Promise.all([
    fetchWeather(),
    fetchTraffic(),
    fetchNews()
  ]);

  return { weather, traffic, news };
}
```

#### Execution Example

Given this step configuration:
```json
{
  "id": "workout",
  "message": "Ready for {{historicalAverage}} pushups?",
  "capture": "set1",
  "actions": {
    "fetch": {
      "historicalAverage": "getAverage"
    },
    "beforeRender": ["addMotivationalQuote", "generateButtons"],
    "afterCapture": ["logToSheets", "updateStreak"]
  }
}
```

Execution timeline:
1. `getAverage(session)` runs → returns `{historicalAverage: 25}`
2. Variable `historicalAverage` injected into `session.variables`
3. `addMotivationalQuote(step, session)` runs → returns modified step
4. `generateButtons(step, session)` runs → returns step with buttons
5. Modified step rendered to user with message "Ready for 25 pushups?"
6. User enters "30"
7. Value validated and stored: `session.variables.set1 = 30`
8. `logToSheets("set1", 30, session)` runs → logs to external sheet
9. `updateStreak("set1", 30, session)` runs → updates user streak
10. Flow continues to next step

### Global Lifecycle Hooks

For flow-level events (not step-specific), use the **default export**:

```javascript
export default {
  async onFlowComplete(session) {
    console.log('Flow completed!', session.variables);
    await scheduleNextSession();
  },

  async onFlowAbandoned(session, reason) {
    console.log('Flow abandoned:', reason);
    await logAbandonment(session, reason);
  }
};
```

### Complete Example

```javascript
// ~/.clawdbot/flows/pushups/hooks.js
import config from './config.json' assert { type: 'json' };

// Fetch action
export async function getHistoricalAverage(session) {
  const history = await querySheets(config.google.spreadsheetId);
  const avg = calculateAverage(history);
  return { historicalAverage: avg };
}

// BeforeRender action
export async function generateDynamicButtons(step, session) {
  const avg = session.variables.historicalAverage || 25;
  return { ...step, buttons: [avg - 5, avg, avg + 5, avg + 10] };
}

// AfterCapture actions
export async function logToSheets(variable, value, session) {
  await appendToSheet(config.google.spreadsheetId, 'Workouts', [{
    date: new Date().toISOString(),
    [variable]: value
  }]);
}

export async function sendProgressUpdate(variable, value, session) {
  // Send notification after each set
  console.log(`Great job! ${value} reps on ${variable}`);
}

// Global lifecycle hooks
export default {
  async onFlowComplete(session) {
    const total = Object.values(session.variables)
      .filter(v => typeof v === 'number')
      .reduce((a, b) => a + b, 0);
    console.log(`Workout complete! Total reps: ${total}`);
  }
};
```

---

## Configuration Features

### Environment Variables

Flows can inject environment variables into the session at flow start, making external configuration accessible to hooks without hardcoding secrets in flow JSON.

**Use cases:**
- API keys for external services (Google Sheets, Slack, etc.)
- Database connection strings
- Configuration IDs (spreadsheet IDs, channel IDs)
- Feature flags or environment-specific settings

#### Configuration

Add an `env` field to your flow metadata:

```json
{
  "name": "survey",
  "description": "Customer satisfaction survey",
  "version": "1.0.0",
  "env": {
    "spreadsheetId": "GOOGLE_SHEETS_ID",
    "slackWebhook": "SLACK_WEBHOOK_URL",
    "apiKey": "API_KEY"
  },
  "hooks": "./hooks.js",
  "steps": [...]
}
```

The `env` field maps session variable names (left) to environment variable names (right).

#### Behavior

When the flow starts:
1. Plugin reads each environment variable from `process.env`
2. If the variable exists, it's injected into `session.variables`
3. If the variable is missing, a warning is logged (flow continues)
4. Environment variables are available to all hooks and actions

#### Usage in Hooks

Access environment variables like any other session variable:

```javascript
export async function logToSheets(variable, value, session) {
  const spreadsheetId = session.variables.spreadsheetId;

  if (!spreadsheetId) {
    console.warn('Spreadsheet ID not configured, skipping log');
    return;
  }

  await appendToSheet(spreadsheetId, 'Survey Results', [{
    timestamp: new Date().toISOString(),
    [variable]: value
  }]);
}
```

#### Setting Environment Variables

**Option 1: Shell environment (development)**
```bash
export GOOGLE_SHEETS_ID="1a2b3c4d5e6f"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
clawdbot message send "/flow_start survey"
```

**Option 2: systemd service file (production)**
```ini
[Service]
Environment="GOOGLE_SHEETS_ID=1a2b3c4d5e6f"
Environment="SLACK_WEBHOOK_URL=https://hooks.slack.com/..."
ExecStart=/usr/bin/clawdbot gateway start
```

**Option 3: .env file (with dotenv)**
```bash
# .env
GOOGLE_SHEETS_ID=1a2b3c4d5e6f
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

```javascript
// In your application startup
import 'dotenv/config';
```

#### Security Best Practices

- **Never commit secrets** to git repositories
- **Use environment-specific variables** for dev/staging/prod
- **Validate presence** of required variables in hooks
- **Log warnings** when variables are missing (don't crash)
- **Use read-only API keys** when possible

#### Example: Conditional Actions with Environment Variables

Combine environment variables with conditional action execution:

```json
{
  "id": "rating",
  "message": "How would you rate our service?",
  "buttons": [1, 2, 3, 4, 5],
  "capture": "rating",
  "actions": {
    "afterCapture": [
      { "action": "logToSheets", "if": "spreadsheetId" },
      { "action": "sendSlackNotification", "if": "slackWebhook" }
    ]
  }
}
```

See [Conditional Action Execution](#conditional-action-execution) for details.

### Conditional Action Execution

Actions can be conditionally executed based on session variables, allowing flows to adapt behavior based on configuration, feature flags, or runtime state.

**Use cases:**
- Skip external API calls when credentials aren't configured
- Enable/disable features based on environment variables
- Conditional logging or notifications
- A/B testing with feature flags

#### Syntax

Actions are objects with an `action` field (function name) and an optional `if` field (condition):

```json
{
  "actions": {
    "afterCapture": [
      { "action": "alwaysExecute" },
      { "action": "conditionalAction", "if": "featureEnabled" }
    ]
  }
}
```

- **`action`**: Required. Name of the action function to execute.
- **`if`**: Optional. Variable name to check. Action executes only if the variable is **truthy** (non-empty string, non-zero number, true boolean). Omit for always execute.

#### Fetch Actions with Conditions

```json
{
  "id": "rating",
  "actions": {
    "fetch": {
      "historicalData": { "action": "getFromSheets", "if": "spreadsheetId" },
      "averageRating": { "action": "calculateAverage" }
    }
  }
}
```

- `getFromSheets` only executes if `session.variables.spreadsheetId` is truthy
- `calculateAverage` always executes (no `if` field)

#### BeforeRender Actions with Conditions

```json
{
  "id": "workout",
  "actions": {
    "beforeRender": [
      { "action": "addMotivation", "if": "motivationEnabled" },
      { "action": "generateButtons" }
    ]
  }
}
```

- `addMotivation` only executes if `session.variables.motivationEnabled` is truthy
- `generateButtons` always executes (no `if` field)

#### AfterCapture Actions with Conditions

```json
{
  "id": "feedback",
  "capture": "rating",
  "actions": {
    "afterCapture": [
      { "action": "logToSheets", "if": "spreadsheetId" },
      { "action": "sendSlackNotification", "if": "slackWebhook" },
      { "action": "sendEmail", "if": "emailEnabled" }
    ]
  }
}
```

Each action executes only if its condition variable is truthy.

#### Truthy/Falsy Evaluation

Actions execute when the condition variable is **truthy**:

**Truthy (executes):**
- Non-empty string: `"1a2b3c"`, `"true"`, `"enabled"`
- Non-zero number: `1`, `42`, `-1`
- Boolean true: `true`

**Falsy (skips):**
- Undefined variable (not in session)
- Empty string: `""`
- Zero: `0`
- Boolean false: `false`
- Null: `null`

#### Complete Example

```json
{
  "name": "survey",
  "description": "Customer survey with optional integrations",
  "version": "1.0.0",
  "env": {
    "spreadsheetId": "GOOGLE_SHEETS_ID",
    "slackWebhook": "SLACK_WEBHOOK_URL",
    "analyticsEnabled": "ANALYTICS_ENABLED"
  },
  "hooks": "./hooks.js",
  "steps": [
    {
      "id": "rating",
      "message": "Rate our service (1-5)",
      "buttons": [1, 2, 3, 4, 5],
      "capture": "rating",
      "actions": {
        "fetch": {
          "averageRating": { "action": "getAverageRating", "if": "spreadsheetId" }
        },
        "beforeRender": [
          { "action": "addAverageToMessage", "if": "averageRating" }
        ],
        "afterCapture": [
          { "action": "logToSheets", "if": "spreadsheetId" },
          { "action": "sendSlackNotification", "if": "slackWebhook" },
          { "action": "trackAnalytics", "if": "analyticsEnabled" }
        ]
      },
      "next": "feedback"
    }
  ]
}
```

**Behavior:**
1. If `GOOGLE_SHEETS_ID` is set: fetch average rating, log response to Sheets
2. If `SLACK_WEBHOOK_URL` is set: send notification to Slack
3. If `ANALYTICS_ENABLED` is set (e.g., `"true"`): track analytics
4. All actions gracefully skip if their condition isn't met

#### Debugging

When actions are skipped due to unmet conditions, a debug log is written:

```
Skipping afterCapture action "logToSheets" - condition not met
```

Enable debug logging in Clawdbot to see which actions are being skipped.

#### Best Practices

**1. Fail gracefully in hooks:**
```javascript
export async function logToSheets(variable, value, session) {
  const spreadsheetId = session.variables.spreadsheetId;

  if (!spreadsheetId) {
    console.warn('Spreadsheet ID not configured, skipping log');
    return; // Graceful fallback
  }

  await appendToSheet(spreadsheetId, { [variable]: value });
}
```

**2. Use environment variables for configuration:**
```json
{
  "env": {
    "featureEnabled": "FEATURE_FLAG"
  },
  "steps": [{
    "actions": {
      "afterCapture": [
        { "action": "newFeature", "if": "featureEnabled" }
      ]
    }
  }]
}
```

**3. Combine with fetch actions:**
```json
{
  "actions": {
    "fetch": {
      "config": "loadConfig"
    },
    "afterCapture": [
      { "action": "useConfig", "if": "config" }
    ]
  }
}
```

---

## Hooks Utility Library

**Note:** The utility library is being updated to work with the new step-level actions system. The documentation below reflects the legacy API and will be updated soon.

### Overview

Pre-built integrations and helpers for common patterns:

- **Google Sheets**: Log flow data and query history
- **Dynamic Buttons**: Generate button options based on historical data
- **Scheduling**: Schedule recurring workflow sessions
- **Common Utilities**: Compose hooks, retry logic, validation

## Installation

The hooks library is included with the skill-flow plugin:

```bash
npm install @joshualelon/clawdbot-skill-flow
```

**Google Sheets Integration:** If you plan to use Google Sheets utilities, install googleapis separately (145MB):

```bash
npm install googleapis
```

This is an optional peer dependency - only install if needed.

## Usage

Import utilities from the hooks submodule:

```javascript
// Import specific utilities
import { createSheetsLogger } from '@joshualelon/clawdbot-skill-flow/hooks/google-sheets';
import { createDynamicButtons } from '@joshualelon/clawdbot-skill-flow/hooks/dynamic-buttons';

// Or import from main hooks export
import { composeHooks, withRetry } from '@joshualelon/clawdbot-skill-flow/hooks';
```

## Google Sheets Integration

Log flow data to Google Sheets for analysis and reporting.

### Setup

1. Create a Google Cloud service account
2. Download the service account JSON key
3. Share your spreadsheet with the service account email
4. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Basic Usage

```javascript
// ~/.clawdbot/flows/pushups/hooks.js
import { createSheetsLogger } from '@joshualelon/clawdbot-skill-flow/hooks/google-sheets';

export default {
  onCapture: createSheetsLogger({
    spreadsheetId: '1ABC...xyz',
    worksheetName: 'Workouts',
    columns: ['set1', 'set2', 'set3', 'set4'],
    includeMetadata: true
  })
};
```

### API Reference

#### `createSheetsLogger(options)`

Create a hook that logs captured variables to Google Sheets.

**Options:**
- `spreadsheetId` (string, required): The Google Sheets ID
- `worksheetName` (string, optional): Name of the worksheet (default: "Sheet1")
- `columns` (string[], optional): Variable names to log (default: all variables)
- `includeMetadata` (boolean, optional): Add timestamp, userId, flowName (default: true)
- `credentials` (object, optional): Service account credentials (default: from environment)

#### `appendToSheet(spreadsheetId, worksheetName, rows, credentials?)`

Low-level utility to append rows to a Google Sheet.

```javascript
await appendToSheet('1ABC...xyz', 'Workouts', [
  { date: '2026-01-25', reps: 20, weight: 45 },
  { date: '2026-01-26', reps: 22, weight: 45 }
]);
```

#### `querySheetHistory(spreadsheetId, worksheetName, filters?, credentials?)`

Query historical data from a Google Sheet.

```javascript
const history = await querySheetHistory('1ABC...xyz', 'Workouts', {
  flowName: 'pushups',
  userId: 'user123',
  dateRange: [new Date('2026-01-01'), new Date()]
});
```

## Dynamic Buttons

Generate button options based on historical data.

### Basic Usage

```javascript
// ~/.clawdbot/flows/pushups/hooks.js
import { createDynamicButtons } from '@joshualelon/clawdbot-skill-flow/hooks/dynamic-buttons';

export default {
  onStepRender: createDynamicButtons({
    spreadsheetId: '1ABC...xyz',
    variable: 'reps',
    strategy: 'centered',
    buttonCount: 5,
    step: 5
  })
};
```

### Strategies

#### Centered

Buttons centered around the historical average.

```javascript
// If average is 20:
// Buttons: [10, 15, 20, 25, 30]
strategy: 'centered'
```

#### Progressive

Increasing difficulty from the average.

```javascript
// If average is 20:
// Buttons: [20, 25, 30, 35, 40]
strategy: 'progressive'
```

#### Range

Evenly-spaced range around the average.

```javascript
// If average is 25:
// Buttons: [15, 20, 25, 30, 35]
strategy: 'range'
```

### API Reference

#### `createDynamicButtons(config)`

Create a hook that generates dynamic buttons based on historical data.

**Config:**
- `spreadsheetId` (string, optional): Load history from Google Sheets
- `historyFile` (string, optional): Or load from local .jsonl file
- `variable` (string, required): Which variable to generate buttons for
- `strategy` (string, required): "centered" | "progressive" | "range"
- `buttonCount` (number, optional): How many buttons (default: 5)
- `step` (number, optional): Increment between buttons (default: 5)

#### `getRecentAverage(variable, history, count?)`

Calculate the recent average value for a variable.

```javascript
const avgReps = await getRecentAverage('reps', history, 10);
```

#### `generateButtonRange(center, count, step, strategy)`

Generate a range of button values.

```javascript
const buttons = generateButtonRange(20, 5, 5, 'centered');
// Returns: [10, 15, 20, 25, 30]
```

## LLM Adapter

Dynamically adapt step messages and button labels using AI based on session context.

### Basic Usage

```javascript
// ~/.clawdbot/flows/pushups/hooks.js
import { createLLMAdapter } from '@joshualelon/clawdbot-skill-flow/hooks/llm-adapter';

export default (api) => ({
  onStepRender: createLLMAdapter(api, {
    adaptMessage: true,
    adaptButtons: true,
    includeVariables: true
  })
});
```

### Features

The LLM adapter makes your flows more engaging by:
- **Personalizing messages** based on what the user has shared
- **Adapting button labels** to be contextual and encouraging
- **Maintaining intent** while making content more natural
- **Graceful fallback** if LLM calls fail

### Configuration Options

#### When to Adapt

```javascript
createLLMAdapter(api, {
  enabled: true,                        // Enable/disable adapter (default: true)
  stepFilter: (step) => step.id.startsWith('feedback'),  // Only adapt certain steps
  userFilter: (session) => Object.keys(session.variables).length > 2  // Only for engaged users
})
```

#### What to Adapt

```javascript
createLLMAdapter(api, {
  adaptMessage: true,                   // Adapt step message (default: true)
  adaptButtons: true,                   // Adapt button labels (default: true)
  preserveButtonValues: true            // Keep original values, adapt labels only (default: true)
})
```

#### LLM Settings

```javascript
createLLMAdapter(api, {
  temperature: 0.7,                     // Creativity level (default: 0.7)
  maxTokens: 500                        // Max response tokens (default: 500)
})
```

**Note:** Uses Clawdbot's Claude configuration automatically. Provider/model inherited from Clawdbot.

#### Context to Include

```javascript
createLLMAdapter(api, {
  includeVariables: true,               // Include captured variables (default: true)
  includeFlowMetadata: false,           // Include flow name/version (default: false)
  maxContextTokens: 2000                // Limit context size (default: 2000)
})
```

#### Behavior

```javascript
createLLMAdapter(api, {
  fallbackToOriginal: true              // Use original step on error (default: true)
})
```

### Examples

#### Basic Personalization

```javascript
// Adapts messages based on captured variables
import { createLLMAdapter } from '@joshualelon/clawdbot-skill-flow/hooks/llm-adapter';

export default (api) => ({
  onStepRender: createLLMAdapter(api, {
    adaptMessage: true,
    includeVariables: true
  })
});
```

#### Button-Aware Adaptation

```javascript
// Adapts both messages and button labels
import { createLLMAdapter } from '@joshualelon/clawdbot-skill-flow/hooks/llm-adapter';

export default (api) => ({
  onStepRender: createLLMAdapter(api, {
    adaptMessage: true,
    adaptButtons: true,
    preserveButtonValues: true,  // Keep values, just adapt labels
    includeVariables: true
  })
});
```

#### Selective Adaptation

```javascript
// Only adapt certain steps
import { createLLMAdapter } from '@joshualelon/clawdbot-skill-flow/hooks/llm-adapter';

export default (api) => ({
  onStepRender: createLLMAdapter(api, {
    stepFilter: (step) => step.id.startsWith('feedback'),
    adaptMessage: true,
    includeVariables: true
  })
});
```

#### Composed with Dynamic Buttons

```javascript
// Combine dynamic buttons with LLM adaptation
import { composeHooks } from '@joshualelon/clawdbot-skill-flow/hooks';
import { createDynamicButtons } from '@joshualelon/clawdbot-skill-flow/hooks/dynamic-buttons';
import { createLLMAdapter } from '@joshualelon/clawdbot-skill-flow/hooks/llm-adapter';

export default (api) => ({
  onStepRender: composeHooks(
    // First: Generate button values from history
    createDynamicButtons({
      variable: 'reps',
      strategy: 'centered',
      historyFile: '~/.clawdbot/history/pushups.jsonl'
    }),
    // Then: Adapt message and button labels with LLM
    createLLMAdapter(api, {
      adaptMessage: true,
      adaptButtons: true,
      preserveButtonValues: true,
      includeVariables: true
    })
  )
});
```

### API Reference

#### `createLLMAdapter(api, config)`

Create a hook that adapts steps using AI.

**Parameters:**
- `api` (ClawdbotPluginApi, required): Plugin API instance for LLM access
- `config` (LLMAdapterConfig, optional): Adapter configuration

**Returns:** `FlowHooks["onStepRender"]` - Hook function for step adaptation

**Configuration:**
- `enabled` (boolean, optional): Enable/disable adapter (default: true)
- `stepFilter` (function, optional): Filter which steps to adapt
- `userFilter` (function, optional): Filter which users/sessions to adapt for
- `adaptMessage` (boolean, optional): Adapt step message (default: true)
- `adaptButtons` (boolean, optional): Adapt button labels (default: true)
- `preserveButtonValues` (boolean, optional): Keep original values (default: true)
- `temperature` (number, optional): Creativity level (default: 0.7)
- `maxTokens` (number, optional): Max tokens (default: 500)
- `includeVariables` (boolean, optional): Include captured vars (default: true)
- `includeFlowMetadata` (boolean, optional): Include flow metadata (default: false)
- `maxContextTokens` (number, optional): Limit context size (default: 2000)
- `fallbackToOriginal` (boolean, optional): Use original on error (default: true)

### Best Practices

**When to Use:**
- User engagement flows (onboarding, surveys, check-ins)
- Repeated workflows where context matters
- Flows with varying user progress/patterns
- When you want more natural conversation

**Cost Considerations:**
- Each step adaptation makes an LLM call
- Use `stepFilter` to adapt only important steps
- Use `userFilter` to adapt only for engaged users
- Consider caching if implementing custom solutions

**Performance:**
- Adaptations add ~1-2 seconds per step (depends on LLM)
- Set reasonable `timeout` values (default: 5000ms)
- Use `fallbackToOriginal: true` for reliability
- Consider user experience vs. personalization tradeoff

**Composition:**
- Compose with `createDynamicButtons` for powerful patterns
- Put dynamic buttons first, then LLM adaptation
- This generates values from history, then adapts labels

## Scheduling

Schedule recurring workflow sessions.

### Basic Usage

```javascript
// ~/.clawdbot/flows/pushups/hooks.js
import { createScheduler } from '@joshualelon/clawdbot-skill-flow/hooks/scheduling';

export default {
  onFlowComplete: createScheduler({
    days: ['mon', 'wed', 'fri'],
    time: '08:00',
    timezone: 'America/Chicago',
    calendarCheck: true
  })
};
```

### API Reference

#### `createScheduler(config)`

Create a hook that schedules the next workflow session after completion.

**Config:**
- `days` (string[], optional): Days of week (default: ['mon', 'wed', 'fri'])
- `time` (string, optional): Time in HH:MM format (default: '08:00')
- `timezone` (string, optional): IANA timezone (default: 'UTC')
- `calendarCheck` (boolean, optional): Check for conflicts (default: false)
- `rescheduleOnConflict` (boolean, optional): Find alternative slot (default: false)

**Note:** The scheduling utilities are placeholders that log schedules. Integrate with your scheduling system (cron, job queue, etc.) by wrapping the `scheduleNextSession` function.

#### `scheduleNextSession(flowName, userId, nextDate)`

Schedule the next workflow session.

```javascript
await scheduleNextSession('pushups', 'user123', new Date('2026-01-27T08:00:00Z'));
```

#### `checkCalendarConflicts(dateTime, duration?)`

Check if there are calendar conflicts at the given time.

```javascript
const hasConflict = await checkCalendarConflicts(new Date('2026-01-27T08:00:00Z'), 60);
```

#### `findNextAvailableSlot(preferredDates, duration)`

Find the next available time slot.

```javascript
const nextSlot = await findNextAvailableSlot([new Date('2026-01-27T08:00:00Z')], 60);
```

## Common Utilities

General-purpose utilities for hook composition and error handling.

### Compose Hooks

Combine multiple hooks into a single hook.

```javascript
import { composeHooks } from '@joshualelon/clawdbot-skill-flow/hooks';
import { createSheetsLogger } from '@joshualelon/clawdbot-skill-flow/hooks/google-sheets';

const notifySlack = async (variable, value, session) => {
  // Custom notification logic
};

export default {
  onCapture: composeHooks(
    createSheetsLogger({ spreadsheetId: '...' }),
    notifySlack
  )
};
```

### Retry with Backoff

Retry operations with exponential backoff.

```javascript
import { withRetry } from '@joshualelon/clawdbot-skill-flow/hooks';

const data = await withRetry(
  () => fetch('https://api.example.com/data'),
  { maxAttempts: 3, delayMs: 1000, backoff: true }
);
```

### Validation Helpers

```javascript
import { validateEmail, validateNumber, validatePhone } from '@joshualelon/clawdbot-skill-flow/hooks';

// Email validation
if (!validateEmail(value)) {
  throw new Error('Invalid email');
}

// Number validation with bounds
if (!validateNumber(value, 0, 100)) {
  throw new Error('Number must be between 0 and 100');
}

// Phone validation
if (!validatePhone(value)) {
  throw new Error('Invalid phone number');
}
```

### Conditional Hooks

Only run a hook if a condition is met.

```javascript
import { whenCondition } from '@joshualelon/clawdbot-skill-flow/hooks';
import { createSheetsLogger } from '@joshualelon/clawdbot-skill-flow/hooks/google-sheets';

export default {
  onCapture: whenCondition(
    (session) => session.variables.score > 100,
    createSheetsLogger({ spreadsheetId: '...' })
  )
};
```

### Rate Limiting

Debounce or throttle hook execution.

```javascript
import { debounceHook, throttleHook } from '@joshualelon/clawdbot-skill-flow/hooks';

// Debounce: wait for quiet period before executing
const debouncedHook = debounceHook(myHook, 1000);

// Throttle: ensure minimum time between executions
const throttledHook = throttleHook(myHook, 5000);
```

## API Reference

### Common Functions

- `composeHooks<T>(...hooks): HookFunction<T>` - Combine multiple hooks
- `withRetry<T>(fn, options): Promise<T>` - Retry with exponential backoff
- `validateEmail(value): boolean` - Validate email format
- `validateNumber(value, min?, max?): boolean` - Validate number with bounds
- `validatePhone(value): boolean` - Validate phone format
- `whenCondition<T>(condition, hook): HookFunction<T>` - Conditional execution
- `debounceHook<T>(hook, delayMs): HookFunction<T>` - Debounce hook
- `throttleHook<T>(hook, intervalMs): HookFunction<T>` - Throttle hook

## Examples

### Complete Workout Tracker

```javascript
// ~/.clawdbot/flows/pushups/hooks.js
import {
  composeHooks,
  createSheetsLogger,
  createDynamicButtons,
  createScheduler
} from '@joshualelon/clawdbot-skill-flow/hooks';

export default {
  // Generate buttons based on history
  onStepRender: createDynamicButtons({
    spreadsheetId: '1ABC...xyz',
    variable: 'reps',
    strategy: 'centered',
    buttonCount: 5,
    step: 5
  }),

  // Log to Google Sheets
  onCapture: createSheetsLogger({
    spreadsheetId: '1ABC...xyz',
    worksheetName: 'Workouts',
    includeMetadata: true
  }),

  // Schedule next session
  onFlowComplete: createScheduler({
    days: ['mon', 'wed', 'fri'],
    time: '08:00',
    timezone: 'America/Chicago'
  })
};
```

### Custom Integration

```javascript
// ~/.clawdbot/flows/survey/hooks.js
import { composeHooks, withRetry } from '@joshualelon/clawdbot-skill-flow/hooks';
import { createSheetsLogger } from '@joshualelon/clawdbot-skill-flow/hooks/google-sheets';

// Custom webhook notification
const notifyWebhook = async (variable, value, session) => {
  await withRetry(
    () => fetch('https://hooks.example.com/survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variable, value, session })
    }),
    { maxAttempts: 3, backoff: true }
  );
};

export default {
  onCapture: composeHooks(
    createSheetsLogger({ spreadsheetId: '...' }),
    notifyWebhook
  )
};
```

## TypeScript Support

Full TypeScript types are exported:

```typescript
import type {
  FlowHooks,
  SheetsLogOptions,
  DynamicButtonsConfig,
  ScheduleConfig,
  HookFunction,
  RetryOptions
} from '@joshualelon/clawdbot-skill-flow/hooks';
```

## License

MIT
