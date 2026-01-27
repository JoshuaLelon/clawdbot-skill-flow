# Pushups Flow Example

This example demonstrates the step-level actions system in skill-flow.

## What This Example Shows

1. **Fetch Actions** - Getting data before rendering a step
   - `getHistoricalAverage`: Queries past workouts to calculate average reps

2. **BeforeRender Actions** - Modifying steps dynamically
   - `generateDynamicButtons`: Creates button options based on historical average

3. **AfterCapture Actions** - Side effects after capturing variables
   - `logToSheets`: Logs each set to Google Sheets (mock implementation)

4. **Global Lifecycle Hooks** - Flow-level events
   - `onFlowComplete`: Called when workout is finished
   - `onFlowAbandoned`: Called if user quits early

## Flow Design

The flow JSON explicitly declares what happens at each step:

```json
{
  "id": "set1",
  "actions": {
    "fetch": { "historicalAverage": "getHistoricalAverage" },
    "beforeRender": ["generateDynamicButtons"],
    "afterCapture": ["logToSheets"]
  }
}
```

This makes it clear that:
- Before rendering: Fetch historical average, then generate buttons
- After capturing: Log to Sheets

## Running This Example

```bash
# Copy to flows directory
cp -r src/examples/pushups ~/.clawdbot/flows/

# Start the flow
/flow_start pushups
```

## Real Implementation

To make this production-ready, you would:

1. Replace mock data with real Google Sheets integration
2. Add authentication and error handling
3. Use config.json for spreadsheet IDs and other settings
4. Add scheduling logic in onFlowComplete
5. Add streak tracking, progress charts, etc.

## Config File

The `config.json` file contains settings that can be shared across multiple flows:

- Schedule preferences (days, time, timezone)
- Workout settings (number of sets, button increments)
- Google Sheets IDs
- Telegram chat IDs

Actions can import and use these settings to customize behavior.
