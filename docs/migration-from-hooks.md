# Migration Guide: From hooks.js to Declarative Actions

This guide walks you through converting existing flows from the hooks.js system to declarative actions.

## Quick Comparison

| Feature | hooks.js (Old) | Declarative (New) |
|---------|---------------|-------------------|
| **Configuration** | JavaScript file | JSON only |
| **Learning curve** | Requires JS knowledge | JSON configuration |
| **Common operations** | Custom code | Built-in actions |
| **Type safety** | Runtime only | Schema validation |
| **Reusability** | Copy-paste code | Import packages |
| **Testing** | Unit test JS functions | Test flow JSON |

## Migration Steps

### Step 1: Identify Your Actions

List all hook functions in your `hooks.js`:

```javascript
// hooks.js
export async function logToSheets(variable, value, session, api) { }
export async function generateButtons(step, session) { }
export async function sendNotification(variable, value, session) { }

export default {
  onFlowComplete(session) { }
};
```

### Step 2: Map to Built-in Actions

Common patterns have built-in equivalents:

| hooks.js Pattern | Declarative Action |
|------------------|-------------------|
| `appendToSheet()` | `sheets.append` |
| `querySheetHistory()` | `sheets.query` |
| `generateButtonRange()` | `buttons.generateRange` |
| `scheduleNextSession()` | `schedule.calendar` |
| `scheduleOneTimeReminder()` | `schedule.oneTime` |
| Telegram notifications | `notify.telegram` |
| HTTP webhooks | `http.request` |

### Step 3: Convert Each Action

#### Example 1: Google Sheets Logging

**Before (hooks.js):**

```javascript
export async function logToSheets(variable, value, session, api) {
  const { appendToSheet } = api.hooks;

  await appendToSheet(process.env.SPREADSHEET_ID, {
    timestamp: new Date().toISOString(),
    userId: session.senderId,
    flowName: session.flowName,
    [variable]: value
  });
}
```

**After (declarative):**

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
          "columns": ["timestamp", "userId", "flowName", "answer"],
          "includeMetadata": true
        }
      }]
    }
  }]
}
```

#### Example 2: Dynamic Buttons

**Before (hooks.js):**

```javascript
export async function generateButtons(step, session, api) {
  const { generateButtonRange, getRecentAverage, querySheetHistory } = api.hooks;

  const history = await querySheetHistory(
    process.env.SPREADSHEET_ID,
    'Workouts',
    { flowName: 'pushups', userId: session.senderId }
  );

  const avg = await getRecentAverage('reps', history, 10);
  const values = generateButtonRange(avg, 5, 5, 'centered');

  return {
    ...step,
    buttons: values.map(v => ({ text: String(v), value: v }))
  };
}
```

**After (declarative):**

```json
{
  "actions": {
    "beforeRender": [{
      "type": "buttons.generateRange",
      "config": {
        "variable": "reps",
        "spreadsheetId": "{{env.SPREADSHEET_ID}}",
        "worksheetName": "Workouts",
        "strategy": "centered",
        "buttonCount": 5,
        "step": 5,
        "recentCount": 10
      }
    }]
  }
}
```

#### Example 3: Conditional Notification

**Before (hooks.js):**

```javascript
export async function notifyIfLowRating(variable, value, session, api) {
  const rating = session.variables.rating;

  if (rating < 3) {
    // Send notification
    console.log(`Low rating alert: ${rating}/5 from ${session.senderId}`);
    console.log(`Feedback: ${value}`);
  }
}
```

**After (declarative):**

```json
{
  "actions": {
    "afterCapture": [{
      "type": "notify.telegram",
      "config": {
        "text": "🚨 Low rating: {{variables.rating}}/5\nFeedback: {{variables.feedback}}"
      },
      "if": {
        "variable": "rating",
        "operator": "lessThan",
        "value": 3
      }
    }]
  }
}
```

#### Example 4: Scheduling

**Before (hooks.js):**

```javascript
export default {
  async onFlowComplete(session) {
    const { scheduleOneTimeReminder } = api.hooks;

    await scheduleOneTimeReminder({
      at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      message: '/flow_start pushups',
      channel: 'telegram',
      to: session.senderId
    });
  }
};
```

**After (declarative):**

```json
{
  "steps": [{
    "id": "final",
    "message": "Great work!",
    "actions": {
      "beforeRender": [{
        "type": "schedule.oneTime",
        "config": {
          "date": "{{timestamp.hoursAgo(-24)}}",
          "message": "/flow_start pushups",
          "channel": "telegram",
          "to": "{{session.senderId}}"
        }
      }]
    }
  }]
}
```

### Step 4: Update metadata.json

**Before:**

```json
{
  "name": "myflow",
  "hooks": "./hooks.js",
  "steps": [
    {
      "actions": {
        "afterCapture": [{"action": "logToSheets"}]
      }
    }
  ]
}
```

**After:**

```json
{
  "name": "myflow",
  "env": {
    "SPREADSHEET_ID": "GOOGLE_SPREADSHEET_ID"
  },
  "steps": [
    {
      "actions": {
        "afterCapture": [{
          "type": "sheets.append",
          "config": {
            "spreadsheetId": "{{env.SPREADSHEET_ID}}",
            "worksheetName": "Responses",
            "includeMetadata": true
          }
        }]
      }
    }
  ]
}
```

### Step 5: Remove hooks.js

Once all actions are converted:

```bash
rm src/examples/myflow/hooks.js
```

Update your flow loader to remove the hooks reference.

## Common Patterns

### Pattern 1: Multiple Actions Per Step

**Before:**

```javascript
export async function action1() { }
export async function action2() { }
```

```json
{
  "actions": {
    "afterCapture": [
      {"action": "action1"},
      {"action": "action2"}
    ]
  }
}
```

**After:**

```json
{
  "actions": {
    "afterCapture": [
      {"type": "sheets.append", "config": {}},
      {"type": "notify.telegram", "config": {}}
    ]
  }
}
```

### Pattern 2: Conditional Logic

**Before:**

```javascript
export async function conditionalAction(variable, value, session) {
  if (session.variables.someVar > 10) {
    // Do something
  }
}
```

**After:**

```json
{
  "type": "sheets.append",
  "config": {},
  "if": {
    "variable": "someVar",
    "operator": "greaterThan",
    "value": 10
  }
}
```

### Pattern 3: Data Transformation

**Before:**

```javascript
export async function fetchTotal(session) {
  const total = (session.variables.a || 0) +
                (session.variables.b || 0) +
                (session.variables.c || 0);

  return { total };
}
```

**After:**

```json
{
  "actions": {
    "fetch": {
      "total": {
        "type": "data.transform",
        "config": {
          "operation": "sum",
          "inputs": [
            "{{variables.a}}",
            "{{variables.b}}",
            "{{variables.c}}"
          ]
        }
      }
    }
  }
}
```

### Pattern 4: Environment Variables

**Before:**

```javascript
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

export async function logToSheets() {
  await appendToSheet(SPREADSHEET_ID, {});
}
```

**After:**

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
          "spreadsheetId": "{{env.SPREADSHEET_ID}}"
        }
      }]
    }
  }]
}
```

## Complex Scenarios

### When Declarative Actions Aren't Enough

If you need custom logic that isn't covered by built-in actions, create a custom action package:

```typescript
// @mycompany/actions/index.ts
export default {
  namespace: "mycompany",
  actions: {
    "customLogic": {
      schema: z.object({
        param1: z.string(),
        param2: z.number()
      }),
      execute: async (config, context) => {
        // Your custom logic here
        const { session, api } = context;

        // Complex calculations, API calls, etc.
      }
    }
  }
};
```

Then use it:

```json
{
  "actions": {
    "imports": ["@mycompany/actions"]
  },
  "steps": [{
    "actions": {
      "afterCapture": [{
        "type": "mycompany.customLogic",
        "config": {
          "param1": "{{variables.name}}",
          "param2": 42
        }
      }]
    }
  }]
}
```

## Testing

### Before (hooks.js)

```javascript
// hooks.test.js
import { logToSheets } from './hooks.js';

test('logToSheets logs correctly', async () => {
  const mockApi = { hooks: { appendToSheet: jest.fn() } };
  await logToSheets('var', 'val', session, mockApi);
  expect(mockApi.hooks.appendToSheet).toHaveBeenCalled();
});
```

### After (declarative)

Test the flow JSON directly:

```javascript
// flow.test.js
import { FlowMetadataSchema } from '@joshualelon/clawdbot-skill-flow';
import flow from './metadata.json';

test('flow validates', () => {
  expect(() => FlowMetadataSchema.parse(flow)).not.toThrow();
});

test('actions are configured correctly', () => {
  const step = flow.steps[0];
  expect(step.actions.afterCapture[0].type).toBe('sheets.append');
  expect(step.actions.afterCapture[0].config.spreadsheetId).toBeDefined();
});
```

## Checklist

- [ ] List all hook functions
- [ ] Map each to built-in or custom action
- [ ] Convert action references in metadata.json
- [ ] Add environment variables to flow.env
- [ ] Test flow execution
- [ ] Remove hooks.js file
- [ ] Update documentation
- [ ] Commit changes

## Getting Help

If you encounter patterns that aren't covered:

1. Check the [Declarative Actions Reference](./declarative-actions.md)
2. Review example flows in `/examples`
3. Consider creating a custom action package
4. Open an issue for missing built-in actions

## FAQ

**Q: Can I use both hooks.js and declarative actions?**

No. Once you start using declarative actions (actions with `type` field), the flow will use the new system exclusively.

**Q: What happens to onFlowComplete/onFlowAbandoned?**

Global lifecycle hooks are not yet supported in declarative mode. Use the last step's `beforeRender` action as a workaround for flow completion logic.

**Q: Can I access api.hooks utilities?**

No. Declarative actions don't have access to the enhanced API. Use built-in actions or create custom actions that import the utilities directly.

**Q: How do I debug declarative actions?**

Enable debug logging in your plugin configuration. Actions log errors with context when they fail.

**Q: Can I use JavaScript expressions in interpolation?**

Limited support. Simple arithmetic (`{{a + b}}`) works, but complex expressions require `data.transform` or custom actions.

**Q: How do I migrate conditionally executed actions?**

Use the `if` field with comparison operators. For complex conditions, use `and`/`or`/`not` combinators.
