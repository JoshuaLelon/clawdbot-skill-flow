# Skill Flow - ClawdBot Plugin

Multi-step workflow orchestration plugin that enables deterministic, button-driven conversation flows without AI inference overhead.

## Overview

Skill Flow lets you build structured, wizard-style interactions for Clawdbot. Perfect for scheduled workouts, surveys, onboarding wizards, approval workflows, and any multi-step process that benefits from deterministic execution.

**Key Benefits:**
- **Deterministic Execution** - Telegram button callbacks route directly to plugin commands, bypassing LLM
- **LLM-Powered Generation** - Generate complete flows from natural language descriptions
- **Adaptive Personalization** - AI-powered hooks that personalize messages based on user context
- **Multi-Step Workflows** - Chain steps with conditional branching and variable capture
- **Zero Inference Cost** - Button clicks execute instantly without LLM API calls

## Commands

### `/flow_start <name>`
Start an interactive flow by name.

**Usage:**
```
/flow_start pushups
/flow_start daily-checkin
/flow_start customer-survey
```

**What happens:**
1. Plugin loads the flow definition from `~/.clawdbot/flows/<name>/metadata.json`
2. Renders the first step with Telegram inline keyboard buttons (or text-based menu)
3. Creates an in-memory session to track user progress and captured variables
4. Button clicks route directly back to plugin (no LLM inference)

**Session Management:**
- Sessions timeout after 30 minutes of inactivity (configurable)
- One active flow per user per flow name
- Sessions stored in-memory with automatic cleanup

### `/flow_generate <description>`
Generate a complete flow from natural language using AI.

**Usage:**
```
/flow_generate Create a 4-set pushup tracker with progressive difficulty
/flow_generate Build a customer satisfaction survey with NPS scoring
/flow_generate Make an onboarding wizard that collects name, email, and preferences
```

**What happens:**
1. AI analyzes your description and designs appropriate workflow steps
2. Generates step messages, button layouts, validation rules, and branching logic
3. Shows preview of generated flow with name and JSON
4. Waits for you to save or cancel

**Follow-up commands:**
- `/flow_generate save` - Save the previewed flow and make it available
- `/flow_generate cancel` - Discard the previewed flow

**Behind the scenes:**
- Uses Clawdbot's configured Claude instance (no separate API keys needed)
- Timeout: 30 seconds (configurable via `llm.flowGenerationTimeout`)
- Falls back gracefully if LLM unavailable

### `/flow_list`
List all available flows in your flows directory.

**Usage:**
```
/flow_list
```

**Output:**
- Flow name, description, version, and step count
- Groups by flow name (shows all versions if multiple exist)

### `/flow_delete <name>`
Delete a flow and its history.

**Usage:**
```
/flow_delete old-survey
```

**Warning:** This permanently deletes the flow definition and history.

### `/flow_create import <json>`
Create a flow from raw JSON (advanced usage).

**Usage:**
```
/flow_create import {
  "name": "hello-world",
  "description": "Simple greeting flow",
  "version": "1.0.0",
  "steps": [
    {
      "id": "greeting",
      "message": "What's your name?",
      "capture": "name",
      "next": "farewell"
    },
    {
      "id": "farewell",
      "message": "Nice to meet you, {{name}}! 👋"
    }
  ]
}
```

**Note:** `/flow_generate` is recommended over manual JSON creation for most use cases.

### `/flow_step` (Internal)
Internal command that handles Telegram button callbacks. Not meant to be called directly by users.

## Use Cases

### 1. Scheduled Workouts
Track exercise routines with rep counting and historical data.

**Example: 4-Set Pushup Tracker**
```
/flow_generate Create a 4-set pushup tracker that shows average from history
```

**Features:**
- Dynamic buttons based on historical averages
- Progress tracking across sets
- Completion summary
- Scheduled via Clawdbot cron

**Cron integration:**
```bash
clawdbot cron add \
  --name "daily-pushups" \
  --schedule "45 13 * * *" \
  --session-target isolated \
  --message "/flow_start pushups" \
  --channel telegram \
  --to "+1234567890"
```

### 2. Customer Surveys
Collect feedback with NPS scoring and conditional branching.

**Example: Satisfaction Survey**
```
/flow_generate Create a customer satisfaction survey with NPS score and conditional follow-up questions
```

**Features:**
- Rating scales (0-10, 1-5 stars, emoji reactions)
- Conditional branching (high vs low scores get different follow-ups)
- Free-text feedback capture
- Results logged to Google Sheets or database

### 3. Onboarding Wizards
Guide new users through setup with validation and confirmation.

**Example: Account Setup**
```
/flow_generate Build an onboarding wizard that collects name, email, phone, and preferences
```

**Features:**
- Input validation (email format, phone numbers)
- Variable interpolation (show captured data in summary)
- Multi-step confirmation
- Integration with external systems via hooks

### 4. Approval Workflows
Route requests through approval chains with notifications.

**Example: Expense Approval**
```
/flow_generate Create an expense approval workflow with amount, category, and manager approval
```

**Features:**
- Role-based routing
- Notification triggers (Slack, email)
- Audit trail in history.jsonl
- Conditional approval thresholds

### 5. Daily Check-Ins
Track habits, mood, or wellness with scheduled prompts.

**Example: Wellness Tracker**
```
/flow_generate Make a daily wellness check-in with mood, sleep hours, and energy level
```

**Features:**
- Scheduled daily via cron
- Historical trend analysis
- Variable-driven insights
- Personalized messages via LLM adapter

## Setup Instructions

### 1. Install Plugin

```bash
clawdbot plugins install @joshualelon/clawdbot-skill-flow
```

### 2. Create Your First Flow

Option A: Generate with AI (recommended)
```
/flow_generate Create a simple mood tracker with emoji buttons
/flow_generate save
/flow_start mood-tracker
```

Option B: Use example flow
```bash
clawdbot message send "/flow_create import $(cat ~/.clawdbot/plugins/node_modules/@joshualelon/clawdbot-skill-flow/src/examples/pushups.json)"
/flow_start pushups
```

### 3. Configure Plugin (Optional)

```bash
# Use custom flows directory
clawdbot config set plugins.entries.clawdbot-skill-flow.config.flowsDir "~/my-flows"

# Adjust session timeout to 60 minutes
clawdbot config set plugins.entries.clawdbot-skill-flow.config.sessionTimeoutMinutes 60

# Restart gateway to apply changes
systemctl --user restart clawdbot-gateway  # Linux
# or restart via Clawdbot Mac app menu
```

### 4. Add Advanced Features (Optional)

**Enable adaptive messages with LLM:**
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

**Add custom storage backend:**
```javascript
// ~/.clawdbot/flows/survey/storage.js
export default {
  async saveSession(session) {
    // Write to Google Sheets, Postgres, etc.
    await appendToSheet(spreadsheetId, session.variables);
  },
  async loadHistory(flowName, options) {
    return await querySheets(flowName);
  }
};
```

Update flow metadata to use custom storage:
```json
{
  "name": "survey",
  "storage": {
    "backend": "./storage.js",
    "builtin": false
  }
}
```

## Architecture

### Flow Definition Structure

Flows are defined in JSON with the following structure:

```
~/.clawdbot/flows/
├── <flow-name>/
│   ├── metadata.json      # Flow definition
│   ├── hooks.js           # (Optional) Action functions
│   ├── storage.js         # (Optional) Custom storage backend
│   └── history.jsonl      # (Auto-generated) Completed sessions
```

### Flow Execution Model

```
User sends: /flow_start pushups
         ↓
Plugin loads: ~/.clawdbot/flows/pushups/metadata.json
         ↓
Create session: { flowName, senderId, variables: {}, stepId: "step1" }
         ↓
Execute step lifecycle:
  1. Fetch actions (get data from external sources)
  2. BeforeRender actions (modify step, e.g., generate dynamic buttons)
  3. Render message with buttons
         ↓
User clicks button → Telegram sends callback_data to Clawdbot
         ↓
Plugin receives: /flow_step pushups step1:value
         ↓
Execute transition:
  1. Validate input (number, email, phone)
  2. Store in session.variables.capturedVar
  3. AfterCapture actions (side effects, e.g., log to Sheets)
  4. Evaluate next step (conditional branching or explicit next)
         ↓
Repeat until final step → Save to history.jsonl → Delete session
```

### Step Lifecycle Hooks

Each step can declare **explicit actions** in the flow JSON:

**Fetch Actions** - Get data before rendering
```json
{
  "id": "set1",
  "actions": {
    "fetch": {
      "historicalAverage": "getHistoricalAverage"
    }
  }
}
```

**BeforeRender Actions** - Modify step before display
```json
{
  "actions": {
    "beforeRender": ["generateDynamicButtons"]
  }
}
```

**AfterCapture Actions** - Side effects after capturing variable
```json
{
  "actions": {
    "afterCapture": ["logToSheets", "sendNotification"]
  }
}
```

Action functions are **named exports** in hooks.js:

```javascript
// Fetch action - returns variables to inject
export async function getHistoricalAverage(session) {
  const history = await querySheets();
  return { historicalAverage: calculateAverage(history) };
}

// BeforeRender action - returns modified step
export async function generateDynamicButtons(step, session) {
  const avg = session.variables.historicalAverage || 25;
  return {
    ...step,
    buttons: [avg - 5, avg, avg + 5, avg + 10]
  };
}

// AfterCapture action - side effects only
export async function logToSheets(variable, value, session) {
  await appendToSheet(spreadsheetId, { [variable]: value });
}
```

### Global Lifecycle Hooks

In addition to step-level actions, you can define global lifecycle hooks via **default export**:

```javascript
export default {
  async onFlowStart(session) {
    console.log('Flow started:', session.flowName);
  },

  async onFlowComplete(session) {
    console.log('Flow completed:', session.variables);
    await scheduleNextSession();
  },

  async onFlowAbandoned(session, reason) {
    console.log('Flow abandoned:', reason);
  },

  async onStepRender(step, session) {
    // Global hook that runs for every step
    // Can be used with LLM adapter for adaptive messages
    return step;
  }
};
```

### Session Management

**Session Key:** `${senderId}-${flowName}`

**Session Object:**
```typescript
{
  flowName: string;
  senderId: string;
  stepId: string;
  variables: Record<string, string | number>;
  history: Array<{ stepId: string; value: string | number }>;
  startedAt: number;
  lastActivityAt: number;
}
```

**Timeout Handling:**
- Default: 30 minutes of inactivity
- Configurable: 1-1440 minutes
- Cleanup runs every 5 minutes (configurable)
- Abandoned sessions trigger `onFlowAbandoned` hook

### Channel Support

**Telegram:**
- Inline keyboard buttons (instant callbacks)
- Button payloads: `/flow_step <flowName> <stepId>:<value>`
- Supports button-specific routing

**Other Channels:**
- Text-based menu fallback
- Numbered options (e.g., "Reply with 1-5")
- Parses user text responses

### Storage Options

**Built-in (Default):**
- JSONL append-only log
- Path: `~/.clawdbot/flows/<name>/history.jsonl`
- One JSON object per completed session

**Custom Storage:**
- Implement `StorageBackend` interface
- Integrate with Google Sheets, Postgres, Redis, etc.
- Can be used alongside or instead of built-in storage

### LLM Integration

**Flow Generation:**
- Uses Clawdbot's configured Claude instance
- Provider/model inherited from Clawdbot config
- Timeout: 30 seconds (configurable)

**Adaptive Messages:**
- Optional LLM adapter hook for personalizing messages
- Preserves deterministic execution (adapts messages, not flow logic)
- Falls back to original message if LLM unavailable

**Configuration:**
```bash
clawdbot config set plugins.entries.clawdbot-skill-flow.config.llm.flowGenerationTimeout 30000
clawdbot config set plugins.entries.clawdbot-skill-flow.config.llm.adaptationTimeout 5000
```

### Security

**Path Validation:**
- All dynamically loaded files (hooks, storage) must be within `~/.clawdbot/flows/`
- Prevents directory traversal attacks
- Validates on load, not runtime

**Input Validation:**
- Built-in validators: number, email, phone
- Custom validation via beforeRender actions
- Type-safe variable capture

## Advanced Topics

### Conditional Branching

Route users to different steps based on captured variables:

```json
{
  "id": "nps",
  "message": "Rate us 0-10",
  "buttons": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "capture": "nps",
  "validate": "number",
  "condition": {
    "variable": "nps",
    "greaterThan": 7,
    "next": "positive-feedback"
  },
  "next": "negative-feedback"
}
```

### Variable Interpolation

Display captured data in messages using `{{variableName}}`:

```json
{
  "id": "summary",
  "message": "Thanks {{name}}! You completed {{totalReps}} pushups across {{sets}} sets."
}
```

### Button-Specific Routing

Override default `next` on a per-button basis:

```json
{
  "id": "confirm",
  "message": "Continue?",
  "buttons": [
    { "text": "Yes", "value": "yes", "next": "step2" },
    { "text": "No", "value": "no", "next": "cancel" }
  ]
}
```

### Composing Hooks

Combine multiple hooks for powerful workflows:

```javascript
import { composeHooks } from '@joshualelon/clawdbot-skill-flow/hooks';
import { createDynamicButtons } from '@joshualelon/clawdbot-skill-flow/hooks/dynamic-buttons';
import { createLLMAdapter } from '@joshualelon/clawdbot-skill-flow/hooks/llm-adapter';

export default (api) => ({
  onStepRender: composeHooks(
    // First: Generate buttons from history
    createDynamicButtons({ variable: 'reps', strategy: 'centered' }),
    // Then: Adapt with AI
    createLLMAdapter(api, { adaptMessage: true, adaptButtons: true })
  )
});
```

## Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `flowsDir` | string | `~/.clawdbot/flows` | Custom directory for flow definitions |
| `sessionTimeoutMinutes` | number | `30` | Session timeout (1-1440 minutes) |
| `sessionCleanupIntervalMinutes` | number | `5` | Cleanup check interval (1-60 minutes) |
| `enableBuiltinHistory` | boolean | `true` | Save completed flows to .jsonl files |
| `maxFlowsPerUser` | number | unlimited | Limit concurrent flows per user |
| `llm.flowGenerationTimeout` | number | `30000` | Flow generation timeout (ms) |
| `llm.adaptationTimeout` | number | `5000` | Step adaptation timeout (ms) |
| `llm.maxTokens` | number | `4096` | Max tokens for LLM responses |
| `llm.temperature` | number | `0.7` | Response creativity (0-2) |

## Resources

- [GitHub Repository](https://github.com/joshualelon/clawdbot-skill-flow)
- [Complete API Reference](./docs/api.md)
- [Hooks & Actions Documentation](./src/hooks/README.md)
- [Example Flows](./src/examples/)
- [Tutorial](./docs/tutorial.md)

## Troubleshooting

**Buttons not working?**
- Requires Clawdbot v2026.1.25+ with Telegram `sendPayload` support
- Text-based fallback works on all versions

**Flow not found?**
- Check flows directory: `clawdbot config get plugins.entries.clawdbot-skill-flow.config.flowsDir`
- Verify metadata.json exists in `<flowsDir>/<flowName>/metadata.json`

**Session timeout too short?**
- Increase timeout: `clawdbot config set plugins.entries.clawdbot-skill-flow.config.sessionTimeoutMinutes 60`

**LLM features not working?**
- Verify Clawdbot is configured with Claude API credentials
- Check timeout settings: `clawdbot config get plugins.entries.clawdbot-skill-flow.config.llm`

## Contributing

Issues and PRs welcome at [github.com/joshualelon/clawdbot-skill-flow](https://github.com/joshualelon/clawdbot-skill-flow)

## License

MIT
