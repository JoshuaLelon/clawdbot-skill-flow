# Declarative Actions Reference

Declarative actions let you configure common operations directly in your flow JSON without writing JavaScript.

## Table of Contents

- [Quick Start](#quick-start)
- [Action Structure](#action-structure)
- [Variable Interpolation](#variable-interpolation)
- [Conditional Execution](#conditional-execution)
- [Built-in Actions](#built-in-actions)
- [Custom Actions](#custom-actions)

## Quick Start

### Before (with hooks.js)

```javascript
// hooks.js
export async function logToSheets(variable, value, session, api) {
  await api.hooks.appendToSheet('sheet-id', {
    timestamp: new Date().toISOString(),
    userId: session.senderId,
    [variable]: value
  });
}
```

```json
// metadata.json
{
  "hooks": "./hooks.js",
  "steps": [{
    "actions": {
      "afterCapture": [{"action": "logToSheets"}]
    }
  }]
}
```

### After (declarative only)

```json
{
  "env": {
    "SPREADSHEET_ID": "GOOGLE_SPREADSHEET_ID"
  },
  "steps": [{
    "actions": {
      "afterCapture": [{
        "type": "sheets.append",
        "config": {
          "spreadsheetId": "{{env.SPREADSHEET_ID}}",
          "worksheetName": "Responses",
          "columns": ["timestamp", "userId", "answer"],
          "includeMetadata": true
        }
      }]
    }
  }]
}
```

## Action Structure

Every declarative action has three parts:

```json
{
  "type": "action.name",           // Required: Action type
  "config": { },                   // Required: Configuration object
  "if": { }                        // Optional: Condition
}
```

### Action Types

Actions are organized by category (prefix):
- `sheets.*` - Google Sheets operations
- `buttons.*` - Dynamic button generation
- `schedule.*` - Scheduling and reminders
- `notify.*` - Notifications
- `data.*` - Data transformation
- `http.*` - HTTP requests

## Variable Interpolation

Use `{{...}}` syntax to reference variables in config values:

### Available Contexts

```json
{
  "config": {
    "text": "Hello {{variables.name}}!",                    // Session variables
    "userId": "{{session.senderId}}",                      // Session properties
    "apiKey": "{{env.API_KEY}}",                          // Environment variables
    "timestamp": "{{timestamp.now}}",                      // Current time
    "weekAgo": "{{timestamp.daysAgo(7)}}",                // 7 days ago
    "total": "{{math.sum(variables.a, variables.b)}}",    // Math functions
    "message": "{{string.upper(variables.name)}}"         // String functions
  }
}
```

### Built-in Functions

**Timestamp:**
- `{{timestamp.now}}` - Current ISO timestamp
- `{{timestamp.daysAgo(n)}}` - N days ago
- `{{timestamp.hoursAgo(n)}}` - N hours ago
- `{{timestamp.format(date, "YYYY-MM-DD")}}` - Format date

**Math:**
- `{{math.sum(a, b, c)}}` - Sum values
- `{{math.average(a, b, c)}}` - Average values
- `{{math.min(a, b, c)}}` - Minimum value
- `{{math.max(a, b, c)}}` - Maximum value
- `{{math.round(value, decimals)}}` - Round number

**String:**
- `{{string.upper(text)}}` - Uppercase
- `{{string.lower(text)}}` - Lowercase
- `{{string.capitalize(text)}}` - Capitalize first letter
- `{{string.concat(a, b, c)}}` - Concatenate strings

### Arithmetic Expressions

Simple arithmetic is supported:

```json
{
  "total": "{{variables.set1 + variables.set2}}",
  "average": "{{variables.total / 4}}",
  "percentage": "{{variables.score * 100}}"
}
```

## Conditional Execution

Actions can include conditions using the `if` field:

### Simple Condition

```json
{
  "type": "notify.telegram",
  "config": { "text": "Low score alert!" },
  "if": {
    "variable": "score",
    "operator": "lessThan",
    "value": 50
  }
}
```

### Comparison Operators

| Operator | Aliases | Description |
|----------|---------|-------------|
| `equals` | `eq` | Equality check |
| `notEquals` | `ne` | Inequality check |
| `greaterThan` | `gt` | Greater than |
| `greaterThanOrEqual` | `gte` | Greater than or equal |
| `lessThan` | `lt` | Less than |
| `lessThanOrEqual` | `lte` | Less than or equal |
| `contains` | - | String contains substring |
| `startsWith` | - | String starts with |
| `endsWith` | - | String ends with |
| `matches` | - | Regex match |
| `in` | - | Value in array |
| `exists` | - | Variable is defined |

### Logical Combinators

**AND - All conditions must be true:**

```json
{
  "if": {
    "and": [
      { "variable": "score", "operator": "gt", "value": 80 },
      { "variable": "attempts", "operator": "lt", "value": 3 }
    ]
  }
}
```

**OR - Any condition must be true:**

```json
{
  "if": {
    "or": [
      { "variable": "role", "operator": "equals", "value": "admin" },
      { "variable": "role", "operator": "equals", "value": "moderator" }
    ]
  }
}
```

**NOT - Negate condition:**

```json
{
  "if": {
    "not": {
      "variable": "status",
      "operator": "equals",
      "value": "completed"
    }
  }
}
```

**Complex conditions:**

```json
{
  "if": {
    "and": [
      {
        "or": [
          { "variable": "plan", "operator": "equals", "value": "premium" },
          { "variable": "plan", "operator": "equals", "value": "enterprise" }
        ]
      },
      { "variable": "credits", "operator": "gt", "value": 0 }
    ]
  }
}
```

## Built-in Actions

### Google Sheets

#### sheets.append

Append rows to a Google Sheet:

```json
{
  "type": "sheets.append",
  "config": {
    "spreadsheetId": "{{env.SPREADSHEET_ID}}",
    "worksheetName": "Responses",
    "columns": ["timestamp", "userId", "answer"],
    "includeMetadata": true,
    "headerMode": "append"
  }
}
```

**Config:**
- `spreadsheetId` (string, required) - Google Sheets ID
- `worksheetName` (string, default: "Sheet1") - Worksheet name
- `columns` (string[], optional) - Column names (or all variables if omitted)
- `includeMetadata` (boolean, default: true) - Include timestamp/userId/flowName/channel
- `headerMode` ("append" | "overwrite" | "strict", default: "append")
  - `append` - Add new columns if missing
  - `overwrite` - Replace all headers
  - `strict` - Error if headers don't match
- `credentials` (object, optional) - Service account credentials

#### sheets.query

Query historical data from a Google Sheet:

```json
{
  "type": "sheets.query",
  "config": {
    "spreadsheetId": "{{env.SPREADSHEET_ID}}",
    "worksheetName": "Responses",
    "filters": {
      "flowName": "survey",
      "userId": "{{session.senderId}}",
      "dateRange": ["2026-01-01T00:00:00Z", "{{timestamp.now}}"]
    }
  }
}
```

**Returns:** Array of row objects

#### sheets.create

Create a new Google Spreadsheet:

```json
{
  "type": "sheets.create",
  "config": {
    "title": "Survey Responses 2026",
    "worksheetName": "Responses",
    "headers": ["timestamp", "userId", "rating", "feedback"],
    "folderId": "{{env.DRIVE_FOLDER_ID}}",
    "useGogOAuth": true
  }
}
```

**Configuration:**
- `title` (string, required): Spreadsheet title
- `worksheetName` (string, default: "Sheet1"): Name of the first worksheet
- `headers` (string[], optional): Column headers
- `folderId` (string, optional): Google Drive folder ID to move the spreadsheet to
- `useGogOAuth` (boolean, default: true): Use gog CLI OAuth instead of service account
  - **Important:** Set to `true` to avoid service account quota issues
  - Requires `gog` CLI tool to be installed and authenticated
  - Requires environment variables:
    - `GOG_ACCOUNT`: Your Google account email (e.g., `user@example.com`)
    - `GOOGLE_CLIENT_ID`: OAuth client ID
    - `GOOGLE_CLIENT_SECRET`: OAuth client secret
  - Uses your personal OAuth credentials instead of service account

**Returns:** `{ spreadsheetId, spreadsheetUrl }`

**Note:** Service accounts have zero Drive storage quota, so spreadsheet creation fails by default. Use `useGogOAuth: true` (the default) to use your personal Google account's quota via the gog CLI tool.

**Environment Setup:**
```bash
# Required for gog OAuth
export GOG_ACCOUNT="your-email@example.com"
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"

# Authenticate with gog
gog auth login
```

### Button Generation

#### buttons.generateRange

Generate dynamic buttons based on historical data:

```json
{
  "type": "buttons.generateRange",
  "config": {
    "variable": "reps",
    "spreadsheetId": "{{env.SPREADSHEET_ID}}",
    "worksheetName": "Workouts",
    "strategy": "centered",
    "buttonCount": 5,
    "step": 5,
    "recentCount": 10,
    "minValue": 0
  }
}
```

**Config:**
- `variable` (string, required) - Variable name to generate buttons for
- `spreadsheetId` (string, optional) - Load history from Google Sheets
- `worksheetName` (string, default: "Sheet1") - Worksheet name
- `strategy` ("centered" | "progressive" | "range", default: "centered")
  - `centered` - Buttons centered around average: [avg-2*step, avg-step, avg, avg+step, avg+2*step]
  - `progressive` - Increasing from average: [avg, avg+step, avg+2*step, ...]
  - `range` - Evenly spaced range around average
- `buttonCount` (number, default: 5) - Number of buttons
- `step` (number, default: 5) - Increment between buttons
- `recentCount` (number, default: 10) - Number of recent values to average
- `minValue` (number, optional) - Minimum button value

**Example:** If average is 25, strategy "centered", count 5, step 5:
- Buttons: [15, 20, 25, 30, 35]

**Modifies:** Returns modified step with generated buttons

### Scheduling

#### schedule.cron

Schedule recurring tasks using ClawdBot native cron:

```json
{
  "type": "schedule.cron",
  "config": {
    "schedule": "0 8 * * 1,3,5",
    "timezone": "America/Los_Angeles",
    "message": "/flow_start workout",
    "channel": "telegram",
    "to": "{{session.senderId}}",
    "name": "workout-reminder",
    "sessionType": "isolated",
    "deleteAfterRun": false
  }
}
```

**Config:**
- `schedule` (string, required) - Cron expression
- `timezone` (string, optional) - Timezone (e.g., "America/Los_Angeles")
- `message` (string, required) - Message to send
- `channel` (string, required) - Channel/platform
- `to` (string, required) - Target user/chat
- `name` (string, optional) - Job name
- `sessionType` ("main" | "isolated", default: "isolated")
- `deleteAfterRun` (boolean, default: false)

#### schedule.oneTime

Schedule a one-time reminder:

```json
{
  "type": "schedule.oneTime",
  "config": {
    "date": "{{timestamp.hoursAgo(-24)}}",
    "message": "Don't forget your workout!",
    "channel": "telegram",
    "to": "{{session.senderId}}"
  }
}
```

#### schedule.calendar

Create Google Calendar event:

```json
{
  "type": "schedule.calendar",
  "config": {
    "flowName": "{{session.flowName}}",
    "senderId": "{{session.senderId}}",
    "date": "{{timestamp.daysAgo(-1)}}",
    "calendarId": "primary"
  }
}
```

### Notifications

#### notify.telegram

Send Telegram message:

```json
{
  "type": "notify.telegram",
  "config": {
    "text": "🎉 You completed the workout!\n\nTotal: {{variables.total}} reps",
    "to": "{{session.senderId}}",
    "parseMode": "Markdown"
  }
}
```

**Config:**
- `text` (string, required) - Message text
- `to` (string, optional) - Target user (defaults to current sender)
- `parseMode` ("Markdown" | "HTML", optional) - Text formatting

### Data Transformation

#### data.transform

Transform data with operations:

```json
{
  "type": "data.transform",
  "config": {
    "operation": "sum",
    "inputs": ["{{variables.set1}}", "{{variables.set2}}", "{{variables.set3}}"]
  }
}
```

**Operations:**
- `sum` - Sum all inputs
- `average` - Average of inputs
- `min` - Minimum value
- `max` - Maximum value
- `concat` - Concatenate strings
- `format` - Format string with placeholders

**Returns:** `{ result: value }`

### HTTP Requests

#### http.request

Make HTTP request:

```json
{
  "type": "http.request",
  "config": {
    "url": "https://api.example.com/webhooks",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer {{env.API_TOKEN}}"
    },
    "body": {
      "event": "flow_completed",
      "user": "{{session.senderId}}",
      "data": "{{variables}}"
    },
    "timeout": 10000,
    "retries": 3
  }
}
```

**Config:**
- `url` (string, required) - URL to request
- `method` ("GET" | "POST" | "PUT" | "PATCH" | "DELETE", default: "POST")
- `headers` (object, optional) - Request headers
- `body` (object, optional) - Request body (not allowed for GET)
- `timeout` (number, default: 10000) - Timeout in milliseconds
- `retries` (number, default: 3) - Number of retry attempts

## Custom Actions

Advanced users can create custom action packages:

### 1. Create Package

```typescript
// @mycompany/clawdbot-actions/index.ts
import { z } from "zod";
import type { ActionDefinition } from "@joshualelon/clawdbot-skill-flow/engine/action-registry";

export default {
  namespace: "mycompany",
  actions: {
    "salesforce.createLead": {
      schema: z.object({
        email: z.string().email(),
        name: z.string(),
        company: z.string().optional(),
      }),
      execute: async (config, context) => {
        const { api, session } = context;

        // Your implementation
        await fetch("https://api.salesforce.com/...", {
          method: "POST",
          body: JSON.stringify(config),
        });

        api.logger.info(`Created Salesforce lead for ${config.email}`);
      }
    }
  }
};
```

### 2. Publish Package

```bash
npm publish @mycompany/clawdbot-actions
```

### 3. Use in Flow

```json
{
  "name": "lead-capture",
  "actions": {
    "imports": ["@mycompany/clawdbot-actions"]
  },
  "steps": [{
    "actions": {
      "afterCapture": [{
        "type": "mycompany.salesforce.createLead",
        "config": {
          "email": "{{variables.email}}",
          "name": "{{variables.name}}",
          "company": "{{variables.company}}"
        }
      }]
    }
  }]
}
```

### Action Context

Actions receive a `context` object with:

```typescript
interface ActionContext {
  session: FlowSession;           // Current session state
  api: ClawdbotPluginApi;         // Plugin API for logging, etc.
  step?: FlowStep;                // Current step (for beforeRender)
  capturedVariable?: string;      // Variable name (for afterCapture)
  capturedValue?: string | number; // Captured value (for afterCapture)
}
```

## Best Practices

### 1. Use Environment Variables

Store sensitive data in environment variables:

```json
{
  "env": {
    "SPREADSHEET_ID": "GOOGLE_SPREADSHEET_ID",
    "API_KEY": "MY_API_KEY",
    "WEBHOOK_URL": "MY_WEBHOOK_URL"
  }
}
```

### 2. Handle Errors Gracefully

Actions that fail log errors but don't stop the flow. Use conditions to handle expected failures:

```json
{
  "type": "sheets.append",
  "config": { "spreadsheetId": "{{env.SPREADSHEET_ID}}" },
  "if": {
    "variable": "SPREADSHEET_ID",
    "operator": "exists"
  }
}
```

### 3. Keep Actions Simple

Break complex operations into multiple actions:

```json
{
  "afterCapture": [
    { "type": "sheets.append", "config": { } },
    { "type": "notify.telegram", "config": { }, "if": { } },
    { "type": "http.request", "config": { } }
  ]
}
```

### 4. Test with Conditions

Use conditions to test actions safely:

```json
{
  "type": "http.request",
  "config": { "url": "https://production-api.com" },
  "if": {
    "variable": "env",
    "operator": "equals",
    "value": "production"
  }
}
```

## Action Execution Order

### Fetch Actions
Execute **before** step is rendered. Results injected into session variables.

```json
{
  "actions": {
    "fetch": {
      "avgReps": {
        "type": "sheets.query",
        "config": { }
      }
    }
  },
  "message": "Your average is {{variables.avgReps}} reps"
}
```

### Before Render Actions
Execute **after** fetch, **before** rendering. Can modify step (buttons, message).

```json
{
  "actions": {
    "beforeRender": [{
      "type": "buttons.generateRange",
      "config": { }
    }]
  }
}
```

### After Capture Actions
Execute **after** variable is captured. Used for side effects (logging, notifications).

```json
{
  "actions": {
    "afterCapture": [
      { "type": "sheets.append", "config": { } },
      { "type": "notify.telegram", "config": { } }
    ]
  }
}
```

## Troubleshooting

### Action Not Found

```
Error: Unknown action type: sheets.append
```

**Solution:** Ensure action registry is loaded. Check spelling and namespace.

### Variable Not Interpolated

```
Config contains: {{variables.name}} (literal string)
```

**Solution:** Check variable exists in session. Use `{{session.variables.name}}` or ensure variable is captured first.

### Condition Not Working

```
Action always/never executes
```

**Solution:**
- Check variable type matches operator (number for gt/lt, string for contains)
- Verify variable is captured before condition is evaluated
- Use exists operator to check if variable is defined

### Invalid Configuration

```
Error: Invalid configuration for action sheets.append: spreadsheetId is required
```

**Solution:** Check action schema requirements. Ensure all required fields are provided.

## Examples

See the `/examples` directory for complete examples:
- `pushups-declarative.json` - Workout tracker with dynamic buttons and sheets logging
- `survey-declarative.json` - Survey with conditional notifications

## Migration Guide

See [Migration from hooks.js](./migration-from-hooks.md) for step-by-step conversion guide.
