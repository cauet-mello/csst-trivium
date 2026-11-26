import { expect, it } from "vitest";
import { readData } from "@/lib/query-result";
it("does not disguise a failed request as an empty result", () => {
  expect(() => readData({ data: null, error: { message: "denied" } })).toThrow();
  expect(readData({ data: [1], error: null })).toEqual([1]);
});