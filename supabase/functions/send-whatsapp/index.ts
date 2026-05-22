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
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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

    // ── PATCH — Edit message on WhatsApp ──
    if (req.method === "PATCH") {
      const { conversation_id: editConvId, message_id, external_message_id, new_body } = await req.json();
      if (!editConvId || !message_id || !new_body) {
        return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch external_message_id from DB if not provided by caller
      let extMsgId = external_message_id;
      if (!extMsgId) {
        const { data: dbMsg } = await supabase.from("messages").select("external_message_id").eq("id", message_id).maybeSingle();
        extMsgId = dbMsg?.external_message_id ?? null;
      }
      if (!extMsgId) {
        console.warn(`[send-whatsapp] PATCH: no external_message_id for message ${message_id}`);
        return new Response(JSON.stringify({ ok: false, error: "Mensagem sem ID externo do WhatsApp. Só mensagens enviadas após a correção podem ser editadas." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: editConv } = await supabase
        .from("conversations")
        .select("*, contact:contacts!conversations_contact_id_fkey(phone,phone_e164), integration:integrations!conversations_integration_id_fkey(id,provider,config)")
        .eq("id", editConvId).single();

      if (!editConv?.integration) {
        return new Response(JSON.stringify({ ok: false, error: "Nenhuma integração encontrada para esta conversa" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const prov = editConv.integration.provider;
      if (prov !== "evolution" && prov !== "Evolution") {
        return new Response(JSON.stringify({ ok: false, error: `Edição não suportada para provider: ${prov}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cfg = editConv.integration.config as Record<string, any>;
      let apiUrl = (cfg.api_url as string || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(apiUrl)) apiUrl = `https://${apiUrl}`;
      const phone = editConv.contact?.phone_e164 ?? editConv.contact?.phone ?? "";
      const phoneDigits = phone.replace(/\D/g, "");
      const remoteJid = `${phoneDigits}@s.whatsapp.net`;
      try {
        // Evolution API v2: POST /chat/updateMessage/{instance}
        const editRes = await fetch(`${apiUrl}/chat/updateMessage/${cfg.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: cfg.api_key },
          body: JSON.stringify({
            number: phoneDigits,
            text: new_body,
            key: { remoteJid, fromMe: true, id: extMsgId },
          }),
        });
        const editResText = await editRes.text();
        console.log(`[send-whatsapp] PATCH edit response: ${editRes.status} ${editResText}`);
        if (!editRes.ok) {
          return new Response(JSON.stringify({ ok: false, error: `Evolution API ${editRes.status}: ${editResText}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        console.error("[send-whatsapp] PATCH edit error:", e.message);
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── DELETE — Delete message for everyone on WhatsApp ──
    if (req.method === "DELETE") {
      const { conversation_id: delConvId, message_id } = await req.json();
      if (!delConvId || !message_id) {
        return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: delMsg } = await supabase.from("messages").select("external_message_id").eq("id", message_id).maybeSingle();
      if (!delMsg?.external_message_id) {
        console.warn(`[send-whatsapp] DELETE: no external_message_id for message ${message_id}`);
        return new Response(JSON.stringify({ ok: false, error: "Mensagem sem ID externo do WhatsApp. Só mensagens enviadas após a correção podem ser apagadas no WhatsApp." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: delConv } = await supabase
        .from("conversations")
        .select("*, contact:contacts!conversations_contact_id_fkey(phone,phone_e164), integration:integrations!conversations_integration_id_fkey(id,provider,config)")
        .eq("id", delConvId).single();

      if (!delConv?.integration) {
        return new Response(JSON.stringify({ ok: false, error: "Nenhuma integração encontrada para esta conversa" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const prov = delConv.integration.provider;
      if (prov !== "evolution" && prov !== "Evolution") {
        return new Response(JSON.stringify({ ok: false, error: `Exclusão não suportada para provider: ${prov}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cfg = delConv.integration.config as Record<string, any>;
      let apiUrl = (cfg.api_url as string || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(apiUrl)) apiUrl = `https://${apiUrl}`;
      const phone = delConv.contact?.phone_e164 ?? delConv.contact?.phone ?? "";
      const phoneDigits = phone.replace(/\D/g, "");
      const remoteJid = `${phoneDigits}@s.whatsapp.net`;
      try {
        // Evolution API v2: DELETE /chat/deleteMessageForEveryone/{instance}
        const delRes = await fetch(`${apiUrl}/chat/deleteMessageForEveryone/${cfg.instance_name}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", apikey: cfg.api_key },
          body: JSON.stringify({
            id: delMsg.external_message_id,
            fromMe: true,
            remoteJid,
          }),
        });
        const delResText = await delRes.text();
        console.log(`[send-whatsapp] DELETE response: ${delRes.status} ${delResText}`);
        if (!delRes.ok) {
          return new Response(JSON.stringify({ ok: false, error: `Evolution API ${delRes.status}: ${delResText}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        console.error("[send-whatsapp] DELETE error:", e.message);
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const reqBody = await req.json();
    const { conversation_id, body: messageBody, media_url, reply_to_id, message_id: dbMessageId } = reqBody;

    if (!conversation_id || (!messageBody && !media_url)) {
      return new Response(
        JSON.stringify({ error: "conversation_id and body or media_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("*, contact:contacts!conversations_contact_id_fkey(id,phone,phone_e164,wa_identifier_raw), integration:integrations!conversations_integration_id_fkey(id,provider,channel,status,config,phone_number,project_id)")
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

    // ── Helper: simulate typing before sending (Evolution only) ──
    // Simulates human typing to avoid bot-pattern detection by WhatsApp.
    // Sends "composing" presence update, waits, then sends the actual message.
    async function sendTypingIndicator(apiUrl: string, instanceName: string, apiKey: string, number: string): Promise<void> {
      try {
        // Strip non-digits (keep @ and . for group JIDs)
        const digits = number.replace(/[^\d@.]/g, "");

        // Try Evolution v2 format first (options object)
        const v2Body = { number: digits, options: { delay: 1500, presence: "composing", number: digits } };
        const res = await fetch(`${apiUrl}/chat/sendPresence/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify(v2Body),
        });
        const txt = await res.text();
        console.log(`[send-whatsapp] sendPresence v2 ${res.status}: ${txt.slice(0, 300)}`);

        // If v2 format failed (400/404/422), try flat format (some Evolution versions)
        if (!res.ok) {
          const v1Body = { number: digits, delay: 1500, presence: "composing" };
          const res2 = await fetch(`${apiUrl}/chat/sendPresence/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify(v1Body),
          });
          const txt2 = await res2.text();
          console.log(`[send-whatsapp] sendPresence flat ${res2.status}: ${txt2.slice(0, 300)}`);
        }
      } catch (e: any) {
        console.warn(`[send-whatsapp] sendPresence error: ${e.message}`);
      }
    }

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // ── Helper: calculate number age in days ──
    function getNumberAgeDays(integration: any): number {
      const created = integration?.created_at;
      if (!created) return 999; // Unknown age = assume mature
      return Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000);
    }

    // ── Volume pressure calculator ──
    // Never blocks sending. Returns a "pressure" score (0-1) that determines
    // how much humanization delay to apply. Higher pressure = more delay.
    // This protects numbers by making high-volume sending look more human.
    function getWarmupThresholds(ageDays: number): { softMinute: number; softHour: number; softDay: number; hardMinute: number } {
      // "Soft" thresholds — when exceeded, delay increases progressively
      // "Hard" thresholds (2× soft) — when exceeded, message is QUEUED (not sent)
      if (ageDays <= 1)  return { softMinute: 1,  softHour: 15,  softDay: 30,  hardMinute: 2 };
      if (ageDays <= 3)  return { softMinute: 3,  softHour: 30,  softDay: 80,  hardMinute: 6 };
      if (ageDays <= 7)  return { softMinute: 5,  softHour: 60,  softDay: 150, hardMinute: 10 };
      if (ageDays <= 14) return { softMinute: 10, softHour: 100, softDay: 300, hardMinute: 20 };
      if (ageDays <= 30) return { softMinute: 15, softHour: 160, softDay: 450, hardMinute: 30 };
      return { softMinute: 20, softHour: 200, softDay: 600, hardMinute: 40 }; // Mature number
    }

    // ── Helper: calculate volume pressure for an integration ──
    // Uses a SINGLE query (select sent_at from last 24h) and counts in-memory.
    // This replaces 3 separate COUNT queries to reduce DB load.
    async function getVolumePressure(integrationId: string, integ: any): Promise<{
      pressure: number;
      countMinute: number;
      ageDays: number;
    }> {
      const ageDays = getNumberAgeDays(integ);
      const thresholds = getWarmupThresholds(ageDays);
      const now = Date.now();
      const oneDayAgo = new Date(now - 86_400_000).toISOString();

      // Single query: fetch timestamps from last 24h (max ~600 rows for busiest number)
      const { data: rows } = await supabase
        .from("send_rate_log")
        .select("sent_at")
        .eq("integration_id", integrationId)
        .gte("sent_at", oneDayAgo)
        .order("sent_at", { ascending: false })
        .limit(600);

      // Count in-memory by time window
      let countMinute = 0, countHour = 0, countDay = 0;
      const oneMinAgo = now - 60_000;
      const oneHourAgo = now - 3_600_000;
      for (const r of rows ?? []) {
        const t = new Date(r.sent_at).getTime();
        countDay++;
        if (t >= oneHourAgo) countHour++;
        if (t >= oneMinAgo) countMinute++;
      }

      const pressureMin = Math.min(countMinute / thresholds.softMinute, 1);
      const pressureHour = Math.min(countHour / thresholds.softHour, 1);
      const pressureDay = Math.min(countDay / thresholds.softDay, 1);
      const pressure = Math.max(pressureMin, pressureHour, pressureDay);

      return { pressure, countMinute, ageDays };
    }

    // ── Helper: log a sent message for rate limiting ──
    async function logRateLimitSend(integrationId: string): Promise<void> {
      // Cleanup old entries FIRST (scoped to this integration for index efficiency),
      // then insert — prevents table bloat even without pg_cron
      const cutoff = new Date(Date.now() - 25 * 3_600_000).toISOString();
      await supabase.from("send_rate_log").delete()
        .eq("integration_id", integrationId)
        .lt("sent_at", cutoff);
      await supabase.from("send_rate_log").insert({ integration_id: integrationId });
    }

    // ── Resolve quoted message for reply ──
    // Evolution API v2 format: { key: { id }, message: { conversation } }
    let quotedParam: Record<string, any> | null = null;
    if (reply_to_id) {
      const { data: quotedMsg } = await supabase
        .from("messages")
        .select("external_message_id, body")
        .eq("id", reply_to_id)
        .maybeSingle();
      if (quotedMsg?.external_message_id) {
        quotedParam = {
          key: {
            id: quotedMsg.external_message_id,
          },
          message: {
            conversation: quotedMsg.body ?? "",
          },
        };
        console.log(`[send-whatsapp] Reply to message ${quotedMsg.external_message_id}`);
      }
    }

    // ── Helper: attempt to send via a specific integration ──
    async function attemptSend(integ: any): Promise<{ delivered: boolean; error: string | null; messageId: string | null }> {
      const cfg = integ.config as Record<string, any>;
      const prov = integ.provider;
      let msgId: string | null = null;

      try {
        if (prov === "meta" || prov === "Meta Cloud API") {
          const accessToken = cfg.access_token || cfg.token;
          const phoneNumberId = cfg.phone_number_id;
          if (!accessToken || !phoneNumberId) throw new Error("Meta config missing access_token or phone_number_id");
          const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/\D/g, ""), type: "text", text: { body: messageBody } }),
          });
          if (!res.ok) throw new Error(`Meta API error: ${await res.text()}`);
          return { delivered: true, error: null, messageId: null };
        } else if (prov === "twilio" || prov === "Twilio") {
          const accountSid = cfg.account_sid;
          const authTk = cfg.auth_token;
          const fromNumber = cfg.from_number;
          if (!accountSid || !authTk || !fromNumber) throw new Error("Twilio config missing credentials");
          const params = new URLSearchParams();
          params.append("To", `whatsapp:${phone.replace(/\D/g, "")}`);
          params.append("From", `whatsapp:${fromNumber}`);
          params.append("Body", messageBody);
          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: "POST",
            headers: { Authorization: "Basic " + btoa(`${accountSid}:${authTk}`), "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
          });
          if (!res.ok) throw new Error(`Twilio API error: ${await res.text()}`);
          return { delivered: true, error: null, messageId: null };
        } else if (prov === "360dialog" || prov === "360Dialog") {
          const apiKey = cfg.api_key;
          if (!apiKey) throw new Error("360dialog config missing api_key");
          const res = await fetch("https://waba.360dialog.io/v1/messages", {
            method: "POST",
            headers: { "D360-API-KEY": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ to: phone.replace(/\D/g, ""), type: "text", text: { body: messageBody } }),
          });
          if (!res.ok) throw new Error(`360dialog API error: ${await res.text()}`);
          return { delivered: true, error: null, messageId: null };
        } else if (prov === "gupshup" || prov === "Gupshup") {
          const apiKey = cfg.api_key;
          const appName = cfg.app_name;
          const fromNumber = integ.phone_number || cfg.from_number;
          if (!apiKey) throw new Error("Gupshup config missing api_key");
          const params = new URLSearchParams();
          params.append("channel", "whatsapp");
          params.append("source", (fromNumber || "").replace(/\D/g, ""));
          params.append("destination", phone.replace(/\D/g, ""));
          params.append("message", JSON.stringify({ type: "text", text: messageBody }));
          if (appName) params.append("src.name", appName);
          const res = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
          });
          if (!res.ok) throw new Error(`Gupshup API error: ${await res.text()}`);
          return { delivered: true, error: null, messageId: null };
        } else if (prov === "evolution" || prov === "Evolution") {
          const apiKey = cfg.api_key as string;
          let apiUrl = (cfg.api_url as string || "").trim().replace(/\/+$/, "");
          if (!/^https?:\/\//i.test(apiUrl)) apiUrl = `https://${apiUrl}`;
          const instanceName = cfg.instance_name as string;
          if (!apiKey || !apiUrl || !instanceName) throw new Error("Evolution config missing api_key, api_url or instance_name");

          // ── Humanization engine: typing + delay + hard-block protection ──
          // Every message gets typing indicator + human-like delay.
          // Higher volume = longer delay (progressive throttling).
          // If volume exceeds 2× soft limit (hardMinute), wait until next minute.
          {
            const { pressure, countMinute, ageDays } = await getVolumePressure(integ.id, integ);
            const isNewNumber = ageDays <= 7;
            const thresholds = getWarmupThresholds(ageDays);

            // Hard-block: if volume exceeds hardMinute, wait 60s before sending
            if (countMinute >= thresholds.hardMinute) {
              console.warn(`[send-whatsapp] HARD BLOCK: ${countMinute}/${thresholds.hardMinute} msgs/min (age=${ageDays}d) — waiting 60s`);
              await delay(60_000);
            }

            // ALWAYS send typing indicator — every single message
            await sendTypingIndicator(apiUrl, instanceName, apiKey, evolutionDest);

            // Base delay always applied (simulates reading + typing)
            const baseMin = isNewNumber ? 800 : 500;
            const baseMax = isNewNumber ? 1500 : 1000;

            // Pressure adds more delay progressively (at 1.0: 3-5x base)
            const pressureMultiplier = 1 + pressure * (isNewNumber ? 3 : 4);
            const minDelay = baseMin * pressureMultiplier;
            const maxDelay = baseMax * pressureMultiplier;

            // Longer text = longer "typing" time (up to 500ms extra)
            const textLenFactor = messageBody ? Math.min(messageBody.length / 200, 1) * 500 : 0;

            const humanDelay = minDelay + Math.random() * (maxDelay - minDelay) + textLenFactor;
            console.log(`[send-whatsapp] Humanize: ${Math.round(humanDelay)}ms (pressure=${pressure.toFixed(2)}, ${countMinute}/min, age=${ageDays}d, hard=${thresholds.hardMinute})`);
            await delay(humanDelay);
          }

          if (media_url) {
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
              return { delivered: true, error: null, messageId: null };
            } else {
              const payload: Record<string, any> = { number: evolutionDest, mediatype: mediaType, media: media_url };
              if (messageBody) payload.caption = messageBody;
              if (mediaType === "document") payload.fileName = media_url.split("/").pop()?.split("?")[0] || "document";
              const res = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: apiKey },
                body: JSON.stringify(payload),
              });
              const resBody = await res.text();
              console.log("Evolution sendMedia response:", res.status, resBody);
              if (!res.ok) throw new Error(`Evolution API media error: ${resBody}`);
              return { delivered: true, error: null, messageId: null };
            }
          } else {
            const candidates = isGroupPhone ? [evolutionDest] : brMaybeAddNinthDigit(phone);
            let lastResBody = "";
            let successPhone: string | null = null;

            for (let i = 0; i < candidates.length; i++) {
              const candidateDest = isGroupPhone ? evolutionDest : candidates[i];
              const sendTextBody: Record<string, any> = { number: candidateDest, text: messageBody };
              if (quotedParam) sendTextBody.quoted = quotedParam;
              const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: apiKey },
                body: JSON.stringify(sendTextBody),
              });
              lastResBody = await res.text();
              console.log(`Evolution sendText [${candidateDest}] ${res.status}:`, lastResBody);

              if (res.ok) {
                successPhone = candidates[i];
                try {
                  const resData = JSON.parse(lastResBody);
                  msgId = resData?.key?.id || resData?.id || null;
                } catch { /* ignore */ }
                // Save corrected phone_e164 if 9th digit retry succeeded
                if (successPhone && successPhone !== phone && conv.contact?.id) {
                  await supabase.from("contacts").update({ phone_e164: successPhone }).eq("id", conv.contact.id);
                  console.log(`[send-whatsapp] Atualizado phone_e164=${successPhone} após retry 9.º dígito`);
                }
                return { delivered: true, error: null, messageId: msgId };
              }

              const isExistsFalse = lastResBody.includes('"exists":false') || lastResBody.includes('"exists": false');
              if (!isExistsFalse || i === candidates.length - 1) break;
              console.log(`[send-whatsapp] exists:false para ${candidates[i]}, tentando variante com 9.º dígito`);
              await delay(500); // Delay before retry to avoid rate limiting
            }
            throw new Error(`Evolution API error: ${lastResBody}`);
          }
        } else {
          throw new Error(`Unknown provider: ${prov}`);
        }
      } catch (e: any) {
        console.error(`[send-whatsapp] Falha com integração ${integ.id} (${integ.phone_number}):`, e.message);
        return { delivered: false, error: e.message, messageId: null };
      }
    }

    // ── Resolve integration + fallback chain ──
    // 1. Try linked integration (conversations.integration_id)
    // 2. If it fails, try all other connected integrations for the same company+channel
    // 3. On fallback success, update conversations.integration_id to the working one

    // Determine project_id for scoping fallbacks to the same project
    const projectId = (conv as any).integration?.project_id ?? conv.project_id ?? null;

    let integration: any = null;
    const linkedInteg = (conv as any).integration;
    if (linkedInteg) {
      integration = linkedInteg;
      console.log(`Using linked integration ${linkedInteg.id} for conversation ${conversation_id} (project=${projectId})`);
    } else {
      let fallbackQuery = supabase
        .from("integrations")
        .select("*")
        .eq("company_id", conv.company_id)
        .eq("channel", conv.channel)
        .eq("status", "connected")
        .order("created_at", { ascending: true })
        .limit(1);
      if (projectId) fallbackQuery = fallbackQuery.eq("project_id", projectId);
      const { data: integrations } = await fallbackQuery;
      integration = integrations?.[0] ?? null;
      if (integration) {
        console.log(`No linked integration, using first connected for project ${projectId}: ${integration.id}`);
      }
    }

    if (!integration) {
      return new Response(
        JSON.stringify({ ok: true, delivered: false, reason: "No active integration found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Attempt with primary integration
    let result = await attemptSend(integration);

    // Log AFTER successful send — prevents inflating rate counts on failed attempts
    if (result.delivered) await logRateLimitSend(integration.id);

    // If primary failed, try fallback integrations
    if (!result.delivered) {
      console.log(`[send-whatsapp] Primary integration ${integration.id} failed, trying fallbacks...`);

      let fbQuery = supabase
        .from("integrations")
        .select("*")
        .eq("company_id", conv.company_id)
        .eq("channel", conv.channel)
        .eq("status", "connected")
        .neq("id", integration.id)
        .order("created_at", { ascending: true });
      if (projectId) fbQuery = fbQuery.eq("project_id", projectId);
      const { data: fallbacks } = await fbQuery;

      if (fallbacks && fallbacks.length > 0) {
        for (const fb of fallbacks) {
          // Skip fallback numbers younger than 3 days — they shouldn't be
          // suddenly loaded with traffic from a failed primary number
          const fbAge = getNumberAgeDays(fb);
          if (fbAge <= 3) {
            console.log(`[send-whatsapp] Skipping fallback ${fb.id} (${fb.phone_number}) — too new (${fbAge}d)`);
            continue;
          }
          console.log(`[send-whatsapp] Trying fallback integration ${fb.id} (${fb.phone_number}, age=${fbAge}d)...`);
          result = await attemptSend(fb);
          if (result.delivered) await logRateLimitSend(fb.id);
          if (result.delivered) {
            // Update conversation to use this working integration
            await supabase
              .from("conversations")
              .update({ integration_id: fb.id })
              .eq("id", conversation_id);
            console.log(`[send-whatsapp] ✓ Fallback success! Updated conversation ${conversation_id} to integration ${fb.id} (${fb.phone_number})`);

            // Mark the failed integration as disconnected
            await supabase
              .from("integrations")
              .update({ status: "disconnected" })
              .eq("id", integration.id);
            console.log(`[send-whatsapp] Marked failed integration ${integration.id} as disconnected`);
            break;
          }
        }
      }
    }

    // Save external_message_id back to the DB message so edit/delete can reference it
    if (result.delivered && result.messageId && dbMessageId) {
      try {
        const { error: saveErr } = await supabase
          .from("messages")
          .update({ external_message_id: result.messageId, delivery_status: "sent" })
          .eq("id", dbMessageId);
        if (saveErr) console.warn("[send-whatsapp] Failed to save external_message_id:", saveErr.message);
      } catch (e: any) {
        console.warn("[send-whatsapp] Failed to save external_message_id:", e.message);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, delivered: result.delivered, error: result.error, message_id: result.messageId }),
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
