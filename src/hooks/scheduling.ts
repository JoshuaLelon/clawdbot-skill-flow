/**
 * Scheduling utilities for recurring workflows
 */

import { google, calendar_v3 } from "googleapis";
import type { FlowHooks, FlowSession } from "../types.js";
import type { ScheduleConfig, GoogleServiceAccountCredentials } from "./types.js";

/**
 * Create a hook that schedules the next workflow session after completion.
 * Returns an onFlowComplete hook function.
 *
 * Note: Scheduling uses local server time. Ensure your server is in the correct timezone.
 *
 * @example
 * ```ts
 * export default {
 *   onFlowComplete: createScheduler({
 *     days: ['mon', 'wed', 'fri'],
 *     time: '08:00',
 *     calendarCheck: true,
 *     calendarId: 'primary'
 *   })
 * };
 * ```
 */
export function createScheduler(
  config: ScheduleConfig
): NonNullable<FlowHooks["onFlowComplete"]> {
  const {
    days = ["mon", "wed", "fri"],
    time = "08:00",
    calendarId = "primary",
    credentials,
    calendarCheck = false,
    rescheduleOnConflict = false,
  } = config;

  return async (session: FlowSession): Promise<void> => {
    try {
      // Calculate next scheduled date
      const nextDate = findNextScheduledDate(days, time);

      if (!nextDate) {
        console.warn("Unable to calculate next scheduled date");
        return;
      }

      // Check for calendar conflicts if enabled
      if (calendarCheck) {
        const hasConflict = await checkCalendarConflicts(nextDate, 60, { calendarId, credentials });

        if (hasConflict && rescheduleOnConflict) {
          // Find alternative slot
          const alternativeDate = await findNextAvailableSlot(
            [nextDate],
            60, // 60 minutes duration
            { calendarId, credentials }
          );

          if (alternativeDate) {
            await scheduleNextSession(
              session.flowName,
              session.senderId,
              alternativeDate,
              { calendarId, credentials }
            );
            return;
          }
        } else if (hasConflict) {
          console.warn(
            `Calendar conflict detected for ${nextDate.toISOString()}, not scheduling`
          );
          return;
        }
      }

      // Schedule next session
      await scheduleNextSession(session.flowName, session.senderId, nextDate, { calendarId, credentials });
    } catch (error) {
      // Enhanced error message with context
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to schedule next session for flow "${session.flowName}": ${errorMessage}. ` +
          `Check calendar credentials and permissions.`
      );
      // Don't throw - scheduling failures shouldn't break the flow
    }
  };
}

/**
 * Schedule the next workflow session for a user by creating a Google Calendar event.
 *
 * @example
 * ```ts
 * await scheduleNextSession('pushups', 'user123', new Date('2026-01-27T08:00:00Z'), {
 *   calendarId: 'primary',
 *   credentials: { clientEmail: '...', privateKey: '...' }
 * });
 * ```
 */
export async function scheduleNextSession(
  flowName: string,
  userId: string,
  nextDate: Date,
  options?: { calendarId?: string; credentials?: GoogleServiceAccountCredentials }
): Promise<void> {
  const calendar = await createCalendarClient(options?.credentials);
  const calendarId = options?.calendarId || 'primary';

  // Calculate end time (default 30 min duration)
  const endDate = new Date(nextDate);
  endDate.setMinutes(endDate.getMinutes() + 30);

  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `${flowName} Workflow`,
      start: { dateTime: nextDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
      description: `Scheduled session for ${flowName} flow (user: ${userId})`
    }
  });
}

/**
 * Check if there are calendar conflicts at the given time by querying Google Calendar.
 *
 * @example
 * ```ts
 * const hasConflict = await checkCalendarConflicts(
 *   new Date('2026-01-27T08:00:00Z'),
 *   60,
 *   { calendarId: 'primary', credentials: { ... } }
 * );
 * ```
 */
export async function checkCalendarConflicts(
  dateTime: Date,
  duration = 60,
  options?: { calendarId?: string; credentials?: GoogleServiceAccountCredentials }
): Promise<boolean> {
  const calendar = await createCalendarClient(options?.credentials);
  const calendarId = options?.calendarId || 'primary';

  const endTime = new Date(dateTime);
  endTime.setMinutes(endTime.getMinutes() + duration);

  const response = await calendar.events.list({
    calendarId,
    timeMin: dateTime.toISOString(),
    timeMax: endTime.toISOString(),
    singleEvents: true
  });

  return (response.data.items?.length || 0) > 0;
}

/**
 * Find the next available time slot from a list of preferred dates by checking Google Calendar.
 *
 * @example
 * ```ts
 * const nextSlot = await findNextAvailableSlot(
 *   [new Date('2026-01-27T08:00:00Z')],
 *   60,
 *   { calendarId: 'primary', credentials: { ... } }
 * );
 * ```
 */
export async function findNextAvailableSlot(
  preferredDates: Date[],
  duration: number,
  options?: { calendarId?: string; credentials?: GoogleServiceAccountCredentials }
): Promise<Date | null> {
  for (const date of preferredDates) {
    const hasConflict = await checkCalendarConflicts(date, duration, options);
    if (!hasConflict) {
      return date;
    }
  }
  return null; // No free slots found
}

/**
 * Find the next scheduled date based on day-of-week and time preferences.
 * Uses local server time.
 */
function findNextScheduledDate(
  days: string[],
  time: string
): Date | null {
  const now = new Date();

  // Parse target time (HH:MM format)
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  // Map day names to numbers (0=Sunday, 1=Monday, etc.)
  const dayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  const targetDays = days.map((d) => dayMap[d.toLowerCase()]).filter((d): d is number => d !== undefined);

  if (targetDays.length === 0) {
    return null;
  }

  // Find next occurrence
  for (let daysAhead = 1; daysAhead <= 14; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysAhead);
    candidate.setHours(hours, minutes, 0, 0);

    const dayOfWeek = candidate.getDay();

    if (targetDays.includes(dayOfWeek)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Create a Google Calendar API client with authentication
 */
async function createCalendarClient(
  credentials?: GoogleServiceAccountCredentials
): Promise<calendar_v3.Calendar> {
  if (credentials) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.clientEmail,
        private_key: credentials.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return google.calendar({ version: 'v3', auth: auth as any });
  }

  // Use application default credentials
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return google.calendar({ version: 'v3', auth: auth as any });
}
