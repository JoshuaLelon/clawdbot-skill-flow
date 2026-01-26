/**
 * Tests for scheduling utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  scheduleNextSession,
  checkCalendarConflicts,
  findNextAvailableSlot,
} from "../../src/hooks/scheduling.js";
import { google } from "googleapis";

// Mock googleapis
vi.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn().mockImplementation(() => ({})),
    },
    calendar: vi.fn(),
  },
}));

describe("scheduleNextSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a calendar event", async () => {
    const mockInsert = vi.fn().mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(google.calendar).mockReturnValue({
      events: { insert: mockInsert },
    } as any);

    const nextDate = new Date("2026-01-27T08:00:00Z");
    await scheduleNextSession("pushups", "user123", nextDate, {
      calendarId: "primary",
    });

    expect(mockInsert).toHaveBeenCalledWith({
      calendarId: "primary",
      requestBody: {
        summary: "pushups Workflow",
        start: { dateTime: "2026-01-27T08:00:00.000Z" },
        end: { dateTime: "2026-01-27T08:30:00.000Z" },
        description: "Scheduled session for pushups flow (user: user123)",
      },
    });
  });
});

describe("checkCalendarConflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when no events found", async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: { items: [] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(google.calendar).mockReturnValue({
      events: { list: mockList },
    } as any);

    const hasConflict = await checkCalendarConflicts(
      new Date("2026-01-27T08:00:00Z"),
      60,
      { calendarId: "primary" }
    );

    expect(hasConflict).toBe(false);
  });

  it("should return true when events found", async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: { items: [{ summary: "Existing event" }] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(google.calendar).mockReturnValue({
      events: { list: mockList },
    } as any);

    const hasConflict = await checkCalendarConflicts(
      new Date("2026-01-27T08:00:00Z"),
      60,
      { calendarId: "primary" }
    );

    expect(hasConflict).toBe(true);
  });

  it("should query the correct time range", async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: { items: [] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(google.calendar).mockReturnValue({
      events: { list: mockList },
    } as any);

    const startDate = new Date("2026-01-27T08:00:00Z");
    await checkCalendarConflicts(startDate, 60, { calendarId: "primary" });

    expect(mockList).toHaveBeenCalledWith({
      calendarId: "primary",
      timeMin: "2026-01-27T08:00:00.000Z",
      timeMax: "2026-01-27T09:00:00.000Z",
      singleEvents: true,
    });
  });
});

describe("findNextAvailableSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return first free slot", async () => {
    const mockList = vi
      .fn()
      .mockResolvedValueOnce({ data: { items: [{ summary: "Busy" }] } }) // First slot has conflict
      .mockResolvedValueOnce({ data: { items: [] } }); // Second slot is free

    vi.mocked(google.calendar).mockReturnValue({
      events: { list: mockList },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const dates = [
      new Date("2026-01-27T08:00:00Z"),
      new Date("2026-01-28T08:00:00Z"),
    ];

    const result = await findNextAvailableSlot(dates, 60, {
      calendarId: "primary",
    });

    expect(result).toEqual(dates[1]);
  });

  it("should return null for empty preferences", async () => {
    const result = await findNextAvailableSlot([], 60, {
      calendarId: "primary",
    });

    expect(result).toBeNull();
  });

  it("should return null when all slots are busy", async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: { items: [{ summary: "Busy" }] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(google.calendar).mockReturnValue({
      events: { list: mockList },
    } as any);

    const dates = [new Date("2026-01-27T08:00:00Z")];
    const result = await findNextAvailableSlot(dates, 60, {
      calendarId: "primary",
    });

    expect(result).toBeNull();
  });
});
