# Tutorial: Building Your First Flow

Learn how to create multi-step workflows with Skill Flow.

## Prerequisites

- Clawdbot installed and configured
- Plugin installed: `clawdbot plugins install @clawdbot/skill-flow`
- At least one messaging channel configured (Telegram recommended)

## Part 1: Simple Survey

Let's build a 3-question satisfaction survey.

### Step 1: Design the Flow

**Questions:**
1. How satisfied are you? (1-5 stars)
2. Would you recommend us? (Yes/No)
3. Any comments? (Free text)

**Variables to capture:**
- `satisfaction` (number)
- `recommend` (string)
- `comments` (string)

### Step 2: Write the Flow Definition

Create `survey.json`:

```json
{
  "name": "satisfaction-survey",
  "description": "Customer satisfaction survey",
  "version": "1.0.0",
  "steps": [
    {
      "id": "satisfaction",
      "message": "How satisfied are you with our service?",
      "buttons": ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"],
      "capture": "satisfaction",
      "next": "recommend"
    },
    {
      "id": "recommend",
      "message": "Would you recommend us to others?",
      "buttons": ["Yes", "No"],
      "capture": "recommend",
      "next": "comments"
    },
    {
      "id": "comments",
      "message": "Any additional comments?",
      "capture": "comments",
      "next": "thanks"
    },
    {
      "id": "thanks",
      "message": "Thank you for your feedback!\n\nSatisfaction: {{satisfaction}}\nRecommend: {{recommend}}\nComments: {{comments}}"
    }
  ]
}
```

### Step 3: Import the Flow

```bash
clawdbot message send "/flow-create import $(cat survey.json)"
```

Expected output:

```
✅ Flow "satisfaction-survey" created successfully!

Start it with: /flow-start satisfaction-survey
```

### Step 4: Test the Flow

```bash
/flow-start satisfaction-survey
```

**Interaction:**

```
Bot: How satisfied are you with our service?
     [⭐] [⭐⭐] [⭐⭐⭐] [⭐⭐⭐⭐] [⭐⭐⭐⭐⭐]

User: [Clicks ⭐⭐⭐⭐]

Bot: Would you recommend us to others?
     [Yes] [No]

User: [Clicks Yes]

Bot: Any additional comments?

User: Great service!

Bot: Thank you for your feedback!

     Satisfaction: ⭐⭐⭐⭐
     Recommend: Yes
     Comments: Great service!
```

---

## Part 2: Add Conditional Branching

Let's improve the survey to ask different follow-up questions based on satisfaction level.

### Updated Flow

```json
{
  "name": "smart-survey",
  "description": "Survey with conditional branching",
  "version": "1.0.0",
  "steps": [
    {
      "id": "satisfaction",
      "message": "Rate your satisfaction (1-5):",
      "buttons": [1, 2, 3, 4, 5],
      "capture": "satisfaction",
      "validate": "number",
      "condition": {
        "variable": "satisfaction",
        "greaterThan": 3,
        "next": "positive"
      },
      "next": "negative"
    },
    {
      "id": "positive",
      "message": "Great! What did you love most?",
      "capture": "loved",
      "next": "thanks"
    },
    {
      "id": "negative",
      "message": "Sorry to hear that. What can we improve?",
      "capture": "improve",
      "next": "thanks"
    },
    {
      "id": "thanks",
      "message": "Thanks for your feedback! We really appreciate it."
    }
  ]
}
```

### How Conditional Branching Works

```json
"condition": {
  "variable": "satisfaction",
  "greaterThan": 3,
  "next": "positive"
}
```

**Logic:**
- If `satisfaction > 3` → go to `"positive"` step
- Otherwise → go to default `"next": "negative"` step

**Result:**
- User rates 4 or 5 → Asked "What did you love most?"
- User rates 1, 2, or 3 → Asked "What can we improve?"

---

## Part 3: Add Input Validation

Let's build a contact form with email validation.

```json
{
  "name": "contact-form",
  "description": "Contact information form",
  "version": "1.0.0",
  "steps": [
    {
      "id": "name",
      "message": "What's your name?",
      "capture": "name",
      "next": "email"
    },
    {
      "id": "email",
      "message": "What's your email address?",
      "capture": "email",
      "validate": "email",
      "next": "phone"
    },
    {
      "id": "phone",
      "message": "What's your phone number?",
      "capture": "phone",
      "validate": "phone",
      "next": "confirm"
    },
    {
      "id": "confirm",
      "message": "Confirm your details:\n\nName: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\n\nIs this correct?",
      "buttons": ["Yes", "No, start over"]
    }
  ]
}
```

### Validation Types

**Email Validation:**
```json
"validate": "email"
```

- Accepts: `user@example.com`
- Rejects: `invalid-email`, `user@`, `@example.com`
- Error: "Please enter a valid email address"

**Phone Validation:**
```json
"validate": "phone"
```

- Accepts: `+1234567890`, `(123) 456-7890`
- Rejects: `abc`, `123`
- Error: "Please enter a valid phone number"

**Number Validation:**
```json
"validate": "number"
```

- Accepts: `42`, `3.14`, `-10`
- Rejects: `abc`, `12abc`
- Error: "Please enter a valid number"

---

## Part 4: Schedule with Cron

### Daily Workout Reminder

**Flow:**

```json
{
  "name": "pushups",
  "description": "Daily pushup tracker",
  "version": "1.0.0",
  "triggers": {
    "manual": true,
    "cron": "45 13 * * *"
  },
  "steps": [
    {
      "id": "reminder",
      "message": "Time for pushups! 💪\n\nReady?",
      "buttons": ["Let's go!", "Skip today"],
      "capture": "ready",
      "condition": {
        "variable": "ready",
        "equals": "Skip today",
        "next": "skipped"
      },
      "next": "count"
    },
    {
      "id": "count",
      "message": "How many pushups?",
      "buttons": [10, 20, 30, 40, 50],
      "capture": "count",
      "validate": "number",
      "next": "done"
    },
    {
      "id": "done",
      "message": "Great work! You did {{count}} pushups! 🎉"
    },
    {
      "id": "skipped",
      "message": "No worries, rest is important too!"
    }
  ]
}
```

### Schedule the Flow

```bash
clawdbot cron add \
  --name "daily-pushups" \
  --schedule "45 13 * * *" \
  --session-target isolated \
  --message "/flow-start pushups" \
  --channel telegram \
  --to "+1234567890"
```

**Cron Schedule:** `45 13 * * *`
- Minute: 45
- Hour: 13 (1:45 PM)
- Every day of month
- Every month
- Every day of week

**Result:** Flow starts automatically at 1:45 PM daily.

### Verify Cron Job

```bash
clawdbot cron list
```

Output:

```
Name: daily-pushups
Schedule: 45 13 * * *
Message: /flow-start pushups
Channel: telegram
To: +1234567890
Status: Active
```

---

## Part 5: View Flow History

After completing flows, view the history log.

### Check History File

```bash
cat ~/.clawdbot/flows/pushups/history.jsonl
```

Sample output:

```json
{"flowName":"pushups","currentStepId":"done","senderId":"+1234567890","channel":"telegram","variables":{"ready":"Let's go!","count":30},"startedAt":1706745600000,"lastActivityAt":1706745900000,"completedAt":1706745900000}
{"flowName":"pushups","currentStepId":"done","senderId":"+1234567890","channel":"telegram","variables":{"ready":"Let's go!","count":35},"startedAt":1706832000000,"lastActivityAt":1706832300000,"completedAt":1706832300000}
```

One JSON object per line (JSONL format).

### Parse History (Example)

```bash
cat ~/.clawdbot/flows/pushups/history.jsonl | jq -r '[.completedAt, .variables.count] | @tsv'
```

Output:

```
1706745900000   30
1706832000000   35
```

---

## Part 6: Advanced Patterns

### Multi-Path Branching

```json
{
  "id": "role",
  "message": "What's your role?",
  "buttons": [
    { "text": "Developer", "value": "dev", "next": "dev-questions" },
    { "text": "Designer", "value": "design", "next": "design-questions" },
    { "text": "Manager", "value": "mgr", "next": "mgr-questions" }
  ]
}
```

Each button routes to a different flow path.

### Dynamic Messages

```json
{
  "id": "summary",
  "message": "Hi {{name}}! You're {{age}} years old and interested in {{topic}}."
}
```

All captured variables available for interpolation.

### Restart Flow

Add a "restart" button:

```json
{
  "id": "confirm",
  "message": "Does this look right?\n\nName: {{name}}\nEmail: {{email}}",
  "buttons": [
    { "text": "Confirm", "value": "yes" },
    { "text": "Start Over", "value": "restart", "next": "name" }
  ]
}
```

---

## Common Patterns

### Yes/No Decision

```json
{
  "id": "confirm",
  "message": "Are you sure?",
  "buttons": ["Yes", "No"],
  "capture": "confirmed"
}
```

### Rating Scale

```json
{
  "id": "rating",
  "message": "Rate 1-10:",
  "buttons": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "capture": "rating",
  "validate": "number"
}
```

### Multiple Choice

```json
{
  "id": "color",
  "message": "Pick your favorite color:",
  "buttons": ["Red", "Blue", "Green", "Yellow"],
  "capture": "color"
}
```

### Free Text Input

```json
{
  "id": "feedback",
  "message": "Any comments?",
  "capture": "comments"
}
```

No buttons → user types a response.

---

## Debugging Tips

### List All Flows

```bash
/flow-list
```

### Delete Test Flow

```bash
/flow-delete test-flow
```

### Check Session State

Sessions expire after 30 minutes. If you get "Session expired," restart the flow:

```bash
/flow-start <flow-name>
```

### Validation Errors

If validation fails, the bot will reply with an error message. The session remains active—just send a valid response.

---

## Next Steps

1. **Build your first flow** - Start with a simple 2-3 question survey
2. **Add validation** - Ensure data quality with built-in validators
3. **Add branching** - Create different paths based on user input
4. **Schedule it** - Use cron to automate delivery
5. **Analyze history** - Review completed flows in the JSONL log

---

## Resources

- [API Reference](./api.md) - Complete schema documentation
- [Examples](../src/examples/) - Sample flows (pushups, survey, onboarding)
- [Clawdbot Docs](https://docs.clawd.bot) - Core Clawdbot documentation

Happy flow building! 🚀
