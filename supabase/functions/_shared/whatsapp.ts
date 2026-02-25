/**
 * Utilitários de normalização de números WhatsApp — módulo compartilhado Deno.
 *
 * Usado por: send-whatsapp, incoming-message
 *
 * Regras (normalizeWhatsAppNumber):
 *  a) Remove sufixo JID (@s.whatsapp.net, @g.us, @lid, etc.)
 *  b) Remove sufixo de dispositivo (:108 em multi-device JIDs)
 *  c) Mantém apenas dígitos
 *  d) Remove prefixo "00"
 *  e) Prefixa DDI quando o número tem 10 ou 11 dígitos sem DDI
 *  f) Valida comprimento (Brasil: 12 ou 13 dígitos)
 *  g) Retorna sempre com "+" prefixado: "+<dígitos>"
 *
 * Diferença da versão frontend:
 *  - normalizeWhatsAppNumberSafe() retorna null para @lid e outros inválidos
 *    em vez de lançar exceção — útil em webhooks onde não podemos parar o fluxo.
 */

/**
 * Normaliza um número de telefone ou JID do WhatsApp para formato E.164.
 *
 * @throws Error se o comprimento final for inválido
 */
export function normalizeWhatsAppNumber(
  input: string,
  defaultCountryCode = "55",
): string {
  // a) remover sufixo JID
  const withoutJid = input.replace(/@.*$/, "");
  // b) remover sufixo de dispositivo multi-device
  const withoutDevice = withoutJid.replace(/:.*$/, "");
  // c) manter somente dígitos
  let digits = withoutDevice.replace(/\D/g, "");
  // d) remover prefixo "00"
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  // e) prefixar DDI quando 10 ou 11 dígitos sem código do país
  if (
    !digits.startsWith(defaultCountryCode) &&
    (digits.length === 10 || digits.length === 11)
  ) {
    digits = defaultCountryCode + digits;
  }
  // f) validar comprimento
  const valid =
    defaultCountryCode === "55"
      ? digits.length === 12 || digits.length === 13
      : digits.length >= 7 && digits.length <= 15;

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

/**
 * Versão segura: retorna null se o número não puder ser normalizado
 * (útil em webhooks onde não queremos interromper o fluxo por um número inválido).
 */
export function normalizeWhatsAppNumberSafe(
  input: string,
  defaultCountryCode = "55",
): string | null {
  try {
    return normalizeWhatsAppNumber(input, defaultCountryCode);
  } catch {
    return null;
  }
}

/** Tipo de JID do WhatsApp */
export type JidKind = "s.whatsapp.net" | "lid" | "g.us" | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// Novas funções para tratamento robusto de LID / IDs longos / 9.º dígito BR
// ─────────────────────────────────────────────────────────────────────────────

/** Tipo de identificador WhatsApp detectado por parseWhatsAppIdentifier */
export type WhatsAppIdKind = "jid" | "lid" | "group" | "digits" | "unknown";

/**
 * Decompõe um identificador WhatsApp (JID, LID ou número puro) nos seus componentes.
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
    const stripped = input.replace(/[\s\-+().]/g, "");
    const allDigits = /^\d+$/.test(stripped) && stripped.length > 0;
    return {
      raw: input,
      kind: allDigits ? "digits" : "unknown",
      digits: allDigits ? stripped : undefined,
    };
  }

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
 * Rejeita explicitamente LIDs e IDs longos.
 *
 * @throws Error para LID, IDs longos ou comprimento inválido
 */
export function normalizeE164BR(input: string, defaultCC = "55"): string {
  const parsed = parseWhatsAppIdentifier(input);

  if (parsed.kind === "lid") {
    throw new Error(
      `LID não é telefone: "${input}" é um ID de dispositivo WhatsApp (LID)`,
    );
  }

  if (parsed.kind === "group") {
    throw new Error(`Grupo não é telefone: "${input}"`);
  }

  const withoutJid = input.replace(/@.*$/, "").replace(/:.*$/, "");
  let digits = withoutJid.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (
    digits.length >= 14 &&
    digits.length <= 18 &&
    !digits.startsWith(defaultCC)
  ) {
    throw new Error(
      `Parece ID, não telefone: "${input}" tem ${digits.length} dígitos sem DDI ${defaultCC}`,
    );
  }

  if (
    !digits.startsWith(defaultCC) &&
    (digits.length === 10 || digits.length === 11)
  ) {
    digits = defaultCC + digits;
  }

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
 * Versão segura de normalizeE164BR — retorna null em vez de lançar erro.
 */
export function normalizeE164BRSafe(
  input: string,
  defaultCC = "55",
): string | null {
  try {
    return normalizeE164BR(input, defaultCC);
  } catch {
    return null;
  }
}

/**
 * Retorna candidatos de número para retry quando a Evolution API retorna exists:false.
 *
 * @param e164 - Número em formato E.164, ex: "+551505550987"
 * @returns [original] ou [original, varianteComNono]
 */
export function brMaybeAddNinthDigit(e164: string): string[] {
  if (!e164.startsWith("+")) return [e164];

  const digits = e164.slice(1);

  if (!digits.startsWith("55")) return [e164];

  if (digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const local = digits.slice(4);
    const variant = "+55" + ddd + "9" + local;
    return [e164, variant];
  }

  return [e164];
}

/**
 * Detecta se um JID pertence a um grupo
 */
export function isGroupJid(jid: string): boolean {
  if (jid.includes("@g.us")) return true;
  const digits = jid.replace(/@.*$/, "").replace(/:.*$/, "").replace(/\D/g, "");
  if (digits.startsWith("120363")) return true;
  if (digits.length >= 18) return true;
  return false;
}

/**
 * Decompõe um JID bruto para fins de log/auditoria.
 */
export function extractRemoteJid(raw: string): {
  jidRaw: string;
  digits: string;
  e164: string | null;
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
  const e164 = normalizeWhatsAppNumberSafe(raw);

  return { jidRaw: raw, digits, e164, kind };
}
