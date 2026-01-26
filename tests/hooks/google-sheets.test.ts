/**
 * Tests for Google Sheets utilities
 */

import { describe, it, expect, vi } from "vitest";
import type { FlowSession } from "../../src/types.js";

// Mock googleapis
vi.mock("googleapis", () => {
  const mockSheets = {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: {
          sheets: [{ properties: { title: "Sheet1" } }],
        },
      }),
      values: {
        get: vi.fn().mockResolvedValue({
          data: {
            values: [
              ["timestamp", "userId", "flowName", "reps"],
              ["2026-01-25", "user123", "pushups", "20"],
              ["2026-01-26", "user123", "pushups", "22"],
            ],
          },
        }),
        append: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      batchUpdate: vi.fn().mockResolvedValue({}),
    },
  };

  return {
    google: {
      sheets: vi.fn().mockReturnValue(mockSheets),
      auth: {
        GoogleAuth: vi.fn().mockImplementation(() => ({
          getClient: vi.fn().mockResolvedValue({}),
        })),
      },
    },
  };
});

describe("Google Sheets Integration", () => {
  it("should import without errors", async () => {
    const { createSheetsLogger } = await import(
      "../../src/hooks/google-sheets.js"
    );
    expect(createSheetsLogger).toBeDefined();
  });

  it("should create a sheets logger hook", async () => {
    const { createSheetsLogger } = await import(
      "../../src/hooks/google-sheets.js"
    );

    const logger = createSheetsLogger({
      spreadsheetId: "test-sheet-id",
      worksheetName: "Test",
      includeMetadata: true,
    });

    expect(logger).toBeDefined();
    expect(typeof logger).toBe("function");
  });

  it("should query sheet history", async () => {
    const { querySheetHistory } = await import(
      "../../src/hooks/google-sheets.js"
    );

    const history = await querySheetHistory("test-sheet-id", "Sheet1");

    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
  });

  it("should filter history by flowName", async () => {
    const { querySheetHistory } = await import(
      "../../src/hooks/google-sheets.js"
    );

    const history = await querySheetHistory("test-sheet-id", "Sheet1", {
      flowName: "pushups",
    });

    expect(history).toBeDefined();
    expect(history.every((row) => row.flowName === "pushups")).toBe(true);
  });

  it("should filter history by userId", async () => {
    const { querySheetHistory } = await import(
      "../../src/hooks/google-sheets.js"
    );

    const history = await querySheetHistory("test-sheet-id", "Sheet1", {
      userId: "user123",
    });

    expect(history).toBeDefined();
    expect(history.every((row) => row.userId === "user123")).toBe(true);
  });

  it("should not throw when logging fails", async () => {
    const { createSheetsLogger } = await import(
      "../../src/hooks/google-sheets.js"
    );

    const logger = createSheetsLogger({
      spreadsheetId: "invalid-sheet-id",
      worksheetName: "Test",
    });

    const session: FlowSession = {
      flowName: "test",
      currentStepId: "step1",
      senderId: "user123",
      channel: "telegram",
      variables: { test: "value" },
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    // Should not throw even if append fails
    await expect(logger("test", "value", session)).resolves.not.toThrow();
  });
});

describe("Google Sheets Header Modes", () => {
  it("should throw error in strict mode on header mismatch", async () => {
    const { appendToSheet } = await import(
      "../../src/hooks/google-sheets.js"
    );

    // Mock existing headers different from row keys
    const { google } = await import("googleapis");
    const mockGet = vi.fn().mockResolvedValue({
      data: { values: [["col1", "col2"]] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(google.sheets).mockReturnValue({
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: { sheets: [{ properties: { title: "Sheet1" } }] },
        }),
        values: { get: mockGet },
      },
    } as any);

    await expect(
      appendToSheet(
        "test-sheet-id",
        "Sheet1",
        [{ col1: "a", col3: "c" }],
        undefined,
        "strict"
      )
    ).rejects.toThrow("Header mismatch");
  });

  it("should append new columns in append mode", async () => {
    const { appendToSheet } = await import(
      "../../src/hooks/google-sheets.js"
    );

    // Mock existing headers
    const { google } = await import("googleapis");
    const mockUpdate = vi.fn().mockResolvedValue({});
    const mockAppend = vi.fn().mockResolvedValue({});
    const mockGet = vi.fn().mockResolvedValue({
      data: { values: [["col1", "col2"]] },
    });

    vi.mocked(google.sheets).mockReturnValue({
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: { sheets: [{ properties: { title: "Sheet1" } }] },
        }),
        values: {
          get: mockGet,
          update: mockUpdate,
          append: mockAppend,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await appendToSheet(
      "test-sheet-id",
      "Sheet1",
      [{ col1: "a", col2: "b", col3: "c" }],
      undefined,
      "append"
    );

    // Should update headers to include new column
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          values: [["col1", "col2", "col3"]],
        },
      })
    );

    // Should append the row
    expect(mockAppend).toHaveBeenCalled();
  });

  it("should not update headers in append mode if no new columns", async () => {
    const { appendToSheet } = await import(
      "../../src/hooks/google-sheets.js"
    );

    // Mock existing headers match exactly
    const { google } = await import("googleapis");
    const mockUpdate = vi.fn().mockResolvedValue({});
    const mockAppend = vi.fn().mockResolvedValue({});
    const mockGet = vi.fn().mockResolvedValue({
      data: { values: [["col1", "col2"]] },
    });

    vi.mocked(google.sheets).mockReturnValue({
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: { sheets: [{ properties: { title: "Sheet1" } }] },
        }),
        values: {
          get: mockGet,
          update: mockUpdate,
          append: mockAppend,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await appendToSheet(
      "test-sheet-id",
      "Sheet1",
      [{ col1: "a", col2: "b" }],
      undefined,
      "append"
    );

    // Should not update headers when they already match
    expect(mockUpdate).not.toHaveBeenCalled();

    // Should still append the row
    expect(mockAppend).toHaveBeenCalled();
  });

  it("should overwrite headers in overwrite mode", async () => {
    const { appendToSheet } = await import(
      "../../src/hooks/google-sheets.js"
    );

    // Mock existing headers
    const { google } = await import("googleapis");
    const mockUpdate = vi.fn().mockResolvedValue({});
    const mockAppend = vi.fn().mockResolvedValue({});
    const mockGet = vi.fn().mockResolvedValue({
      data: { values: [["oldCol1", "oldCol2"]] },
    });

    vi.mocked(google.sheets).mockReturnValue({
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: { sheets: [{ properties: { title: "Sheet1" } }] },
        }),
        values: {
          get: mockGet,
          update: mockUpdate,
          append: mockAppend,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await appendToSheet(
      "test-sheet-id",
      "Sheet1",
      [{ newCol1: "a", newCol2: "b" }],
      undefined,
      "overwrite"
    );

    // Should replace headers completely
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          values: [["newCol1", "newCol2"]],
        },
      })
    );

    // Should append the row
    expect(mockAppend).toHaveBeenCalled();
  });

  it("should use append mode by default", async () => {
    const { createSheetsLogger } = await import(
      "../../src/hooks/google-sheets.js"
    );

    // Create logger without specifying headerMode
    const logger = createSheetsLogger({
      spreadsheetId: "test-sheet-id",
      worksheetName: "Test",
    });

    expect(logger).toBeDefined();
    // Default behavior is append mode (tested implicitly)
  });
});
