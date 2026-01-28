# Comprehensive Declarative Actions Demo

This example demonstrates all available declarative action types in a single flow.

## Overview

A quiz flow that showcases:
- ✅ Google Sheets integration (query, append)
- ✅ Dynamic button generation
- ✅ Data transformation
- ✅ Conditional notifications
- ✅ HTTP webhooks
- ✅ Scheduling (one-time and recurring)
- ✅ Complex conditional logic
- ✅ Variable interpolation

## Setup

### 1. Environment Variables

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

Required:
- `GOOGLE_SPREADSHEET_ID` - Google Sheets ID for score tracking
- `MY_API_KEY` - API key for webhook authentication (optional)
- `MY_WEBHOOK_URL` - Webhook URL for high score alerts (optional)

### 2. Google Sheets Setup

Create a spreadsheet with a "Scores" worksheet. The plugin will auto-create headers:
- timestamp
- userId
- flowName
- channel
- name
- score

### 3. Run the Flow

```bash
/flow_start comprehensive-demo
```

## Flow Walkthrough

### Step 1: Name Input
Simple capture without actions.

### Step 2: Score Input

**Demonstrates:**

1. **Fetch Action** - Query historical scores:
```json
{
  "type": "sheets.query",
  "config": {
    "spreadsheetId": "{{env.SPREADSHEET_ID}}",
    "worksheetName": "Scores"
  }
}
```

2. **BeforeRender Action** - Generate dynamic buttons:
```json
{
  "type": "buttons.generateRange",
  "config": {
    "variable": "score",
    "strategy": "centered",
    "buttonCount": 5,
    "step": 10
  }
}
```

3. **AfterCapture Actions** - Log score and transform data:
```json
[
  {
    "type": "sheets.append",
    "config": { "worksheetName": "Scores" }
  },
  {
    "type": "data.transform",
    "config": {
      "operation": "sum",
      "inputs": ["{{variables.score}}", 10]
    }
  }
]
```

4. **Conditional Branching** - Route based on score:
```json
{
  "condition": {
    "variable": "score",
    "greaterThan": 80,
    "next": "excellent"
  }
}
```

### Step 3a: Excellent (High Score)

**Demonstrates:**

1. **Conditional Notification** - Alert for scores ≥90:
```json
{
  "type": "notify.telegram",
  "config": {
    "text": "🏆 High score alert!"
  },
  "if": {
    "variable": "score",
    "operator": "greaterThanOrEqual",
    "value": 90
  }
}
```

2. **HTTP Webhook** - POST to external API:
```json
{
  "type": "http.request",
  "config": {
    "url": "{{env.WEBHOOK_URL}}",
    "method": "POST",
    "body": {
      "event": "high_score",
      "score": "{{variables.score}}"
    }
  },
  "if": {
    "and": [
      {"variable": "WEBHOOK_URL", "operator": "exists"},
      {"variable": "score", "operator": "greaterThan", "value": 85}
    ]
  }
}
```

3. **One-Time Reminder** - Schedule next challenge:
```json
{
  "type": "schedule.oneTime",
  "config": {
    "date": "{{timestamp.hoursAgo(-24)}}",
    "message": "Time for your next challenge!"
  }
}
```

### Step 3b: Good (Regular Score)

**Demonstrates:**

1. **Conditional Notification** - Encouragement for low scores:
```json
{
  "type": "notify.telegram",
  "config": {
    "text": "📊 Keep practicing!"
  },
  "if": {
    "variable": "score",
    "operator": "lessThan",
    "value": 50
  }
}
```

### Step 4: Thanks

**Demonstrates:**

1. **Recurring Schedule** - Weekly quiz reminders:
```json
{
  "type": "schedule.cron",
  "config": {
    "schedule": "0 9 * * 1,3,5",
    "timezone": "America/Los_Angeles",
    "message": "📝 Time for your weekly quiz!"
  }
}
```

## Action Types Used

### Data Fetching
- ✅ `sheets.query` - Load historical scores

### Data Storage
- ✅ `sheets.append` - Log scores with metadata

### UI Generation
- ✅ `buttons.generateRange` - Dynamic score buttons

### Data Processing
- ✅ `data.transform` - Calculate bonus points

### Notifications
- ✅ `notify.telegram` - Conditional alerts

### External Integration
- ✅ `http.request` - Webhook to external service

### Scheduling
- ✅ `schedule.oneTime` - 24-hour reminder
- ✅ `schedule.cron` - Weekly recurring quiz

## Advanced Features

### 1. Variable Interpolation

All actions use variable interpolation:
```json
{
  "text": "Hi {{variables.name}}! You scored {{variables.score}}/100",
  "timestamp": "{{timestamp.now}}",
  "apiKey": "{{env.API_KEY}}"
}
```

### 2. Complex Conditions

Logical combinators for precise control:
```json
{
  "if": {
    "and": [
      {"variable": "WEBHOOK_URL", "operator": "exists"},
      {"variable": "score", "operator": "greaterThan", "value": 85}
    ]
  }
}
```

### 3. Chained Actions

Multiple actions execute in sequence:
```json
{
  "afterCapture": [
    {"type": "sheets.append"},
    {"type": "notify.telegram"},
    {"type": "http.request"}
  ]
}
```

### 4. Graceful Fallbacks

Actions with existence checks:
```json
{
  "if": {
    "variable": "SPREADSHEET_ID",
    "operator": "exists"
  }
}
```

## Testing

### Test All Features

1. Run with all environment variables configured
2. Verify Google Sheets logging
3. Check dynamic buttons appear
4. Confirm notifications sent
5. Verify webhook called
6. Check scheduling created

### Test Graceful Degradation

1. Run without `SPREADSHEET_ID` - flow continues, no sheets logging
2. Run without `WEBHOOK_URL` - flow continues, no webhook call
3. Verify conditions prevent errors

## Customization

### Add More Actions

Extend with additional action types:
```json
{
  "afterCapture": [
    {"type": "sheets.append"},
    {"type": "data.transform"},
    {"type": "your-custom-action"}
  ]
}
```

### Modify Conditions

Adjust thresholds and logic:
```json
{
  "condition": {
    "variable": "score",
    "greaterThan": 90,  // Change threshold
    "next": "perfect"   // New route
  }
}
```

### Change Scheduling

Update cron expressions:
```json
{
  "schedule": "0 9 * * *",  // Daily at 9am
  "timezone": "America/New_York"
}
```

## Troubleshooting

### Actions Not Executing

Check:
- Environment variables are set
- Conditions evaluate correctly
- Action configs are valid

### Sheets Not Logging

Verify:
- `GOOGLE_SPREADSHEET_ID` is set
- Service account has write permissions
- Worksheet name matches config

### Notifications Not Sent

Ensure:
- Bot has permission to message user
- Channel name is correct
- Message text is valid

## Next Steps

1. Review the JSON to understand each action
2. Modify configs to match your use case
3. Add custom actions for specific needs
4. Test error handling and edge cases

## Learn More

- [Declarative Actions Reference](../../docs/declarative-actions.md)
- [Migration Guide](../../docs/migration-from-hooks.md)
- [Custom Actions](../../docs/custom-actions.md)
