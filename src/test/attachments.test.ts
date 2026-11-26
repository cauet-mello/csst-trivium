import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { MAX_ATTACHMENT_BYTES, validateAttachment } from "@/lib/attachments";

describe("attachment limits", () => {
  it("accepts exactly 20 MB and rejects one byte above it", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(20 * 1024 * 1024);
    expect(() => validateAttachment({ name: "foto.png", size: 20 * 1024 * 1024 })).not.toThrow();
    expect(() => validateAttachment({ name: "foto.png", size: 20 * 1024 * 1024 + 1 })).toThrow();
  });
  it("rejects an empty attachment", () => {
    expect(() => validateAttachment({ name: "foto.png", size: 0 })).toThrow();
  });
});