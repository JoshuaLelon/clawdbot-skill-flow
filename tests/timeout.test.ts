/**
 * Tests for timeout utilities
 */

import { describe, it, expect } from "vitest";
import { withTimeout, TimeoutError } from "../src/security/timeout.js";

describe("Timeout Utilities", () => {
  describe("withTimeout", () => {
    it("should resolve if function completes within timeout", async () => {
      const fastFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "success";
      };

      const result = await withTimeout(fastFn, 1000);
      expect(result).toBe("success");
    });

    it("should reject with TimeoutError if function exceeds timeout", async () => {
      const slowFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "success";
      };

      await expect(withTimeout(slowFn, 50)).rejects.toThrow(TimeoutError);
    });

    it("should use default timeout message", async () => {
      const slowFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "success";
      };

      try {
        await withTimeout(slowFn, 50);
        expect.fail("Should have thrown TimeoutError");
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as Error).message).toBe("Operation timed out after 50ms");
      }
    });

    it("should use custom timeout message", async () => {
      const slowFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "success";
      };

      try {
        await withTimeout(slowFn, 50, "Custom action timed out");
        expect.fail("Should have thrown TimeoutError");
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as Error).message).toBe("Custom action timed out");
      }
    });

    it("should propagate non-timeout errors", async () => {
      const errorFn = async () => {
        throw new Error("Custom error");
      };

      await expect(withTimeout(errorFn, 1000)).rejects.toThrow("Custom error");
      await expect(withTimeout(errorFn, 1000)).rejects.not.toThrow(
        TimeoutError
      );
    });

    it("should handle synchronous values", async () => {
      const syncFn = () => Promise.resolve(42);

      const result = await withTimeout(syncFn, 1000);
      expect(result).toBe(42);
    });

    it("should handle zero timeout", async () => {
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "success";
      };

      await expect(withTimeout(fn, 0)).rejects.toThrow(TimeoutError);
    });

    it("should handle concurrent timeouts", async () => {
      const fn1 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "fn1";
      };

      const fn2 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "fn2";
      };

      const fn3 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "fn3";
      };

      const results = await Promise.allSettled([
        withTimeout(fn1, 200),
        withTimeout(fn2, 50),
        withTimeout(fn3, 200),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect((results[0] as PromiseFulfilledResult<string>).value).toBe("fn1");

      expect(results[1].status).toBe("rejected");
      expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(
        TimeoutError
      );

      expect(results[2].status).toBe("fulfilled");
      expect((results[2] as PromiseFulfilledResult<string>).value).toBe("fn3");
    });

    it("should return correct type", async () => {
      const numberFn = async () => 42;
      const stringFn = async () => "hello";
      const objectFn = async () => ({ key: "value" });

      const numResult = await withTimeout(numberFn, 1000);
      expect(typeof numResult).toBe("number");
      expect(numResult).toBe(42);

      const strResult = await withTimeout(stringFn, 1000);
      expect(typeof strResult).toBe("string");
      expect(strResult).toBe("hello");

      const objResult = await withTimeout(objectFn, 1000);
      expect(typeof objResult).toBe("object");
      expect(objResult).toEqual({ key: "value" });
    });
  });

  describe("TimeoutError", () => {
    it("should be instance of Error", () => {
      const error = new TimeoutError("Test timeout");
      expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name", () => {
      const error = new TimeoutError("Test timeout");
      expect(error.name).toBe("TimeoutError");
    });

    it("should have correct message", () => {
      const error = new TimeoutError("Custom message");
      expect(error.message).toBe("Custom message");
    });

    it("should be distinguishable from generic Error", () => {
      const timeoutError = new TimeoutError("Timeout");
      const genericError = new Error("Generic");

      expect(timeoutError).toBeInstanceOf(TimeoutError);
      expect(genericError).not.toBeInstanceOf(TimeoutError);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should timeout slow API calls", async () => {
      const slowApiCall = async () => {
        // Simulate slow API
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { data: "result" };
      };

      await expect(withTimeout(slowApiCall, 100)).rejects.toThrow(
        TimeoutError
      );
    });

    it("should allow fast API calls", async () => {
      const fastApiCall = async () => {
        // Simulate fast API
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { data: "result" };
      };

      const result = await withTimeout(fastApiCall, 1000);
      expect(result).toEqual({ data: "result" });
    });

    it("should timeout infinite loops", async () => {
      const infiniteLoop = async () => {
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      };

      await expect(
        withTimeout(infiniteLoop, 100, "Infinite loop detected")
      ).rejects.toThrow("Infinite loop detected");
    });
  });
});
