# Declarative Actions Examples

This directory contains example flows demonstrating the **declarative action system** - a way to configure flows using only JSON, without JavaScript.

## What are Declarative Actions?

Declarative actions let you define common operations (like logging to Google Sheets, sending notifications, or generating dynamic buttons) directly in your flow JSON using a `type` + `config` structure.

### Before (hooks.js required)

```javascript
// hooks.js
export async function logToSheets(variable, value, session, api) {
  const { appendToSheet } = api.hooks;
  await appendToSheet('spreadsheet-id', {
    [variable]: value,
    timestamp: new Date().toISOString(),
    userId: session.senderId
  });
}
```

```json
// metadata.json
{
  "hooks": "./hooks.js",
  "actions": {
    "afterCapture": [{ "action": "logToSheets" }]
  }
}
```

### After (declarative only)

```json
{
  "env": {
    "SPREADSHEET_ID": "GOOGLE_SPREADSHEET_ID"
  },
  "actions": {
    "afterCapture": [
      {
        "type": "sheets.append",
        "config": {
          "spreadsheetId": "{{env.SPREADSHEET_ID}}",
          "worksheetName": "Responses",
          "columns": ["timestamp", "userId", "question1", "question2"],
          "includeMetadata": true
        }
      }
    ]
  }
}
```

## Available Built-in Actions

### Google Sheets
- `sheets.append` - Append rows to a sheet
- `sheets.query` - Query historical data
- `sheets.create` - Create a new spreadsheet

### Button Generation
- `buttons.generateRange` - Generate dynamic buttons based on history

### Scheduling
- `schedule.cron` - Schedule recurring tasks
- `schedule.oneTime` - Schedule one-time reminders
- `schedule.calendar` - Create Google Calendar events

### Notifications
- `notify.telegram` - Send Telegram messages

### Utilities
- `data.transform` - Transform data (sum, average, concat, etc.)
- `http.request` - Make HTTP requests

## Variable Interpolation

Use `{{...}}` syntax to reference variables:

```json
{
  "type": "sheets.append",
  "config": {
    "spreadsheetId": "{{env.SPREADSHEET_ID}}",
    "columns": ["{{variables.name}}", "{{timestamp.now}}"]
  }
}
```

### Available Contexts
- `{{variables.name}}` - Session variables
- `{{session.senderId}}` - Session properties
- `{{env.API_KEY}}` - Environment variables
- `{{timestamp.now}}` - Current timestamp
- `{{timestamp.daysAgo(7)}}` - 7 days ago
- `{{math.sum(variables.a, variables.b)}}` - Math operations

## Conditional Execution

Actions can include conditions:

```json
{
  "type": "notify.telegram",
  "config": {
    "text": "Great score!"
  },
  "if": {
    "variable": "score",
    "operator": "greaterThan",
    "value": 90
  }
}
```

### Conditional Operators
- `equals`, `eq` - Equality
- `notEquals`, `ne` - Inequality
- `greaterThan`, `gt` - Greater than
- `greaterThanOrEqual`, `gte` - Greater than or equal
- `lessThan`, `lt` - Less than
- `lessThanOrEqual`, `lte` - Less than or equal
- `contains` - String contains
- `startsWith` - String starts with
- `endsWith` - String ends with
- `matches` - Regex match
- `in` - Array membership
- `exists` - Variable is defined

### Logical Combinators
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

## Examples

### pushups-declarative.json
Workout tracker demonstrating:
- Dynamic button generation from history
- Google Sheets logging
- Variable interpolation
- Environment variable usage

### survey-declarative.json (coming soon)
Survey flow demonstrating:
- Conditional notifications
- Data transformation
- Multiple action chaining

## Custom Actions

Advanced users can create custom action packages:

```typescript
// @mycompany/clawdbot-actions/index.ts
export default {
  namespace: "mycompany",
  actions: {
    "salesforce.createLead": {
      schema: z.object({
        email: z.string().email(),
        name: z.string()
      }),
      execute: async (config, context) => {
        // Implementation
      }
    }
  }
};
```

Then import in your flow:

```json
{
  "actions": {
    "imports": ["@mycompany/clawdbot-actions"]
  }
}
```

## Migration from hooks.js

See the [Migration Guide](../../docs/migration-from-hooks.md) for step-by-step instructions on converting existing flows.
