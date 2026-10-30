import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  roles: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
    from: mocks.from,
  },
}));

import { signInToApp } from "@/lib/login";

describe("Password access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.signIn.mockResolvedValue({ data: { user: { id: "staff-id" } }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ select: () => ({ eq: mocks.roles }) });
  });

  it("opens /painel for requester mode without an administrative lookup", async () => {
    expect(await signInToApp(" Cauet.Mello ", "test-password", "requester")).toBe("/painel");
    expect(mocks.signIn).toHaveBeenCalledWith({ email: "cauet.mello@trivium.local", password: "test-password" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each(["admin", "developer"])("opens /dashboard for the %s role", async (role) => {
    mocks.roles.mockResolvedValue({ data: [{ role }], error: null });
    expect(await signInToApp("cauet.mello", "test-password", "admin")).toBe("/dashboard");
    expect(mocks.roles).toHaveBeenCalledWith("user_id", "staff-id");
  });

  it("signs out a requester attempting administrative access", async () => {
    mocks.roles.mockResolvedValue({ data: [{ role: "requester" }], error: null });
    await expect(signInToApp("requester", "test-password", "admin")).rejects.toThrow();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("rejects a failed role lookup instead of returning a destination", async () => {
    mocks.roles.mockResolvedValue({ data: null, error: { message: "lookup failed" } });
    await expect(signInToApp("cauet.mello", "test-password", "admin")).rejects.toThrow();
  });

  it("rejects invalid credentials before querying roles", async () => {
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: "invalid credentials" } });
    await expect(signInToApp("cauet.mello", "wrong-password", "admin")).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});