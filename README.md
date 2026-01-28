# Skill Flow

Multi-step workflow orchestration plugin for [Clawdbot](https://github.com/clawdbot/clawdbot).

Build deterministic, button-driven conversation flows without AI inference overhead. Perfect for scheduled workouts, surveys, onboarding wizards, approval workflows, and any wizard-style interactions.

## Features

- **Deterministic Execution** - Telegram button callbacks route directly to plugin commands, bypassing LLM entirely
- **LLM-Powered Flow Generation** - Generate complete flows from natural language descriptions
- **Adaptive Step Modification** - AI-powered hooks that personalize messages based on user context
- **Multi-Step Workflows** - Chain steps with conditional branching and variable capture
- **Channel Rendering** - Telegram inline keyboards with automatic fallback to text-based menus
- **Input Validation** - Built-in validators for numbers, emails, and phone numbers
- **Variable Interpolation** - Use `{{variableName}}` in messages to display captured data
- **Session Management** - Automatic timeout handling (30 minutes) with in-memory state
- **History Tracking** - JSONL append-only log for completed flows
- **Cron Integration** - Schedule flows to run automatically via Clawdbot's cron system
- **Hooks Utility Library** - Pre-built integrations for Google Sheets, dynamic buttons, scheduling, and more

## Requirements

- **Clawdbot**: v2026.1.25 or later (requires Telegram `sendPayload` support)
  - PR: https://github.com/clawdbot/clawdbot/pull/1917
  - **Important**: Telegram inline keyboard buttons will not work with older Clawdbot versions
  - Text-based fallback will work on all versions
- **Node.js**: 22+ (same as Clawdbot)
- **Channels**: Currently optimized for Telegram (other channels use text-based menus)

## Quick Start

### 1. Install Plugin

```bash
clawdbot plugins install @joshualelon/clawdbot-skill-flow
```

### 2. Create a Flow

```bash
clawdbot message send "/flow_create import $(cat <<'EOF'
{
  "name": "daily-checkin",
  "description": "Daily wellness check-in",
  "version": "1.0.0",
  "steps": [
    {
      "id": "mood",
      "message": "How are you feeling today?",
      "buttons": ["😊 Great", "😐 Okay", "😔 Not great"],
      "capture": "mood",
      "next": "sleep"
    },
    {
      "id": "sleep",
      "message": "How many hours did you sleep?",
      "buttons": [4, 5, 6, 7, 8, 9, 10],
      "capture": "sleep",
      "validate": "number"
    }
  ]
}
EOF
)"
```

### 3. Run the Flow

```bash
/flow_start daily-checkin
```

## Configuration

The plugin supports several configuration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `flowsDir` | string | `~/.clawdbot/flows` | Custom directory for flow definitions |
| `sessionTimeoutMinutes` | number | `30` | Session timeout (1-1440 minutes) |
| `sessionCleanupIntervalMinutes` | number | `5` | Cleanup check interval (1-60 minutes) |
| `enableBuiltinHistory` | boolean | `true` | Save completed flows to .jsonl files |
| `maxFlowsPerUser` | number | unlimited | Limit concurrent flows per user |
| `llm.flowGenerationTimeout` | number | `30000` | Flow generation timeout (ms) |
| `llm.adaptationTimeout` | number | `5000` | Step adaptation timeout (ms) |
| `llm.maxTokens` | number | `4096` | Max tokens for responses |
| `llm.temperature` | number | `0.7` | Response creativity (0-2) |

**Note:** LLM features use Clawdbot's Claude configuration automatically. Provider/model settings are inherited from Clawdbot.

### Setting Configuration

```bash
# Use custom flows directory (e.g., for job tracking system)
clawdbot config set plugins.entries.clawdbot-skill-flow.config.flowsDir "~/clawd/jobs"

# Adjust session timeout to 60 minutes
clawdbot config set plugins.entries.clawdbot-skill-flow.config.sessionTimeoutMinutes 60

# Disable built-in history (if using custom storage backend)
clawdbot config set plugins.entries.clawdbot-skill-flow.config.enableBuiltinHistory false

# Restart gateway to apply changes
systemctl --user restart clawdbot-gateway  # Linux
# or restart via Clawdbot Mac app menu
```

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/flow_start <name>` | Start a flow | `/flow_start pushups` |
| `/flow_list` | List all flows | `/flow_list` |
| `/flow_create import <json>` | Create flow from JSON | See Quick Start |
| `/flow_generate <description>` | Generate flow from natural language (AI) | `/flow_generate Create a mood tracker` |
| `/flow_delete <name>` | Delete a flow | `/flow_delete pushups` |
| `/flow_step` | Internal command (callback handler) | N/A |

## Example Flows

### Pushups Workout

4-set pushup tracker with rep counting:

```bash
clawdbot message send "/flow_create import $(cat src/examples/pushups.json)"
```

### Customer Survey

Satisfaction survey with conditional branching (high vs low scores):

```bash
clawdbot message send "/flow_create import $(cat src/examples/survey.json)"
```

### Onboarding Wizard

Multi-step setup with email validation and variable interpolation:

```bash
clawdbot message send "/flow_create import $(cat src/examples/onboarding.json)"
```

## Flow Schema

See [API Documentation](./docs/api.md) for complete schema reference.

### Minimal Example

```json
{
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

## Cron Integration

Schedule flows to run automatically:

```bash
clawdbot cron add \
  --name "daily-pushups" \
  --schedule "45 13 * * *" \
  --session-target isolated \
  --message "/flow_start pushups" \
  --channel telegram \
  --to "+1234567890"
```

Verify:

```bash
clawdbot cron list
```

## LLM-Powered Features

Skill Flow now supports AI-powered features that bridge deterministic execution with adaptive intelligence:

### Flow Generation

Generate complete flows from natural language descriptions:

```bash
/flow_generate Create a 4-set pushup tracker with progressive difficulty
```

The AI will:
- Design appropriate steps and branching logic
- Add validation for captured data
- Create natural, conversational messages
- Structure the flow according to best practices

**Preview before saving:**

```bash
# Generate flow
/flow_generate Create a daily wellness check-in with mood and sleep tracking

# Review preview and JSON
# If satisfied, save it:
/flow_generate save

# Or cancel:
/flow_generate cancel

# Start the flow
/flow_start wellness-checkin
```

### Adaptive Step Modification

Make your flows adaptive with LLM-powered hooks that personalize messages based on user context:

```javascript
// ~/.clawdbot/flows/pushups/hooks.js

export default (api) => {
  const { createLLMAdapter } = api.hooks;

  return {
    onStepRender: createLLMAdapter(api, {
      adaptMessage: true,
      adaptButtons: true,
      includeVariables: true
    })
  };
};
```

**What it does:**
- Personalizes messages based on captured variables
- Adapts button labels to be more contextual
- Makes conversations feel natural and engaging
- Falls back gracefully if LLM unavailable

**Example transformation:**

```
Original: "Set 2: How many pushups?"
Adapted: "Nice work on those 25 reps! Ready for set 2?"
```

**Compose with other hooks:**

```javascript
export default (api) => {
  const { composeHooks, createDynamicButtons, createLLMAdapter } = api.hooks;

  return {
    onStepRender: composeHooks(
      // First: Generate button values from history
      createDynamicButtons({
        variable: 'reps',
        strategy: 'centered'
      }),
      // Then: Adapt message and labels with AI
      createLLMAdapter(api, {
        adaptMessage: true,
        adaptButtons: true,
        preserveButtonValues: true
      })
    )
  };
};
```

**Configuration:**

LLM features use Clawdbot's configured Claude instance (no separate API keys needed). You can optionally adjust performance settings:

```bash
# Adjust timeouts (optional)
clawdbot config set plugins.entries.clawdbot-skill-flow.config.llm.flowGenerationTimeout 30000
clawdbot config set plugins.entries.clawdbot-skill-flow.config.llm.adaptationTimeout 5000

# Adjust creativity/token limits (optional)
clawdbot config set plugins.entries.clawdbot-skill-flow.config.llm.temperature 0.7
clawdbot config set plugins.entries.clawdbot-skill-flow.config.llm.maxTokens 4096
```

**Documentation:**
- [LLM Adapter API Reference](./src/hooks/README.md#llm-adapter) - Complete configuration options
- `src/examples/llm-adapter.example.js` - Usage examples

## Advanced Features

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

### Input Validation

Enforce data types with built-in validators:

- `"validate": "number"` - Numeric input only
- `"validate": "email"` - Valid email format
- `"validate": "phone"` - Phone number format

### Variable Interpolation

Display captured data in subsequent messages:

```json
{
  "id": "summary",
  "message": "Thanks {{name}}! You scored {{nps}}/10."
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

### Step-Level Actions System

Skill-flow uses **explicit step-level actions** instead of implicit global hooks. This makes flows self-documenting, LLM-generatable, and easier to understand.

#### Actions in Flow JSON

Each step can declare what actions to execute:

```json
{
  "name": "pushups",
  "description": "4-set pushup workout",
  "version": "1.0.0",
  "hooks": "./hooks.js",
  "steps": [
    {
      "id": "set1",
      "message": "Set 1: How many pushups?",
      "actions": {
        "fetch": {
          "historicalAverage": "getHistoricalAverage"
        },
        "beforeRender": ["generateDynamicButtons"],
        "afterCapture": ["logToSheets"]
      },
      "capture": "set1",
      "validate": "number",
      "next": "set2"
    }
  ]
}
```

**Action Types:**

1. **fetch** - Get data before rendering (returns variables to inject)
   - Format: `{ "varName": "actionFunctionName" }`
   - Example: Fetch historical workout data to calculate averages

2. **beforeRender** - Modify step before display (returns modified step)
   - Format: `["actionFunctionName", ...]`
   - Example: Generate dynamic buttons based on fetched data

3. **afterCapture** - Side effects after capturing variable
   - Format: `["actionFunctionName", ...]`
   - Example: Log to Google Sheets, send notifications

#### Hooks File Structure

Action functions are exported as **named exports** from your hooks file. All actions receive an `api` parameter as their final argument - plugin utilities are available via `api.hooks`.

> **Note:** No imports needed! Just destructure what you need from `api.hooks`.

**Action Signatures:**

```typescript
// Fetch actions - retrieve data before rendering
export async function myFetch(session: FlowSession, api: EnhancedPluginApi) {
  const { querySheetHistory } = api.hooks;
  return { variableName: value };
}

// BeforeRender actions - modify step before display
export async function myBeforeRender(step: FlowStep, session: FlowSession, api: EnhancedPluginApi) {
  const { generateButtonRange } = api.hooks;
  return { ...step, buttons: [...] };
}

// AfterCapture actions - side effects after capturing input
export async function myAfterCapture(variable: string, value: string | number, session: FlowSession, api: EnhancedPluginApi) {
  const { appendToSheet } = api.hooks;
  await appendToSheet('spreadsheet-id', { [variable]: value });
}

// Create a new spreadsheet (typically in a fetch action)
export async function createWorkoutLog(session, api) {
  const { createSpreadsheet } = api.hooks;

  const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet({
    title: `${session.flowName} Log - ${new Date().getFullYear()}`,
    worksheetName: 'Sessions',
    headers: ['timestamp', 'userId', 'set1', 'set2', 'set3', 'set4', 'total'],
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID, // Optional: move to specific folder
    useGogOAuth: true // Use gog CLI OAuth to avoid service account quota issues (requires GOG_ACCOUNT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET env vars)
  });

  return { spreadsheetId, spreadsheetUrl };
}
```

**Complete Example:**

```javascript
// ~/.clawdbot/flows/pushups/hooks.js

/**
 * Fetch action - returns variables to inject
 */
export async function getHistoricalAverage(session, api) {
  // Access plugin utilities via api.hooks (no imports needed!)
  const { querySheetHistory } = api.hooks;

  const history = await querySheetHistory('spreadsheet-id', { limit: 10 });
  const avg = history.reduce((sum, row) => sum + row.reps, 0) / history.length;
  return { historicalAverage: Math.round(avg) };
}

/**
 * BeforeRender action - returns modified step
 */
export async function generateDynamicButtons(step, session, api) {
  const { generateButtonRange } = api.hooks;

  const avg = session.variables.historicalAverage || 25;
  return {
    ...step,
    buttons: generateButtonRange(avg, { count: 5, spread: 5 })
  };
}

/**
 * AfterCapture action - side effects only
 */
export async function logToSheets(variable, value, session, api) {
  const { appendToSheet } = api.hooks;

  await appendToSheet('spreadsheet-id', {
    date: new Date().toISOString(),
    [variable]: value
  });
}

/**
 * Global lifecycle hooks (default export)
 * Use factory function to access api.hooks
 */
export default (api) => {
  const { createClawdBotScheduler } = api.hooks;
  const scheduler = createClawdBotScheduler(api);

  return {
    async onFlowComplete(session) {
      console.log('Workout complete!', session.variables);

      // Schedule next session using plugin utilities
      await scheduler.schedule({
        name: `${session.flowName}-next`,
        schedule: '0 9 * * *', // Daily at 9am
        message: `/flow_start ${session.flowName}`,
      });
    },

    async onFlowAbandoned(session, reason) {
      console.log('Flow abandoned:', reason);
    }
  };
};
```

See the [Hooks API Reference](./src/hooks/README.md) for complete documentation of available utilities.

#### Benefits of Step-Level Actions

**Before (Implicit Global Hooks):**
```javascript
// Flow JSON doesn't show what happens
{ "id": "set1", "capture": "set1" }

// Hook has to filter by step ID
export default {
  async onStepRender(step, session) {
    if (step.id === 'set1') {
      // Hidden logic...
    }
  }
}
```

**After (Explicit Step-Level Actions):**
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

Benefits:
- ✅ Self-documenting (JSON shows what happens)
- ✅ LLM-generatable (AI can see available actions)
- ✅ Git-friendly (changes visible in JSON diffs)
- ✅ Testable (test actions in isolation)
- ✅ No step.id filtering needed

#### Complete Example

See `src/examples/pushups/` for a complete working example with:
- Fetch actions for historical data
- Dynamic button generation
- Google Sheets logging (mock)
- Lifecycle hooks for scheduling

#### Hooks Utility Library

The plugin includes pre-built integrations (work in progress):

- **Google Sheets** - Log flow data and query history
- **Dynamic Buttons** - Generate buttons based on historical data
- **Scheduling** - Schedule recurring workflow sessions
- **Common Utilities** - Compose actions, retry logic, validation

**Note:** The utility library is being updated to work with the new step-level actions system.

**Documentation:**
- [Hooks & Actions Reference](./src/hooks/README.md) - Complete API documentation
- `src/examples/pushups/` - Complete working example
- `src/examples/survey/` - Survey with conditional actions

### Custom Storage Backends

Replace or supplement the built-in JSONL storage:

```json
{
  "name": "pushups",
  "storage": {
    "backend": "./storage.js",
    "builtin": false
  },
  "steps": [...]
}
```

**StorageBackend Interface:**

```javascript
export default {
  async saveSession(session) {
    // Write to Google Sheets, database, etc.
  },

  async loadHistory(flowName, options) {
    // Return historical sessions for analytics
    return [];
  },
};
```

Set `"builtin": false` to disable JSONL storage and only use the custom backend. Omit it (or set to `true`) to use both.

See `src/examples/sheets-storage.example.js` for a complete reference.

## Security

### Hooks & Storage Backend Safety

The plugin validates that all dynamically loaded files (hooks, storage backends) remain within the `~/.clawdbot/flows/` directory. This prevents directory traversal attacks.

**Valid hook paths:**
```json
{
  "name": "myflow",
  "hooks": "./hooks.js",           // ✅ Relative to flow directory
  "hooks": "hooks/custom.js"        // ✅ Subdirectory within flow
}
```

**Invalid hook paths (will be rejected):**
```json
{
  "hooks": "/etc/passwd",           // ❌ Absolute path outside flows
  "hooks": "../../../etc/passwd",   // ❌ Directory traversal
  "hooks": "~/malicious.js"         // ❌ Tilde expansion outside flows
}
```

The plugin uses path validation similar to Clawdbot's core security patterns to ensure hooks and storage backends can only access files within their designated flow directory.

## How It Works

### Telegram Button Callbacks

When you render a Telegram inline keyboard button:

```typescript
{
  text: "20",
  callback_data: "/flow-step pushups set1:20"
}
```

Telegram sends the `callback_data` string back to Clawdbot, which routes it directly to the `/flow-step` command—**no LLM inference required**.

This enables deterministic, instant responses for structured workflows.

### Session Management

- Sessions stored in-memory with 30-minute timeout
- Session key: `${senderId}-${flowName}`
- Automatic cleanup every 5 minutes
- History saved to `~/.clawdbot/flows/<name>/history.jsonl` on completion

### File Structure

```
~/.clawdbot/flows/
├── pushups/
│   ├── metadata.json
│   └── history.jsonl
└── survey/
    ├── metadata.json
    └── history.jsonl
```

## Troubleshooting

### Plugin Failed to Load - Missing Dependencies

**Symptom:**
```
Error: Cannot find module 'zod'
Plugin "clawdbot-skill-flow" failed to load
```

**Cause:** The `clawdbot plugins install` command timed out during npm install, leaving node_modules partially corrupted.

**Fix:**
```bash
# 1. Find your plugin directory
cd ~/.clawdbot/extensions/@joshualelon/clawdbot-skill-flow

# 2. Clean and reinstall dependencies
rm -rf node_modules package-lock.json
npm install --omit=optional

# 3. Restart gateway
systemctl --user restart clawdbot-gateway  # Linux
# OR
# Restart from Clawdbot menu bar app (macOS)
```

### Plugin Install Timeout

**Symptom:**
```
npm install timed out
Plugin installation incomplete
```

**Cause:** Large dependency tree or slow network connection.

**Solutions:**

1. **Manual install:**
   ```bash
   cd ~/.clawdbot/extensions/@joshualelon/clawdbot-skill-flow
   npm install --timeout=120000
   ```

2. **Use faster registry (optional):**
   ```bash
   npm config set registry https://registry.npmjs.org/
   npm install
   ```

3. **Skip optional dependencies:**
   ```bash
   npm install --omit=optional --no-audit
   ```

### Flow Not Found

**Symptom:**
```
Flow "my-flow" not found
```

**Solutions:**

1. **Check flows directory:**
   ```bash
   ls ~/.clawdbot/flows/
   # Or your custom flowsDir
   ```

2. **Verify flow created:**
   ```bash
   /flow_list
   ```

3. **Check file permissions:**
   ```bash
   chmod 644 ~/.clawdbot/flows/my-flow/metadata.json
   ```

### Telegram Buttons Not Working

**Symptom:** Buttons don't appear or don't respond when clicked.

**Cause:** Clawdbot version doesn't support `sendPayload`.

**Solution:** Upgrade Clawdbot to v2026.1.25+ which includes PR #1917.

Text-based menus will work as fallback on older versions.

### Session Timeout Issues

**Symptom:** "Session expired" messages appear too quickly.

**Solution:** Increase timeout in plugin config:

```bash
clawdbot config set plugins.entries.clawdbot-skill-flow.config.sessionTimeoutMinutes 60
```

### Hook Execution Timeout

**Symptom:**
```
Action "myAction" timed out after 5000ms
```

**Solutions:**

1. **Increase action timeout:**
   ```bash
   clawdbot config set plugins.entries.clawdbot-skill-flow.config.security.actionTimeout 10000
   ```

2. **Optimize slow hooks:** Move heavy computation to background jobs.

3. **Use conditional execution:**
   ```json
   {
     "actions": {
       "fetch": {
         "data": { "action": "fetchData", "if": "needsData" }
       }
     }
   }
   ```

### LLM Features Not Working

**Symptom:** `/flow_generate` or LLM adapters fail.

**Cause:** No Claude API configured in Clawdbot.

**Solution:** Configure Claude in Clawdbot settings. The plugin inherits Clawdbot's LLM configuration automatically.

### Debugging Tips

1. **Check plugin logs:**
   ```bash
   journalctl --user -u clawdbot-gateway -f  # Linux
   # OR
   tail -f ~/Library/Logs/Clawdbot/gateway.log  # macOS
   ```

2. **Enable debug logging:**
   ```bash
   clawdbot config set plugins.entries.clawdbot-skill-flow.config.debug true
   ```

3. **Test flow JSON manually:**
   ```bash
   cat ~/.clawdbot/flows/my-flow/metadata.json | jq .
   ```

4. **Verify plugin loaded:**
   ```bash
   /flow_list  # Should list available flows
   ```

## Contributing

Issues and PRs welcome! This plugin follows Clawdbot's coding conventions.

## License

MIT - See [LICENSE](./LICENSE) file

## Links

- [Clawdbot](https://github.com/clawdbot/clawdbot)
- [Plugin SDK Docs](https://docs.clawd.bot/plugins)
- [API Reference](./docs/api.md)
- [Tutorial](./docs/tutorial.md)
