import { describe, it, expect } from "vitest";
import { usernameToEmail, isOverdue } from "@/lib/domain";

describe("domain rules", () => {
  it("maps admin logins to internal account emails", () => {
    expect(usernameToEmail("Ederson.Silveira")).toBe("ederson.silveira@trivium.local");
  });
  it("flags tickets closed after the deadline as overdue", () => {
    expect(isOverdue({ due_at: "2026-01-01T00:00:00Z", status: "concluido", closed_at: "2026-01-02T00:00:00Z" })).toBe(true);
    expect(isOverdue({ due_at: "2026-01-03T00:00:00Z", status: "concluido", closed_at: "2026-01-02T00:00:00Z" })).toBe(false);
  });
});
