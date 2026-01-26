/**
 * Tests for hooks common utilities
 */

import { describe, it, expect, vi } from "vitest";
import {
  composeHooks,
  withRetry,
  validateEmail,
  validateNumber,
  validatePhone,
  whenCondition,
  debounceHook,
  throttleHook,
} from "../../src/hooks/common.js";
import type { FlowSession } from "../../src/types.js";

describe("composeHooks", () => {
  it("should execute hooks in sequence", async () => {
    const order: number[] = [];

    const hook1 = vi.fn(async () => {
      order.push(1);
    });

    const hook2 = vi.fn(async () => {
      order.push(2);
    });

    const composed = composeHooks(hook1, hook2);
    // @ts-expect-error - testing with simplified args
    await composed("test", 123, {} as FlowSession);

    expect(order).toEqual([1, 2]);
    expect(hook1).toHaveBeenCalledTimes(1);
    expect(hook2).toHaveBeenCalledTimes(1);
  });

  it("should stop execution if a hook throws", async () => {
    const hook1 = vi.fn(async () => {
      throw new Error("Hook 1 failed");
    });

    const hook2 = vi.fn(async () => {
      // Should not be called
    });

    const composed = composeHooks(hook1, hook2);

    // @ts-expect-error - testing with simplified args
    await expect(composed("test", 123, {} as FlowSession)).rejects.toThrow(
      "Hook 1 failed"
    );
    expect(hook1).toHaveBeenCalledTimes(1);
    expect(hook2).not.toHaveBeenCalled();
  });
});

describe("withRetry", () => {
  it("should succeed on first attempt", async () => {
    const fn = vi.fn(async () => "success");

    const result = await withRetry(fn, { maxAttempts: 3 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("Temporary failure");
      }
      return "success";
    });

    const result = await withRetry(fn, {
      maxAttempts: 3,
      delayMs: 10,
      backoff: false,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after max attempts", async () => {
    const fn = vi.fn(async () => {
      throw new Error("Permanent failure");
    });

    await expect(
      withRetry(fn, { maxAttempts: 3, delayMs: 10 })
    ).rejects.toThrow("Permanent failure");

    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("validateEmail", () => {
  it("should validate correct email formats", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("test.user+tag@domain.co.uk")).toBe(true);
    expect(validateEmail("name@subdomain.example.org")).toBe(true);
  });

  it("should reject invalid email formats", () => {
    expect(validateEmail("not-an-email")).toBe(false);
    expect(validateEmail("@example.com")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("user @example.com")).toBe(false);
  });
});

describe("validateNumber", () => {
  it("should validate numbers", () => {
    expect(validateNumber(42)).toBe(true);
    expect(validateNumber("42")).toBe(true);
    expect(validateNumber(0)).toBe(true);
    expect(validateNumber(-10)).toBe(true);
  });

  it("should reject non-numbers", () => {
    expect(validateNumber("not-a-number")).toBe(false);
    expect(validateNumber("")).toBe(false);
    expect(validateNumber(null)).toBe(false);
    expect(validateNumber(undefined)).toBe(false);
  });

  it("should validate within bounds", () => {
    expect(validateNumber(50, 0, 100)).toBe(true);
    expect(validateNumber(0, 0, 100)).toBe(true);
    expect(validateNumber(100, 0, 100)).toBe(true);
    expect(validateNumber(-1, 0, 100)).toBe(false);
    expect(validateNumber(101, 0, 100)).toBe(false);
  });
});

describe("validatePhone", () => {
  it("should validate phone number formats", () => {
    expect(validatePhone("+1234567890")).toBe(true);
    expect(validatePhone("(123) 456-7890")).toBe(true);
    expect(validatePhone("123-456-7890")).toBe(true);
    expect(validatePhone("1234567890")).toBe(true);
  });

  it("should reject invalid phone formats", () => {
    expect(validatePhone("123")).toBe(false);
    expect(validatePhone("not-a-phone")).toBe(false);
    expect(validatePhone("")).toBe(false);
  });
});

describe("whenCondition", () => {
  it("should execute hook when condition is true", async () => {
    const hook = vi.fn(async () => {});
    const condition = vi.fn(() => true);

    const conditionalHook = whenCondition(condition, hook);

    await conditionalHook(
      // @ts-expect-error - testing with simplified args
      "test",
      123,
      { variables: { score: 150 } } as unknown as FlowSession
    );

    expect(condition).toHaveBeenCalled();
    expect(hook).toHaveBeenCalled();
  });

  it("should not execute hook when condition is false", async () => {
    const hook = vi.fn(async () => {});
    const condition = vi.fn(() => false);

    const conditionalHook = whenCondition(condition, hook);

    await conditionalHook(
      // @ts-expect-error - testing with simplified args
      "test",
      123,
      { variables: { score: 50 } } as unknown as FlowSession
    );

    expect(condition).toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
  });
});

describe("debounceHook", () => {
  it("should debounce hook execution", async () => {
    vi.useFakeTimers();

    const hook = vi.fn(async () => {});
    const debouncedHook = debounceHook(hook, 100);

    // Call multiple times quickly
    // @ts-expect-error - testing with simplified args
    debouncedHook("test1", 1, {} as FlowSession);
    // @ts-expect-error - testing with simplified args
    debouncedHook("test2", 2, {} as FlowSession);
    // @ts-expect-error - testing with simplified args
    debouncedHook("test3", 3, {} as FlowSession);

    // Hook should not be called yet
    expect(hook).not.toHaveBeenCalled();

    // Fast-forward time
    vi.advanceTimersByTime(100);
    await Promise.resolve(); // Allow promises to settle

    // Hook should be called once with the last arguments
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith("test3", 3, {});

    vi.useRealTimers();
  });
});

describe("throttleHook", () => {
  it("should throttle hook execution", async () => {
    vi.useFakeTimers();

    const hook = vi.fn(async () => {});
    const throttledHook = throttleHook(hook, 100);

    // First call should execute immediately
    // @ts-expect-error - testing with simplified args
    await throttledHook("test1", 1, {} as FlowSession);
    expect(hook).toHaveBeenCalledTimes(1);

    // Second call within interval should be ignored
    // @ts-expect-error - testing with simplified args
    await throttledHook("test2", 2, {} as FlowSession);
    expect(hook).toHaveBeenCalledTimes(1);

    // Fast-forward past interval
    vi.advanceTimersByTime(100);

    // Third call should execute
    // @ts-expect-error - testing with simplified args
    await throttledHook("test3", 3, {} as FlowSession);
    expect(hook).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
