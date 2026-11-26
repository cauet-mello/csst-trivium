import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ensureStaff } from "@/lib/staff-access";

const lookup = vi.fn();
const client = { from: () => ({ select: () => ({ eq: lookup }) }) } as unknown as SupabaseClient<Database>;
describe("staff account protection", () => {
  beforeEach(() => vi.resetAllMocks());
  it("denies requesters access to account management", async () => {
    lookup.mockResolvedValue({ data: [{ role: "requester" }], error: null });
    await expect(ensureStaff(client, "requester-id")).rejects.toThrow();
  });
  it("denies administrators changes to developer accounts", async () => {
    lookup.mockResolvedValueOnce({ data: [{ role: "admin" }], error: null });
    lookup.mockResolvedValueOnce({ data: [{ role: "developer" }], error: null });
    await expect(ensureStaff(client, "admin-id", "developer-id")).rejects.toThrow();
  });
  it("allows developers to manage staff", async () => {
    lookup.mockResolvedValue({ data: [{ role: "developer" }], error: null });
    expect(await ensureStaff(client, "developer-id", "admin-id")).toEqual(["developer"]);
  });
  it("fails closed when role lookup fails", async () => {
    lookup.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(ensureStaff(client, "admin-id")).rejects.toThrow();
  });
});