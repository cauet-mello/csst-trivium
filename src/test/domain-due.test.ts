import { describe, expect, it } from "vitest";
import { isDueSoon } from "@/lib/domain";

const now = new Date("2026-11-26T12:00:00Z");
const t = (hoursLeft: number, status = "em_andamento", closed_at: string | null = null) => ({ due_at: new Date(now.getTime() + hoursLeft * 3600_000).toISOString(), status, closed_at });

describe("alerta de prazo", () => {
  it("avisa quando faltam menos de 24 horas", () => expect(isDueSoon(t(5), now)).toBe(true));
  it("não avisa com mais de 24 horas", () => expect(isDueSoon(t(30), now)).toBe(false));
  it("não avisa se o prazo já passou", () => expect(isDueSoon(t(-1), now)).toBe(false));
  it("não avisa para chamado concluído", () => expect(isDueSoon(t(5, "concluido", now.toISOString()), now)).toBe(false));
});
