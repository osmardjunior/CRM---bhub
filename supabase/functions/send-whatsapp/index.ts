import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  normalizeWhatsAppNumber,
  extractRemoteJid,
  normalizeE164BR,
  brMaybeAddNinthDigit,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Allow internal service-to-service calls (e.g. process-scheduled-messages)
    // by bypassing user JWT verification when the caller presents the service role key.
    const authToken = authHeader.replace(/^Bearer\s+/i, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceRoleCall = serviceRoleKey.length > 0 && authToken === serviceRoleKey;

    if (!isServiceRoleCall) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { conversation_id, body: messageBody, media_url } = await req.json();

    if (!conversation_id || (!messageBody && !media_url)) {
      return new Response(
        JSON.stringify({ error: "conversation_id and body or media_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("*, contact:contacts!conversations_contact_id_fkey(id,phone,phone_e164,wa_identifier_raw), integration:integrations!conversations_integration_id_fkey(id,provider,channel,status,config,phone_number)")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // LID contacts: wa_identifier_raw is set but phone/phone_e164 are null
    if (!conv.contact?.phone && !conv.contact?.phone_e164 && conv.contact?.wa_identifier_raw) {
      return new Response(
        JSON.stringify({
          ok: false,
          delivered: false,
          error: "Contato identificado por LID do WhatsApp (sem número de telefone). Adicione o número de telefone ao contato para responder.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prioridade: phone_e164 (já normalizado) > phone (bruto)
    const rawPhone = conv.contact?.phone_e164 ?? conv.contact?.phone;
    if (!rawPhone) {
      return new Response(
        JSON.stringify({ error: "Contato sem número de telefone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalize to E.164 (+55...). Returns 422 for unparseable numbers so the UI
    // can show a meaningful error instead of getting a cryptic 400 from Evolution.
    // normalizeE164BR rejeita explicitamente LIDs e IDs longos com mensagem clara.
    let phone: string;
    try {
      phone = normalizeE164BR(rawPhone);
    } catch (normErr: any) {
      const { jidRaw, kind } = extractRemoteJid(rawPhone);
      console.error(
        `[send-whatsapp] Número inválido — jidRaw=${jidRaw} kind=${kind}: ${normErr.message}`,
      );
      return new Response(
        JSON.stringify({ ok: false, delivered: false, error: normErr.message }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For Evolution API: groups need the @g.us JID; individuals use E.164 and
    // let Evolution resolve the correct JID internally. This avoids exists:false
    // errors that happen when we construct the wrong JID format ourselves.
    const isGroupPhone =
      rawPhone.includes("@g.us") ||
      rawPhone.replace(/@.*$/, "").replace(/:.*$/, "").startsWith("120363");

    // The destination we pass to Evolution's `number` field:
    //   - Group:      "120363xxxx@g.us" (JID format, required for groups)
    //   - Individual: "+5511999999999"  (E.164 — Evolution resolves JID internally)
    const evolutionDest = isGroupPhone
      ? rawPhone.replace(/@.*$/, "").replace(/:.*$/, "") + "@g.us"
      : phone; // E.164 with +

    console.log(
      `[send-whatsapp] jidRaw=${rawPhone} → e164=${phone} → evolutionDest=${evolutionDest}`,
    );

    // Resolve integration: prefer the one stored on the conversation (integration_id),
    // fall back to first connected integration for the company+channel.
    // IMPORTANT: do NOT gate on status === "connected" here — DB status can be stale.
    let integration: any = null;
    const linkedInteg = (conv as any).integration;
    if (linkedInteg) {
      integration = linkedInteg;
      console.log(`Using linked integration ${linkedInteg.id} for conversation ${conversation_id}`);
    } else {
      const { data: integrations } = await supabase
        .from("integrations")
        .select("*")
        .eq("company_id", conv.company_id)
        .eq("channel", conv.channel)
        .eq("status", "connected")
        .order("created_at", { ascending: true })
        .limit(1);
      integration = integrations?.[0] ?? null;
      if (integration) {
        console.log(`Fallback: using integration ${integration.id} for conversation ${conversation_id}`);
      }
    }

    if (!integration) {
      return new Response(
        JSON.stringify({ ok: true, delivered: false, reason: "No active integration found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const config = integration.config as Record<string, any>;
    const provider = integration.provider;
    let delivered = false;
    let externalError: string | null = null;
    let evolutionMessageId: string | null = null;

    try {
      if (provider === "meta" || provider === "Meta Cloud API") {
        const accessToken = config.access_token || config.token;
        const phoneNumberId = config.phone_number_id;
        if (!accessToken || !phoneNumberId) throw new Error("Meta config missing access_token or phone_number_id");

        const res = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone.replace(/\D/g, ""),
              type: "text",
              text: { body: messageBody },
            }),
          },
        );
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Meta API error: ${err}`);
        }
        delivered = true;
      } else if (provider === "twilio" || provider === "Twilio") {
        const accountSid = config.account_sid;
        const authToken = config.auth_token;
        const fromNumber = config.from_number;
        if (!accountSid || !authToken || !fromNumber) throw new Error("Twilio config missing credentials");

        const params = new URLSearchParams();
        params.append("To", `whatsapp:${phone.replace(/\D/g, "")}`);
        params.append("From", `whatsapp:${fromNumber}`);
        params.append("Body", messageBody);

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params,
          },
        );
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Twilio API error: ${err}`);
        }
        delivered = true;
      } else if (provider === "360dialog" || provider === "360Dialog") {
        const apiKey = config.api_key;
        if (!apiKey) throw new Error("360dialog config missing api_key");

        const res = await fetch("https://waba.360dialog.io/v1/messages", {
          method: "POST",
          headers: {
            "D360-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phone.replace(/\D/g, ""),
            type: "text",
            text: { body: messageBody },
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`360dialog API error: ${err}`);
        }
        delivered = true;
      } else if (provider === "gupshup" || provider === "Gupshup") {
        const apiKey = config.api_key;
        const appName = config.app_name;
        const fromNumber = (integration as any).phone_number || config.from_number;
        if (!apiKey) throw new Error("Gupshup config missing api_key");

        const params = new URLSearchParams();
        params.append("channel", "whatsapp");
        params.append("source", (fromNumber || "").replace(/\D/g, ""));
        params.append("destination", phone.replace(/\D/g, ""));
        params.append("message", JSON.stringify({ type: "text", text: messageBody }));
        if (appName) params.append("src.name", appName);

        const res = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
          method: "POST",
          headers: {
            apikey: apiKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Gupshup API error: ${err}`);
        }
        delivered = true;
      } else if (provider === "evolution" || provider === "Evolution") {
        const apiKey = config.api_key as string;
        let apiUrl = (config.api_url as string || "").trim().replace(/\/+$/, "");
        if (!/^https?:\/\//i.test(apiUrl)) {
          apiUrl = `https://${apiUrl}`;
        }
        const instanceName = config.instance_name as string;
        if (!apiKey || !apiUrl || !instanceName) throw new Error("Evolution config missing api_key, api_url or instance_name");

        if (media_url) {
          // Detect media type from URL
          const lower = media_url.toLowerCase();
          let mediaType = "document";
          if (/\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/.test(lower) || lower.includes("image")) mediaType = "image";
          else if (/\.(ogg|mp3|m4a|opus|aac|wav|webm)(\?|$)/.test(lower) || lower.includes("audio") || lower.includes("ptt")) mediaType = "audio";
          else if (/\.(mp4|3gp|mov|avi)(\?|$)/.test(lower) || lower.includes("video")) mediaType = "video";

          if (mediaType === "audio") {
            const res = await fetch(`${apiUrl}/message/sendWhatsAppAudio/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({ number: evolutionDest, audio: media_url }),
            });
            const resBody = await res.text();
            console.log("Evolution sendWhatsAppAudio response:", res.status, resBody);
            if (!res.ok) throw new Error(`Evolution API audio error: ${resBody}`);
            delivered = true;
          } else {
            const payload: Record<string, any> = {
              number: evolutionDest,
              mediatype: mediaType,
              media: media_url,
            };
            if (messageBody) payload.caption = messageBody;
            if (mediaType === "document") {
              payload.fileName = media_url.split("/").pop()?.split("?")[0] || "document";
            }
            const res = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify(payload),
            });
            const resBody = await res.text();
            console.log("Evolution sendMedia response:", res.status, resBody);
            if (!res.ok) throw new Error(`Evolution API media error: ${resBody}`);
            delivered = true;
          }
        } else {
          // Evolution API v2 sendText com retry de 9.º dígito.
          // Para números BR de 12 dígitos (sem 9.º dígito), Evolution pode retornar
          // exists:false. Nesse caso, tentamos com a variante de 13 dígitos (+9).
          const candidates = isGroupPhone ? [evolutionDest] : brMaybeAddNinthDigit(phone);
          let lastResBody = "";
          let lastResOk = false;
          let successPhone: string | null = null;

          for (let i = 0; i < candidates.length; i++) {
            const candidateDest = isGroupPhone ? evolutionDest : candidates[i];
            const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({ number: candidateDest, text: messageBody }),
            });
            lastResBody = await res.text();
            lastResOk = res.ok;
            console.log(`Evolution sendText [${candidateDest}] ${res.status}:`, lastResBody);

            if (res.ok) {
              successPhone = candidates[i];
              delivered = true;
              try {
                const resData = JSON.parse(lastResBody);
                evolutionMessageId = resData?.key?.id || resData?.id || null;
              } catch { /* ignore parse errors */ }
              break;
            }

            // Só tentar próximo candidato se foi exists:false (número desconhecido)
            const isExistsFalse = lastResBody.includes('"exists":false') || lastResBody.includes('"exists": false');
            if (!isExistsFalse || i === candidates.length - 1) {
              break;
            }
            console.log(`[send-whatsapp] exists:false para ${candidates[i]}, tentando variante com 9.º dígito`);
          }

          if (!delivered) throw new Error(`Evolution API error: ${lastResBody}`);

          // Se sucesso foi com variante do 9.º dígito, salvar phone_e164 correto no contato
          if (successPhone && successPhone !== phone && conv.contact?.id) {
            await supabase
              .from("contacts")
              .update({ phone_e164: successPhone })
              .eq("id", conv.contact.id);
            console.log(`[send-whatsapp] Atualizado phone_e164=${successPhone} após retry 9.º dígito`);
          }
        }
      } else {
        externalError = `Unknown provider: ${provider}`;
      }
    } catch (e: any) {
      externalError = e.message;
      console.error("External delivery error:", e);
    }

    return new Response(
      JSON.stringify({ ok: true, delivered, error: externalError, message_id: evolutionMessageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("send-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
