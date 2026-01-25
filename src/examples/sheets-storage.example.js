/**
 * Example custom storage backend for Google Sheets
 *
 * This file demonstrates how to implement a custom storage backend
 * that writes completed sessions to Google Sheets instead of (or in addition to)
 * the built-in JSONL files.
 *
 * To use this with your flow:
 * 1. Copy this file to ~/.clawdbot/flows/<flowname>/storage.js
 * 2. Update flow.json to reference it:
 *    "storage": {
 *      "backend": "./storage.js",
 *      "builtin": false  // Set to false to only use custom backend
 *    }
 *
 * NOTE: This is just an example showing the API. A real implementation
 * would require:
 * - npm install googleapis
 * - Google Cloud project with Sheets API enabled
 * - Service account credentials or OAuth tokens
 * - Spreadsheet ID and appropriate permissions
 */

/**
 * StorageBackend interface implementation
 */
export default {
  /**
   * Save a completed session to Google Sheets
   * @param {FlowSession} session - The completed flow session
   */
  async saveSession(session) {
    console.log('[Storage] Saving session to Google Sheets');
    console.log('Session:', session);

    // In a real implementation:
    //
    // 1. Authenticate with Google Sheets API
    // const auth = await google.auth.getClient({
    //   keyFile: 'path/to/credentials.json',
    //   scopes: ['https://www.googleapis.com/auth/spreadsheets']
    // });
    // const sheets = google.sheets({ version: 'v4', auth });
    //
    // 2. Format session data as row
    // const row = [
    //   new Date().toISOString(),           // Timestamp
    //   session.senderId,                   // User ID
    //   session.flowName,                   // Flow name
    //   JSON.stringify(session.variables),  // Variables (JSON)
    //   session.variables.set1 || '',       // Individual columns per variable
    //   session.variables.set2 || '',
    //   session.variables.set3 || '',
    //   session.variables.set4 || '',
    // ];
    //
    // 3. Append to spreadsheet
    // await sheets.spreadsheets.values.append({
    //   spreadsheetId: 'YOUR_SPREADSHEET_ID',
    //   range: 'Sheet1!A:H',  // Adjust range based on your columns
    //   valueInputOption: 'RAW',
    //   requestBody: {
    //     values: [row]
    //   }
    // });
    //
    // 4. Handle errors
    // try {
    //   await sheets.spreadsheets.values.append(...);
    // } catch (error) {
    //   console.error('Failed to write to Google Sheets:', error);
    //   throw error;  // Re-throw so plugin knows it failed
    // }

    // Placeholder for example
    return Promise.resolve();
  },

  /**
   * Load historical sessions from Google Sheets
   * @param {string} flowName - Name of the flow
   * @param {object} options - Query options
   * @param {number} options.limit - Maximum number of sessions to return
   * @param {string} options.senderId - Filter by user ID
   * @returns {Promise<FlowSession[]>} Array of historical sessions
   */
  async loadHistory(flowName, options = {}) {
    console.log('[Storage] Loading history from Google Sheets');
    console.log('Flow:', flowName, 'Options:', options);

    // In a real implementation:
    //
    // 1. Authenticate (same as above)
    //
    // 2. Read spreadsheet data
    // const response = await sheets.spreadsheets.values.get({
    //   spreadsheetId: 'YOUR_SPREADSHEET_ID',
    //   range: 'Sheet1!A:H'
    // });
    // const rows = response.data.values || [];
    //
    // 3. Parse rows into FlowSession objects
    // const sessions = rows
    //   .filter(row => row[2] === flowName)  // Filter by flow name
    //   .filter(row => !options.senderId || row[1] === options.senderId)
    //   .map(row => ({
    //     flowName: row[2],
    //     senderId: row[1],
    //     currentStepId: '',  // Not stored in this example
    //     channel: '',        // Not stored in this example
    //     variables: JSON.parse(row[3]),
    //     startedAt: 0,       // Could parse from row[0]
    //     lastActivityAt: 0,  // Could parse from row[0]
    //   }));
    //
    // 4. Apply limit
    // if (options.limit) {
    //   return sessions.slice(-options.limit);  // Most recent N
    // }
    //
    // return sessions;

    // Placeholder for example
    return Promise.resolve([]);
  },
};
