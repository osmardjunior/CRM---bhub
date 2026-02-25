/**
 * Utilitários de normalização de números WhatsApp.
 *
 * Regras de normalização (normalizeWhatsAppNumber):
 *  a) Remove sufixo JID (@s.whatsapp.net, @g.us, @lid, etc.)
 *  b) Remove sufixo de dispositivo (:108 em multi-device JIDs)
 *  c) Mantém apenas dígitos
 *  d) Remove prefixo "00"
 *  e) Prefixa DDI quando o número tem 10 ou 11 dígitos sem DDI
 *  f) Valida comprimento (Brasil: 12 ou 13 dígitos)
 *  g) Retorna sempre com "+" prefixado: "+<dígitos>"
 */

/**
 * Normaliza um número de telefone ou JID do WhatsApp para formato E.164.
 *
 * @param input - Número, JID ou string com formatação variada
 * @param defaultCountryCode - DDI padrão a prefixar quando ausente (default: "55" = Brasil)
 * @returns Número em formato E.164 com "+", ex: "+5531999560309"
 * @throws Error se o resultado final tiver comprimento inválido
 */
export function normalizeWhatsAppNumber(
  input: string,
  defaultCountryCode = "55",
): string {
  // a) remover sufixo JID (tudo após "@", inclusive @s.whatsapp.net, @lid, @g.us)
  const withoutJid = input.replace(/@.*$/, "");

  // b) remover sufixo de dispositivo multi-device (ex: "9299597994:108" → "9299597994")
  const withoutDevice = withoutJid.replace(/:.*$/, "");

  // c) manter somente dígitos
  let digits = withoutDevice.replace(/\D/g, "");

  // d) remover prefixo "00" (formato internacional antigo)
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // e) prefixar DDI quando o número tem 10 ou 11 dígitos sem o código do país
  if (
    !digits.startsWith(defaultCountryCode) &&
    (digits.length === 10 || digits.length === 11)
  ) {
    digits = defaultCountryCode + digits;
  }

  // f) validar comprimento final
  const valid =
    defaultCountryCode === "55"
      ? digits.length === 12 || digits.length === 13 // 55+DDD+8d ou 55+DDD+9d
      : digits.length >= 7 && digits.length <= 15; // padrão internacional E.164

  if (!valid) {
    throw new Error(
      `Número inválido: "${input}" → "${digits}" (${digits.length} dígitos; esperado ${
        defaultCountryCode === "55" ? "12 ou 13" : "7–15"
      } para DDI ${defaultCountryCode})`,
    );
  }

  // g) retornar com "+"
  return "+" + digits;
}

/** Tipo de JID retornado pela Evolution API */
export type JidKind = "s.whatsapp.net" | "lid" | "g.us" | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// Novas funções para tratamento robusto de LID / IDs longos / 9.º dígito BR
// ─────────────────────────────────────────────────────────────────────────────

/** Tipo de identificador WhatsApp detectado por parseWhatsAppIdentifier */
export type WhatsAppIdKind = "jid" | "lid" | "group" | "digits" | "unknown";

/**
 * Decompõe um identificador WhatsApp (JID, LID ou número puro) nos seus componentes.
 *
 * @param input - JID completo (ex: "5531999560309@s.whatsapp.net"), LID, número ou string genérica
 * @returns Objeto com raw, kind, localPart (antes do @), digits e domain
 */
export function parseWhatsAppIdentifier(input: string): {
  raw: string;
  kind: WhatsAppIdKind;
  localPart?: string;
  digits?: string;
  domain?: string;
} {
  const atIndex = input.indexOf("@");

  if (atIndex === -1) {
    // Sem domínio — verifica se é somente dígitos com formatação
    const stripped = input.replace(/[\s\-+().]/g, "");
    const allDigits = /^\d+$/.test(stripped) && stripped.length > 0;
    return {
      raw: input,
      kind: allDigits ? "digits" : "unknown",
      digits: allDigits ? stripped : undefined,
    };
  }

  // Remove sufixo de dispositivo multi-device (:108, etc.)
  const localPart = input.slice(0, atIndex).replace(/:.*$/, "");
  const domain = input.slice(atIndex + 1);
  const digits = localPart.replace(/\D/g, "");

  let kind: WhatsAppIdKind;
  if (domain === "lid") {
    kind = "lid";
  } else if (domain === "s.whatsapp.net") {
    kind = "jid";
  } else if (domain === "g.us") {
    kind = "group";
  } else {
    kind = "unknown";
  }

  return { raw: input, kind, localPart, digits: digits || undefined, domain };
}

/**
 * Normaliza um identificador WhatsApp para E.164 brasileiro.
 *
 * Diferente de `normalizeWhatsAppNumber`, esta função rejeita EXPLICITAMENTE:
 *  - LIDs (@lid) → lança "LID não é telefone"
 *  - IDs longos (14–18 dígitos sem o DDI) → lança "Parece ID, não telefone"
 *
 * @param input - Número, JID ou string com formatação variada
 * @param defaultCC - DDI padrão (default: "55" = Brasil)
 * @returns Número em formato E.164 com "+", ex: "+5531999560309"
 * @throws Error para LID, IDs longos ou comprimento inválido
 */
export function normalizeE164BR(input: string, defaultCC = "55"): string {
  const parsed = parseWhatsAppIdentifier(input);

  // Rejeitar explicitamente LID — não é número de telefone
  if (parsed.kind === "lid") {
    throw new Error(
      `LID não é telefone: "${input}" é um ID de dispositivo WhatsApp (LID)`,
    );
  }

  // Rejeitar grupos
  if (parsed.kind === "group") {
    throw new Error(`Grupo não é telefone: "${input}"`);
  }

  // Extrair dígitos (remove @domínio e :device)
  const withoutJid = input.replace(/@.*$/, "").replace(/:.*$/, "");
  let digits = withoutJid.replace(/\D/g, "");

  // Remover prefixo "00" (formato internacional antigo)
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Rejeitar IDs longos sem DDI — ex: "169634045112437" (15d sem 55)
  if (
    digits.length >= 14 &&
    digits.length <= 18 &&
    !digits.startsWith(defaultCC)
  ) {
    throw new Error(
      `Parece ID, não telefone: "${input}" tem ${digits.length} dígitos sem DDI ${defaultCC}`,
    );
  }

  // Prefixar DDI quando 10 ou 11 dígitos sem código do país
  if (
    !digits.startsWith(defaultCC) &&
    (digits.length === 10 || digits.length === 11)
  ) {
    digits = defaultCC + digits;
  }

  // Validar comprimento final
  const valid =
    defaultCC === "55"
      ? digits.length === 12 || digits.length === 13
      : digits.length >= 7 && digits.length <= 15;

  if (!valid) {
    throw new Error(
      `Número inválido: "${input}" → "${digits}" (${digits.length} dígitos; esperado ${
        defaultCC === "55" ? "12 ou 13" : "7–15"
      } para DDI ${defaultCC})`,
    );
  }

  return "+" + digits;
}

/**
 * Retorna candidatos de número para retry quando a Evolution API retorna exists:false.
 *
 * No Brasil, números com 8 dígitos locais (sem o 9.º dígito) podem não ser encontrados
 * com o formato antigo. Esta função gera a variante com o 9 inserido após o DDD.
 *
 * @param e164 - Número em formato E.164, ex: "+551505550987"
 * @returns Array com 1 ou 2 candidatos:
 *   - 12 dígitos BR → [original, variante com 9.º dígito]
 *   - 13 dígitos BR → [original] (já tem 9.º dígito)
 *   - outros → [original]
 *
 * @example
 *   brMaybeAddNinthDigit("+551505550987")  // 12d → ["+551505550987", "+5515905550987"]
 *   brMaybeAddNinthDigit("+5531999560309") // 13d → ["+5531999560309"]
 */
export function brMaybeAddNinthDigit(e164: string): string[] {
  if (!e164.startsWith("+")) return [e164];

  const digits = e164.slice(1); // remove "+"

  // Apenas números brasileiros (55 + DDD + local)
  if (!digits.startsWith("55")) return [e164];

  // 12 dígitos = 55(2) + DDD(2) + local(8) → formato antigo sem 9.º dígito
  if (digits.length === 12) {
    const ddd = digits.slice(2, 4);   // ex: "15"
    const local = digits.slice(4);    // ex: "05550987" (8 dígitos)
    const variant = "+55" + ddd + "9" + local; // "+5515905550987"
    return [e164, variant];
  }

  // 13 dígitos → já tem o 9.º dígito, nenhum retry necessário
  return [e164];
}

/**
 * Decompõe um JID bruto do WhatsApp para fins de log/auditoria.
 *
 * @param raw - JID bruto, ex: "5531999560309:108@s.whatsapp.net"
 * @returns Objeto com jidRaw, digits, e164 (se válido) e kind
 */
export function extractRemoteJid(raw: string): {
  jidRaw: string;
  digits: string;
  e164?: string;
  kind: JidKind;
} {
  const kind: JidKind = raw.includes("@s.whatsapp.net")
    ? "s.whatsapp.net"
    : raw.includes("@lid")
      ? "lid"
      : raw.includes("@g.us")
        ? "g.us"
        : "unknown";

  const withoutJid = raw.replace(/@.*$/, "").replace(/:.*$/, "");
  const digits = withoutJid.replace(/\D/g, "");

  // Grupos (@g.us) e @lid não são números de telefone — não normalizar para E.164
  let e164: string | undefined;
  if (kind !== "g.us" && kind !== "lid") {
    try {
      e164 = normalizeWhatsAppNumber(raw);
    } catch {
      // número inválido — e164 permanece undefined
    }
  }

  return { jidRaw: raw, digits, e164, kind };
}
