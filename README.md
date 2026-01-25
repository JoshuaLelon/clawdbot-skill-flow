# Skill Flow

Multi-step workflow orchestration plugin for [Clawdbot](https://github.com/clawdbot/clawdbot).

Build deterministic, button-driven conversation flows without AI inference overhead. Perfect for scheduled workouts, surveys, onboarding wizards, approval workflows, and any wizard-style interactions.

## Features

- **Deterministic Execution** - Telegram button callbacks route directly to plugin commands, bypassing LLM entirely
- **Multi-Step Workflows** - Chain steps with conditional branching and variable capture
- **Channel Rendering** - Telegram inline keyboards with automatic fallback to text-based menus
- **Input Validation** - Built-in validators for numbers, emails, and phone numbers
- **Variable Interpolation** - Use `{{variableName}}` in messages to display captured data
- **Session Management** - Automatic timeout handling (30 minutes) with in-memory state
- **History Tracking** - JSONL append-only log for completed flows
- **Cron Integration** - Schedule flows to run automatically via Clawdbot's cron system

## Quick Start

### 1. Install Plugin

```bash
clawdbot plugins install @joshualelon/clawdbot-skill-flow
```

### 2. Create a Flow

```bash
clawdbot message send "/flow-create import $(cat <<'EOF'
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
/flow-start daily-checkin
```

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/flow-start <name>` | Start a flow | `/flow-start pushups` |
| `/flow-list` | List all flows | `/flow-list` |
| `/flow-create import <json>` | Create flow from JSON | See Quick Start |
| `/flow-delete <name>` | Delete a flow | `/flow-delete pushups` |
| `/flow-step` | Internal command (callback handler) | N/A |

## Example Flows

### Pushups Workout

4-set pushup tracker with rep counting:

```bash
clawdbot message send "/flow-create import $(cat src/examples/pushups.json)"
```

### Customer Survey

Satisfaction survey with conditional branching (high vs low scores):

```bash
clawdbot message send "/flow-create import $(cat src/examples/survey.json)"
```

### Onboarding Wizard

Multi-step setup with email validation and variable interpolation:

```bash
clawdbot message send "/flow-create import $(cat src/examples/onboarding.json)"
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
  --message "/flow-start pushups" \
  --channel telegram \
  --to "+1234567890"
```

Verify:

```bash
clawdbot cron list
```

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

## Roadmap

### v0.2.0
- LLM-driven steps (e.g., "Ask user for feedback, then summarize")
- External service integrations (Google Sheets, webhooks)
- Flow analytics dashboard (completion rates, drop-off points)

### v0.3.0
- Visual flow builder (web UI)
- Loops and repeats
- Sub-flows (call another flow as a step)

### v1.0.0
- Production-ready comprehensive tests
- Performance optimizations
- Migration guides

## Contributing

Issues and PRs welcome! This plugin follows Clawdbot's coding conventions.

## License

MIT - See [LICENSE](./LICENSE) file

## Links

- [Clawdbot](https://github.com/clawdbot/clawdbot)
- [Plugin SDK Docs](https://docs.clawd.bot/plugins)
- [API Reference](./docs/api.md)
- [Tutorial](./docs/tutorial.md)
