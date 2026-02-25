import { describe, it, expect } from "vitest";
import {
  normalizeWhatsAppNumber,
  extractRemoteJid,
  parseWhatsAppIdentifier,
  normalizeE164BR,
  brMaybeAddNinthDigit,
} from "./whatsapp";

describe("normalizeWhatsAppNumber", () => {
  // ── Casos do enunciado ──────────────────────────────────────────────────
  it("strip JID @s.whatsapp.net (12 dígitos)", () => {
    expect(normalizeWhatsAppNumber("551505550987@s.whatsapp.net")).toBe(
      "+551505550987",
    );
  });

  it("número com espaços e hífen (12 dígitos)", () => {
    expect(normalizeWhatsAppNumber("55 31 9956-0309")).toBe("+553199560309");
  });

  it("número com + e parênteses (13 dígitos)", () => {
    expect(normalizeWhatsAppNumber("+55 (31) 99956-0309")).toBe(
      "+5531999560309",
    );
  });

  // ── Multi-device JID ────────────────────────────────────────────────────
  it("multi-device JID com :device suffix", () => {
    expect(
      normalizeWhatsAppNumber("5531999560309:108@s.whatsapp.net"),
    ).toBe("+5531999560309");
  });

  it("multi-device JID sem @, somente :device", () => {
    expect(normalizeWhatsAppNumber("5531999560309:108")).toBe(
      "+5531999560309",
    );
  });

  // ── Sem DDI (10 / 11 dígitos) ───────────────────────────────────────────
  it("11 dígitos sem DDI → prefixar 55", () => {
    expect(normalizeWhatsAppNumber("31999560309")).toBe("+5531999560309");
  });

  it("10 dígitos sem DDI → prefixar 55", () => {
    expect(normalizeWhatsAppNumber("3199560309")).toBe("+553199560309");
  });

  // ── Prefixo 00 ──────────────────────────────────────────────────────────
  it("prefixo 00 é removido antes de processar", () => {
    // 0055 + DDD 31 + 9d = 14 chars, depois de strip 00 fica 12 dígitos
    expect(normalizeWhatsAppNumber("005531999560309")).toBe("+5531999560309");
  });

  // ── Já no formato correto ───────────────────────────────────────────────
  it("E.164 já com + permanece igual", () => {
    expect(normalizeWhatsAppNumber("+5531999560309")).toBe("+5531999560309");
  });

  it("13 dígitos com 55 prefix sem +", () => {
    expect(normalizeWhatsAppNumber("5531999560309")).toBe("+5531999560309");
  });

  // ── Erros esperados ─────────────────────────────────────────────────────
  it("número muito curto lança erro com mensagem clara", () => {
    expect(() => normalizeWhatsAppNumber("123")).toThrow("inválido");
  });

  it("@lid com ID longo lança erro (não é telefone)", () => {
    // @lid IDs como "12345678901234@lid" → 14 dígitos após strip, inválido para BR
    expect(() =>
      normalizeWhatsAppNumber("12345678901234@lid"),
    ).toThrow("inválido");
  });

  // ── defaultCountryCode customizado ─────────────────────────────────────
  it("DDI customizado +1 (EUA) para 10 dígitos", () => {
    expect(normalizeWhatsAppNumber("2125551234", "1")).toBe("+12125551234");
  });
});

describe("extractRemoteJid", () => {
  it("classifica @s.whatsapp.net corretamente", () => {
    const result = extractRemoteJid("5531999560309@s.whatsapp.net");
    expect(result.kind).toBe("s.whatsapp.net");
    expect(result.jidRaw).toBe("5531999560309@s.whatsapp.net");
    expect(result.digits).toBe("5531999560309");
    expect(result.e164).toBe("+5531999560309");
  });

  it("classifica @g.us corretamente", () => {
    const result = extractRemoteJid("120363000000@g.us");
    expect(result.kind).toBe("g.us");
    expect(result.e164).toBeUndefined(); // grupo não é número E.164 válido
  });

  it("classifica @lid corretamente e e164 fica undefined", () => {
    const result = extractRemoteJid("12345678901234@lid");
    expect(result.kind).toBe("lid");
    expect(result.e164).toBeUndefined();
  });

  it("classifica número sem @ como unknown", () => {
    const result = extractRemoteJid("5531999560309");
    expect(result.kind).toBe("unknown");
    expect(result.e164).toBe("+5531999560309");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloco 1F — Novos testes: parseWhatsAppIdentifier, normalizeE164BR, brMaybeAddNinthDigit
// ─────────────────────────────────────────────────────────────────────────────

describe("parseWhatsAppIdentifier", () => {
  it("detecta @lid e retorna kind=lid", () => {
    const result = parseWhatsAppIdentifier("12345678901234@lid");
    expect(result.kind).toBe("lid");
    expect(result.domain).toBe("lid");
    expect(result.digits).toBe("12345678901234");
  });

  it("detecta @s.whatsapp.net com digits corretos", () => {
    const result = parseWhatsAppIdentifier("5531999560309@s.whatsapp.net");
    expect(result.kind).toBe("jid");
    expect(result.digits).toBe("5531999560309");
    expect(result.domain).toBe("s.whatsapp.net");
  });

  it("detecta @g.us como group", () => {
    const result = parseWhatsAppIdentifier("120363000000@g.us");
    expect(result.kind).toBe("group");
  });

  it("detecta número puro como digits", () => {
    const result = parseWhatsAppIdentifier("+5531999560309");
    expect(result.kind).toBe("digits");
    expect(result.digits).toBe("5531999560309");
  });
});

describe("normalizeE164BR", () => {
  it("rejeita @lid com mensagem 'LID não é telefone'", () => {
    expect(() => normalizeE164BR("12345678901234@lid")).toThrow(
      "LID não é telefone",
    );
  });

  it("rejeita ID longo sem DDI 55 com mensagem 'Parece ID, não telefone'", () => {
    // 169634045112437 = 15 dígitos sem prefixo 55 → é ID, não telefone
    expect(() => normalizeE164BR("169634045112437")).toThrow(
      "Parece ID, não telefone",
    );
  });

  it("normaliza corretamente número brasileiro válido", () => {
    expect(normalizeE164BR("5531999560309")).toBe("+5531999560309");
  });
});

describe("brMaybeAddNinthDigit", () => {
  it("12 dígitos BR → retorna [original, variante com 9.º dígito]", () => {
    // "+55" + "15" (DDD) + "05550987" (8d) = 12d → inserir 9 após DDD
    expect(brMaybeAddNinthDigit("+551505550987")).toEqual([
      "+551505550987",
      "+5515905550987",
    ]);
  });

  it("13 dígitos BR → retorna somente [original]", () => {
    // "+55" + "31" (DDD) + "9" + "99560309" (8d) = 13d → já tem 9.º dígito
    expect(brMaybeAddNinthDigit("+5531999560309")).toEqual(["+5531999560309"]);
  });
});
