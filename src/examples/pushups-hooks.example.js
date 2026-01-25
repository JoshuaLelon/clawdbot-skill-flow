/**
 * Example hooks file for pushups flow
 *
 * This file demonstrates how to use hooks to customize flow behavior.
 * To use this with your pushups flow:
 * 1. Copy this file to ~/.clawdbot/flows/pushups/hooks.js
 * 2. Update pushups.json to reference it: "hooks": "./hooks.js"
 *
 * NOTE: This is just an example showing the API. The actual integrations
 * (Google Sheets, calendar, etc.) would require additional dependencies
 * and authentication setup.
 */

export default {
  /**
   * Dynamic button generation based on past performance
   * Example: Center buttons around user's average reps
   */
  async onStepRender(step, _session) {
    // Only modify rep-count steps
    if (!step.id.startsWith('set')) {
      return step;
    }

    // In a real implementation, you would:
    // 1. Query past sessions (via custom storage backend or history.jsonl)
    // 2. Calculate average reps for this step
    // 3. Generate buttons centered around that average

    // Example: Generate 5 buttons centered around 25 reps
    const average = 25; // Would be calculated from history
    const buttons = [
      average - 10,
      average - 5,
      average,
      average + 5,
      average + 10,
    ];

    return {
      ...step,
      buttons,
      message: `${step.message}\n\n💡 Your average: ${average} reps`,
    };
  },

  /**
   * Log each captured variable to external service
   * Example: Append rep counts to Google Sheets
   */
  async onCapture(variable, value, _session) {
    console.log(`[Hooks] Captured ${variable} = ${value}`);

    // In a real implementation, you would:
    // 1. Authenticate with Google Sheets API
    // 2. Append [timestamp, userId, variable, value] to a spreadsheet
    // 3. Handle errors gracefully

    // Example pseudo-code:
    // await sheets.append({
    //   spreadsheetId: 'YOUR_SHEET_ID',
    //   range: 'A:D',
    //   values: [[new Date().toISOString(), session.senderId, variable, value]]
    // });
  },

  /**
   * Follow-up actions when flow completes
   * Example: Schedule next workout, send summary
   */
  async onFlowComplete(session) {
    console.log(`[Hooks] Flow completed for ${session.senderId}`);
    console.log('Variables:', session.variables);

    // Calculate total reps
    const total =
      (session.variables.set1 || 0) +
      (session.variables.set2 || 0) +
      (session.variables.set3 || 0) +
      (session.variables.set4 || 0);

    console.log(`Total reps: ${total}`);

    // In a real implementation, you would:
    // 1. Check calendar for next available slot
    // 2. Create a cron job for that time
    // 3. Create a calendar event
    // 4. Send a congratulatory message

    // Example pseudo-code:
    // const nextWorkout = await calendar.findNextSlot();
    // await cron.create({
    //   schedule: nextWorkout,
    //   command: '/flow-start pushups',
    //   userId: session.senderId
    // });
    // await calendar.createEvent({
    //   title: 'Pushups Workout',
    //   start: nextWorkout,
    //   duration: 30
    // });
  },

  /**
   * Track abandonment for analytics
   * Example: Log to database for completion rate tracking
   */
  async onFlowAbandoned(session, reason) {
    console.log(`[Hooks] Flow abandoned: ${reason}`);
    console.log('Session:', session);

    // In a real implementation, you would:
    // 1. Log to analytics database
    // 2. Track completion rates
    // 3. Send reminder if appropriate

    // Example pseudo-code:
    // await db.logAbandonment({
    //   userId: session.senderId,
    //   flowName: session.flowName,
    //   reason,
    //   timestamp: Date.now(),
    //   lastStep: session.currentStepId,
    //   variables: session.variables
    // });
  },
};
