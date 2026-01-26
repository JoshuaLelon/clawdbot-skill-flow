# Hooks Utility Library

Optional utilities for common workflow patterns in Skill Flow.

## Overview

The hooks library provides pre-built integrations and helpers for:

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
