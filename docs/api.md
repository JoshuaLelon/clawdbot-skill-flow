# API Reference

Complete schema reference for Skill Flow definitions.

## FlowMetadata

Top-level flow definition.

```typescript
interface FlowMetadata {
  name: string;           // Unique flow identifier (lowercase, no spaces)
  description: string;    // Human-readable description
  version: string;        // Semantic version (e.g., "1.0.0")
  author?: string;        // Optional author name
  steps: FlowStep[];      // Array of flow steps (minimum 1)
  triggers?: {            // Optional trigger configuration
    manual?: boolean;     // Allow manual /flow-start (default: true)
    cron?: string;        // Cron schedule (e.g., "45 13 * * *")
    event?: string;       // Event trigger (future feature)
  };
}
```

### Example

```json
{
  "name": "daily-standup",
  "description": "Daily team standup questions",
  "version": "1.0.0",
  "author": "Team Lead",
  "triggers": {
    "manual": true,
    "cron": "0 9 * * 1-5"
  },
  "steps": [...]
}
```

---

## FlowStep

Individual step within a flow.

```typescript
interface FlowStep {
  id: string;                // Unique step identifier
  message: string;           // Message text (supports {{variable}} interpolation)
  buttons?: Button[];        // Optional button array
  next?: string;             // Default next step ID
  capture?: string;          // Variable name to capture user input
  validate?: ValidationType; // Input validation type
  condition?: Condition;     // Conditional branching rule
}
```

### Step Types

#### 1. Simple Message

No buttons, no capture—just display text:

```json
{
  "id": "welcome",
  "message": "Welcome to the flow!",
  "next": "question1"
}
```

#### 2. Question with Capture

Capture user input into a variable:

```json
{
  "id": "ask-name",
  "message": "What's your name?",
  "capture": "name",
  "next": "greeting"
}
```

#### 3. Multiple Choice

Present buttons and capture selection:

```json
{
  "id": "choose-color",
  "message": "Pick a color:",
  "buttons": ["Red", "Blue", "Green"],
  "capture": "color",
  "next": "summary"
}
```

#### 4. Numeric Input

Buttons with number values:

```json
{
  "id": "rate",
  "message": "Rate 1-5:",
  "buttons": [1, 2, 3, 4, 5],
  "capture": "rating",
  "validate": "number",
  "next": "thanks"
}
```

#### 5. Terminal Step

No `next` field—flow ends here:

```json
{
  "id": "goodbye",
  "message": "Thanks for completing the flow!"
}
```

---

## Button

Button definition (multiple formats supported).

### Formats

#### String Button

```json
"buttons": ["Option A", "Option B", "Option C"]
```

Converted to:

```typescript
{ text: "Option A", value: "Option A" }
{ text: "Option B", value: "Option B" }
{ text: "Option C", value: "Option C" }
```

#### Number Button

```json
"buttons": [1, 2, 3, 4, 5]
```

Converted to:

```typescript
{ text: "1", value: 1 }
{ text: "2", value: 2 }
...
```

#### Object Button

```json
"buttons": [
  { "text": "Yes", "value": "yes", "next": "confirm" },
  { "text": "No", "value": "no", "next": "cancel" }
]
```

### Button Schema

```typescript
interface Button {
  text: string;            // Display text
  value: string | number;  // Value to capture
  next?: string;           // Override default next step
}
```

### Button-Specific Routing

Override the step's default `next`:

```json
{
  "id": "confirm",
  "message": "Continue?",
  "buttons": [
    { "text": "Yes", "value": "yes", "next": "step2" },
    { "text": "No", "value": "no", "next": "cancel" }
  ],
  "next": "default-step"
}
```

---

## Validation

Input validation types.

```typescript
type ValidationType = "number" | "email" | "phone";
```

### Number

```json
{
  "id": "age",
  "message": "How old are you?",
  "capture": "age",
  "validate": "number"
}
```

Rejects non-numeric input with error message.

### Email

```json
{
  "id": "email",
  "message": "Enter your email:",
  "capture": "email",
  "validate": "email"
}
```

Validates format: `name@domain.com`

### Phone

```json
{
  "id": "phone",
  "message": "Enter your phone number:",
  "capture": "phone",
  "validate": "phone"
}
```

Validates format: `+1234567890` or `(123) 456-7890`

---

## Conditional Branching

Route to different steps based on variable values.

```typescript
interface Condition {
  variable: string;       // Variable name to check
  equals?: string | number;     // Exact match
  greaterThan?: number;   // Numeric comparison
  lessThan?: number;      // Numeric comparison
  contains?: string;      // Substring match
  next: string;           // Step to route to if condition matches
}
```

### Examples

#### Exact Match

```json
{
  "id": "role",
  "message": "Are you a manager?",
  "buttons": ["Yes", "No"],
  "capture": "is_manager",
  "condition": {
    "variable": "is_manager",
    "equals": "Yes",
    "next": "manager-flow"
  },
  "next": "employee-flow"
}
```

#### Numeric Comparison

```json
{
  "id": "nps",
  "message": "Rate us 0-10:",
  "buttons": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "capture": "nps",
  "validate": "number",
  "condition": {
    "variable": "nps",
    "greaterThan": 8,
    "next": "promoter"
  },
  "next": "detractor"
}
```

#### String Contains

```json
{
  "id": "feedback",
  "message": "Any comments?",
  "capture": "comments",
  "condition": {
    "variable": "comments",
    "contains": "bug",
    "next": "bug-report"
  },
  "next": "thanks"
}
```

### Condition Priority

If multiple conditions could apply:

1. Button-specific `next` (highest priority)
2. Step `condition` match
3. Step default `next` (fallback)

---

## Variable Interpolation

Use captured variables in subsequent messages.

### Syntax

```
{{variableName}}
```

### Example

```json
{
  "steps": [
    {
      "id": "ask-name",
      "message": "What's your name?",
      "capture": "name",
      "next": "ask-age"
    },
    {
      "id": "ask-age",
      "message": "Hi {{name}}! How old are you?",
      "capture": "age",
      "validate": "number",
      "next": "summary"
    },
    {
      "id": "summary",
      "message": "Got it! {{name}} is {{age}} years old."
    }
  ]
}
```

**Output:**

```
User: John
Bot: Hi John! How old are you?
User: 25
Bot: Got it! John is 25 years old.
```

---

## Session State

Runtime session data (managed internally).

```typescript
interface FlowSession {
  flowName: string;              // Flow identifier
  currentStepId: string;         // Current step ID
  senderId: string;              // User identifier
  channel: string;               // Channel (telegram, discord, etc.)
  variables: Record<string, string | number>;  // Captured variables
  startedAt: number;             // Unix timestamp (ms)
  lastActivityAt: number;        // Unix timestamp (ms)
}
```

### Session Key

```
${senderId}-${flowName}
```

### Session Timeout

- **Duration:** 30 minutes
- **Cleanup:** Every 5 minutes
- **Expiry Check:** On every `/flow-step` call

---

## History Log

Completed flows saved to JSONL file.

### File Path

```
~/.clawdbot/flows/<flowName>/history.jsonl
```

### Entry Format

```json
{
  "flowName": "pushups",
  "currentStepId": "set4",
  "senderId": "+1234567890",
  "channel": "telegram",
  "variables": {
    "set1": 30,
    "set2": 28,
    "set3": 25,
    "set4": 22
  },
  "startedAt": 1706745600000,
  "lastActivityAt": 1706745900000,
  "completedAt": 1706745900000
}
```

One JSON object per line.

---

## Error Handling

### Flow Not Found

```json
{
  "text": "Flow \"xyz\" not found.\n\nUse /flow-list to see available flows."
}
```

### Session Expired

```json
{
  "text": "Session expired or not found.\n\nUse /flow-start pushups to restart the flow."
}
```

### Validation Failed

```json
{
  "text": "Please enter a valid email address"
}
```

### Invalid Step

```json
{
  "text": "Error: Step xyz not found"
}
```

---

## Telegram Rendering

### Callback Format

```
/flow-step <flowName> <stepId>:<value>
```

**Example:**

```
/flow-step pushups set1:30
```

### Inline Keyboard Layout

#### Numeric Buttons (2-column grid)

```json
"buttons": [20, 25, 30, 35, 40, 45]
```

Renders as:

```
[20] [25]
[30] [35]
[40] [45]
```

#### Text Buttons (single column)

```json
"buttons": ["Red", "Blue", "Green"]
```

Renders as:

```
[Red]
[Blue]
[Green]
```

---

## Fallback Channels

For non-Telegram channels (Discord, Slack, Signal, etc.):

Buttons rendered as numbered list:

```
How many pushups?

1. 20
2. 25
3. 30
4. 35
5. 40

Reply with the number of your choice.
```

User replies with `2` → captures value `25`.

---

## Best Practices

### Flow Design

1. **Keep steps focused** - One question per step
2. **Provide clear options** - Avoid overwhelming users with too many buttons
3. **Use validation** - Enforce data quality early
4. **Add completion message** - Summarize captured data

### Variable Names

- Use lowercase with underscores: `user_name`, `nps_score`
- Avoid special characters
- Keep names descriptive

### Button Text

- Keep under 20 characters
- Use clear, actionable language
- Avoid ambiguity

### Flow Names

- Lowercase, no spaces: `daily-checkin`, `pushups`, `survey`
- Keep under 30 characters
- Use hyphens for readability

---

## Complete Example

```json
{
  "name": "workout-tracker",
  "description": "Track daily workout progress",
  "version": "1.0.0",
  "author": "Fitness Team",
  "triggers": {
    "manual": true,
    "cron": "0 7 * * *"
  },
  "steps": [
    {
      "id": "start",
      "message": "Ready for your workout?",
      "buttons": ["Yes!", "Skip today"],
      "capture": "ready",
      "condition": {
        "variable": "ready",
        "equals": "Skip today",
        "next": "skipped"
      },
      "next": "exercise"
    },
    {
      "id": "exercise",
      "message": "What exercise?",
      "buttons": ["Pushups", "Squats", "Plank"],
      "capture": "exercise",
      "next": "reps"
    },
    {
      "id": "reps",
      "message": "How many {{exercise}}?",
      "buttons": [10, 20, 30, 40, 50],
      "capture": "reps",
      "validate": "number",
      "next": "summary"
    },
    {
      "id": "summary",
      "message": "Great! You did {{reps}} {{exercise}}! 💪"
    },
    {
      "id": "skipped",
      "message": "No problem, rest is important too!"
    }
  ]
}
```
