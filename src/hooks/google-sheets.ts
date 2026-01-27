/**
 * Google Sheets integration utilities for logging flow data
 */

import { google, sheets_v4 } from "googleapis";
import type { FlowHooks, FlowSession } from "../types.js";
import type { SheetsLogOptions, GoogleServiceAccountCredentials, HeaderMode } from "./types.js";
import { withRetry } from "./common.js";

/**
 * Create a Google Sheets API client with authentication
 */
async function createSheetsClient(
  credentials?: GoogleServiceAccountCredentials
): Promise<sheets_v4.Sheets> {
  // If credentials provided, use service account auth
  if (credentials) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.clientEmail,
        private_key: credentials.privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    // GoogleAuth is compatible with the auth parameter expected by google.sheets()
    // The typing is complex due to multiple auth types, but runtime behavior is correct
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return google.sheets({ version: "v4", auth: auth as any });
  }

  // Otherwise, use application default credentials (from environment)
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return google.sheets({ version: "v4", auth: auth as any });
}

/**
 * Create a hook that logs captured variables to Google Sheets.
 * Returns an onCapture hook function.
 *
 * @example
 * ```ts
 * export default {
 *   onCapture: createSheetsLogger({
 *     spreadsheetId: '1ABC...xyz',
 *     worksheetName: 'Workouts',
 *     columns: ['set1', 'set2', 'set3'],
 *     includeMetadata: true
 *   })
 * };
 * ```
 */
export function createSheetsLogger(
  options: SheetsLogOptions
): NonNullable<FlowHooks["onCapture"]> {
  const {
    spreadsheetId,
    worksheetName = "Sheet1",
    columns,
    includeMetadata = true,
    credentials,
    headerMode = 'append',
  } = options;

  return async (variable: string, value: string | number, session: FlowSession) => {
    try {
      // Prepare row data
      const row: Record<string, unknown> = {};

      // Add metadata if requested
      if (includeMetadata) {
        row.timestamp = new Date().toISOString();
        row.userId = session.senderId;
        row.flowName = session.flowName;
        row.channel = session.channel;
      }

      // Add all session variables (or filtered columns)
      if (columns && columns.length > 0) {
        // Only include specified columns
        for (const col of columns) {
          row[col] = session.variables[col] ?? "";
        }
      } else {
        // Include all variables
        Object.assign(row, session.variables);
      }

      // Also include the just-captured variable
      row[variable] = value;

      // Append to sheet with retry
      await withRetry(
        () => appendToSheet(spreadsheetId, worksheetName, [row], credentials, headerMode),
        { maxAttempts: 3, delayMs: 1000, backoff: true }
      );
    } catch (error) {
      // Enhanced error message with context
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to log to Google Sheets (spreadsheetId: ${spreadsheetId}, worksheet: ${worksheetName}): ${errorMessage}. ` +
          `Check credentials, permissions, and API quotas. Flow continues without logging.`
      );
      // Don't throw - logging failures shouldn't break the flow
    }
  };
}

/**
 * Low-level utility to append rows to a Google Sheet.
 * Creates the worksheet if it doesn't exist, and adds headers on first write.
 *
 * @example
 * ```ts
 * await appendToSheet('1ABC...xyz', 'Workouts', [
 *   { date: '2026-01-25', reps: 20, weight: 45 },
 *   { date: '2026-01-26', reps: 22, weight: 45 }
 * ], undefined, 'append');
 * ```
 */
export async function appendToSheet(
  spreadsheetId: string,
  worksheetName: string,
  rows: Array<Record<string, unknown>>,
  credentials?: GoogleServiceAccountCredentials,
  headerMode: HeaderMode = 'append'
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const sheets = await createSheetsClient(credentials);

  // Ensure worksheet exists
  await ensureWorksheetExists(sheets, spreadsheetId, worksheetName);

  // Get existing data to check if we need to write headers
  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${worksheetName}!A1:ZZ1`, // Check first row for headers
  });

  const existingHeaders = existingData.data.values?.[0] || [];
  const rowKeys = Object.keys(rows[0]!);

  // Handle headers based on mode
  if (existingHeaders.length === 0) {
    // Empty sheet - always write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${worksheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowKeys],
      },
    });
  } else if (!arraysEqual(existingHeaders, rowKeys)) {
    // Headers don't match - apply mode
    switch (headerMode) {
      case 'strict':
        throw new Error(
          `Header mismatch in sheet "${worksheetName}". ` +
          `Expected: ${existingHeaders.join(', ')}. ` +
          `Got: ${rowKeys.join(', ')}. ` +
          `Set headerMode to 'append' or 'overwrite' to handle this.`
        );

      case 'append': {
        // Find new columns not in existing headers
        const newColumns = rowKeys.filter(key => !existingHeaders.includes(key));
        if (newColumns.length > 0) {
          // Append new columns to the right
          const updatedHeaders = [...existingHeaders, ...newColumns];
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${worksheetName}!A1`,
            valueInputOption: "RAW",
            requestBody: {
              values: [updatedHeaders],
            },
          });
        }
        break;
      }

      case 'overwrite':
        // Replace headers completely
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${worksheetName}!A1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [rowKeys],
          },
        });
        break;
    }
  }

  // Convert rows to 2D array for Sheets API
  const values = rows.map((row) => rowKeys.map((key) => row[key] ?? ""));

  // Append data
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${worksheetName}!A:A`, // Append to column A (auto-detects next row)
    valueInputOption: "RAW",
    requestBody: {
      values,
    },
  });
}

/**
 * Query historical data from a Google Sheet.
 * Useful for calculating statistics or generating dynamic buttons.
 *
 * @example
 * ```ts
 * const history = await querySheetHistory('1ABC...xyz', 'Workouts', {
 *   flowName: 'pushups',
 *   userId: 'user123',
 *   dateRange: [new Date('2026-01-01'), new Date()]
 * });
 * ```
 */
export async function querySheetHistory(
  spreadsheetId: string,
  worksheetName: string,
  filters?: {
    flowName?: string;
    userId?: string;
    dateRange?: [Date, Date];
  },
  credentials?: GoogleServiceAccountCredentials
): Promise<Array<Record<string, unknown>>> {
  const sheets = await createSheetsClient(credentials);

  // Get all data from worksheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${worksheetName}!A:ZZ`,
  });

  const values = response.data.values || [];
  if (values.length === 0) {
    return [];
  }

  // First row is headers
  const headers = values[0] as string[];
  const rows = values.slice(1);

  // Convert to array of objects
  let data = rows.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? "";
    });
    return obj;
  });

  // Apply filters
  if (filters) {
    if (filters.flowName) {
      data = data.filter((row: Record<string, unknown>) => row.flowName === filters.flowName);
    }
    if (filters.userId) {
      data = data.filter((row: Record<string, unknown>) => row.userId === filters.userId);
    }
    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      data = data.filter((row: Record<string, unknown>) => {
        const timestamp = new Date(row.timestamp as string);
        return timestamp >= start && timestamp <= end;
      });
    }
  }

  return data;
}

/**
 * Create a new Google Spreadsheet with optional initial data
 *
 * @param options - Configuration for spreadsheet creation
 * @returns Object containing spreadsheetId and spreadsheetUrl
 *
 * @example
 * ```ts
 * // Create a simple spreadsheet
 * const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet({
 *   title: 'Pushups Log 2026',
 *   worksheetName: 'Sessions'
 * });
 *
 * // Create with initial headers and move to folder
 * const result = await createSpreadsheet({
 *   title: 'Pushups Log 2026',
 *   worksheetName: 'Sessions',
 *   headers: ['timestamp', 'userId', 'set1', 'set2', 'set3', 'set4', 'total'],
 *   folderId: '1ABC...xyz'
 * });
 * ```
 */
export async function createSpreadsheet(options: {
  title: string;
  worksheetName?: string;
  headers?: string[];
  folderId?: string;
  credentials?: GoogleServiceAccountCredentials;
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const {
    title,
    worksheetName = 'Sheet1',
    headers,
    folderId,
    credentials,
  } = options;

  const sheets = await createSheetsClient(credentials);

  // Create the spreadsheet
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title,
        locale: 'en_US',
        timeZone: 'America/Chicago', // Default to CT, users can change
      },
      sheets: [
        {
          properties: {
            title: worksheetName,
            gridProperties: {
              rowCount: 1000,
              columnCount: 26,
              frozenRowCount: headers ? 1 : 0, // Freeze header row if headers provided
            },
          },
        },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId;
  const spreadsheetUrl = createResponse.data.spreadsheetUrl;

  if (!spreadsheetId || !spreadsheetUrl) {
    throw new Error('Failed to create spreadsheet: missing ID or URL');
  }

  // Add headers if provided
  if (headers && headers.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${worksheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });

    // Bold the header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
        ],
      },
    });
  }

  // Move to folder if specified
  if (folderId) {
    // Create Drive API client with same auth
    let driveAuth;
    if (credentials) {
      driveAuth = new google.auth.GoogleAuth({
        credentials: {
          client_email: credentials.clientEmail,
          private_key: credentials.privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
    } else {
      driveAuth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drive = google.drive({ version: 'v3', auth: driveAuth as any });

    // Get current parents (usually root)
    const file = await drive.files.get({
      fileId: spreadsheetId,
      fields: 'parents',
    });

    const previousParents = file.data.parents?.join(',');

    // Move to new folder
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: previousParents,
      fields: 'id, parents',
    });
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Ensure a worksheet exists, create it if not
 */
async function ensureWorksheetExists(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  worksheetName: string
): Promise<void> {
  // Get spreadsheet metadata
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetExists = spreadsheet.data.sheets?.some(
    (sheet: sheets_v4.Schema$Sheet) => sheet.properties?.title === worksheetName
  );

  if (!sheetExists) {
    // Create new worksheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: worksheetName,
              },
            },
          },
        ],
      },
    });
  }
}

/**
 * Check if two arrays are equal (for header comparison)
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}
