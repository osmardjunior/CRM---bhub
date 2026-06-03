/**
 * sync-all-history — One-off edge function to sync retroactive WhatsApp
 * conversations from Evolution API for ALL connected integrations.
 *
 * Call: npx supabase functions invoke sync-all-history --no-verify-jwt
 *
 * This function reuses the same sync logic from evolution-api/sync-history
 * but loops through every connected Evolution integration automatically.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Parse optional body params
    let bodyParams: any = {};
    try { bodyParams = await req.json(); } catch { /* empty body ok */ }
    const integrationIndex = bodyParams.index ?? 0; // Which integration to process (0-based)
    const chatLimit = bodyParams.chat_limit ?? 15;  // Max chats per call

    // Fetch all connected Evolution integrations
    const { data: integrations, error: intErr } = await supabase
      .from("integrations")
      .select("id, company_id, channel, phone_number, config")
      .eq("provider", "evolution")
      .eq("status", "connected");

    if (intErr) throw intErr;
    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma integração Evolution conectada", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[sync-all] Found ${integrations.length} integrations, processing index=${integrationIndex} (limit=${chatLimit} chats)`);

    // Only process the specified integration (or first one)
    const toProcess = integrations.slice(integrationIndex, integrationIndex + 1);
    if (toProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: `Index ${integrationIndex} fora do range (total: ${integrations.length})`, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: any[] = [];

    for (const integ of toProcess) {
      const cfg = integ.config as Record<string, any>;
      let apiUrl = (cfg?.api_url as string || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(apiUrl)) apiUrl = `https://${apiUrl}`;
      const apiKey = cfg?.api_key as string;
      const instanceName = cfg?.instance_name as string;

      if (!apiUrl || !apiKey || !instanceName) {
        console.warn(`[sync-all] Skipping integration ${integ.id} — missing config`);
        results.push({ integration_id: integ.id, phone: integ.phone_number, error: "missing config" });
        continue;
      }

      console.log(`\n[sync-all] ═══ Processing ${integ.phone_number} (instance=${instanceName}) ═══`);

      try {
        const syncResult = await syncIntegrationHistory(
          supabase, apiUrl, apiKey, instanceName, integ.id, integ.company_id, chatLimit,
        );
        results.push({ integration_id: integ.id, phone: integ.phone_number, ...syncResult });
        console.log(`[sync-all] ✓ ${integ.phone_number}: ${syncResult.synced_chats} chats, ${syncResult.synced_messages} msgs`);
      } catch (e: any) {
        console.error(`[sync-all] ✗ ${integ.phone_number} error:`, e.message);
        results.push({ integration_id: integ.id, phone: integ.phone_number, error: e.message });
      }
    }

    const totalChats = results.reduce((s, r) => s + (r.synced_chats || 0), 0);
    const totalMsgs = results.reduce((s, r) => s + (r.synced_messages || 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        total_integrations: integrations.length,
        processed_index: integrationIndex,
        next_index: integrationIndex + 1 < integrations.length ? integrationIndex + 1 : null,
        total_synced_chats: totalChats,
        total_synced_messages: totalMsgs,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[sync-all] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ── Sync logic (extracted from evolution-api sync-history) ──────────────────

async function syncIntegrationHistory(
  supabase: ReturnType<typeof createClient>,
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  integrationId: string,
  companyId: string,
  chatLimit = 15,
): Promise<{ synced_chats: number; synced_messages: number; total_chats_found: number }> {

  // 1. Fetch chats
  let chats: any[] = [];
  const chatEndpoints = [
    { method: "POST", url: `${baseUrl}/chat/findChats/${encodeURIComponent(instanceName)}`, body: JSON.stringify({}) },
    { method: "GET", url: `${baseUrl}/chat/findChats/${encodeURIComponent(instanceName)}`, body: null },
    { method: "POST", url: `${baseUrl}/chat/findContacts/${encodeURIComponent(instanceName)}`, body: JSON.stringify({}) },
    { method: "GET", url: `${baseUrl}/chat/findContacts/${encodeURIComponent(instanceName)}`, body: null },
  ];

  for (const ep of chatEndpoints) {
    if (chats.length > 0) break;
    try {
      const opts: RequestInit = {
        method: ep.method,
        headers: ep.body
          ? { "Content-Type": "application/json", apikey: apiKey }
          : { apikey: apiKey },
      };
      if (ep.body) opts.body = ep.body;
      const resp = await fetch(ep.url, opts);
      console.log(`  findChats ${ep.method} → ${resp.status}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) chats = data;
      }
    } catch (e: any) {
      console.warn(`  findChats error: ${e.message}`);
    }
  }

  if (!Array.isArray(chats) || chats.length === 0) {
    return { synced_chats: 0, synced_messages: 0, total_chats_found: 0 };
  }

  // Filter individual chats only (no groups, status, newsletters)
  const individualChats = chats.filter((c: any) => {
    const jid = c.id || c.remoteJid || c.jid || "";
    return jid.endsWith("@s.whatsapp.net") && !jid.startsWith("status@");
  });

  // Process limited number of chats to avoid timeout
  const toProcess = individualChats.slice(0, chatLimit);

  let syncedChats = 0;
  let syncedMessages = 0;

  for (const chat of toProcess) {
    try {
      const remoteJid = chat.id || chat.remoteJid || chat.jid || "";
      const rawPhone = remoteJid.replace(/@.*$/, "").replace(/:.*$/, "");
      const phone = rawPhone.replace(/\D/g, "");
      if (!phone || phone.length < 8) continue;

      const contactName = chat.name || chat.pushName || chat.contact || phone;

      // Find or create contact
      let contactId: string | null = null;
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .eq("phone", phone)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            phone,
            phone_e164: phone.length >= 10 ? `+${phone}` : null,
            name: contactName,
            source: "whatsapp",
          })
          .select("id")
          .single();
        contactId = newContact?.id || null;
      }
      if (!contactId) continue;

      // Find or create conversation
      let conversationId: string | null = null;
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("company_id", companyId)
        .eq("contact_id", contactId)
        .eq("integration_id", integrationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from("conversations")
          .insert({
            company_id: companyId,
            contact_id: contactId,
            integration_id: integrationId,
            channel: "whatsapp",
            status: "open",
          })
          .select("id")
          .single();
        if (convErr && convErr.code === "23505") {
          // Race condition: conversation was created between our lookup and insert
          const { data: retryConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("company_id", companyId)
            .eq("contact_id", contactId)
            .eq("integration_id", integrationId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          conversationId = retryConv?.id || null;
        } else {
          conversationId = newConv?.id || null;
        }
      }
      if (!conversationId) continue;

      // 2. Fetch messages
      let messages: any[] = [];
      const msgPayloads = [
        { where: { key: { remoteJid } }, limit: 100 },
        { where: { key: { remoteJid } } },
        { remoteJid, limit: 100 },
        { number: rawPhone, limit: 100 },
      ];

      for (const payload of msgPayloads) {
        if (messages.length > 0) break;
        try {
          const msgsResp = await fetch(
            `${baseUrl}/chat/findMessages/${encodeURIComponent(instanceName)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify(payload),
            },
          );
          if (msgsResp.ok) {
            const msgsData = await msgsResp.json();
            const extracted = Array.isArray(msgsData)
              ? msgsData
              : Array.isArray(msgsData?.messages)
                ? msgsData.messages
                : Array.isArray(msgsData?.messages?.records)
                  ? msgsData.messages.records
                  : [];
            if (extracted.length > 0) messages = extracted;
          }
        } catch { /* skip */ }
      }

      if (messages.length === 0) {
        syncedChats++;
        continue;
      }

      // 3. Parse and insert messages
      const messagesToInsert: any[] = [];
      for (const msg of messages) {
        try {
          const key = msg.key || {};
          const msgId = key.id || msg.messageId || msg.id;
          if (!msgId) continue;

          const message = msg.message || {};
          const msgBody =
            message.conversation ||
            message.extendedTextMessage?.text ||
            message.imageMessage?.caption ||
            message.videoMessage?.caption ||
            message.documentMessage?.caption ||
            msg.body || msg.content || msg.text || "";

          const hasAudio = !!message.audioMessage;
          const hasImage = !!message.imageMessage;
          const hasVideo = !!message.videoMessage;
          const hasDocument = !!message.documentMessage;
          const hasSticker = !!message.stickerMessage;
          const msgType = hasAudio ? "audio" : hasImage ? "image" : hasVideo ? "video" : hasDocument ? "document" : hasSticker ? "sticker" : "text";

          const isFromMe = !!(key.fromMe ?? msg.fromMe);
          const rawTs = msg.messageTimestamp || msg.timestamp || msg.createdAt;
          let ts: string;
          if (rawTs) {
            const num = typeof rawTs === "number" ? rawTs : parseInt(rawTs);
            ts = new Date(num < 1e12 ? num * 1000 : num).toISOString();
          } else {
            ts = new Date().toISOString();
          }

          messagesToInsert.push({
            company_id: companyId,
            conversation_id: conversationId,
            sender_type: isFromMe ? "agent" : "user",
            body: msgBody,
            type: msgType,
            direction: isFromMe ? "outbound" : "inbound",
            external_message_id: msgId,
            created_at: ts,
          });
        } catch { /* skip */ }
      }

      if (messagesToInsert.length > 0) {
        // Batch check existing message IDs to reduce queries
        const extIds = messagesToInsert.map((m) => m.external_message_id);
        const { data: existingMsgs } = await supabase
          .from("messages")
          .select("external_message_id")
          .in("external_message_id", extIds);
        const existingSet = new Set((existingMsgs ?? []).map((m: any) => m.external_message_id));

        const newMsgs = messagesToInsert.filter((m) => !existingSet.has(m.external_message_id));

        if (newMsgs.length > 0) {
          // Insert in batches of 50
          for (let i = 0; i < newMsgs.length; i += 50) {
            const batch = newMsgs.slice(i, i + 50);
            const { error: insErr } = await supabase.from("messages").insert(batch);
            if (!insErr) syncedMessages += batch.length;
            else console.warn(`  insert batch error: ${insErr.message}`);
          }

          // Update conversation last_message_at
          const lastTs = messagesToInsert[messagesToInsert.length - 1]?.created_at;
          if (lastTs) {
            await supabase
              .from("conversations")
              .update({ last_message_at: lastTs })
              .eq("id", conversationId);
          }
        }
      }

      syncedChats++;
      console.log(`  ✓ ${phone}: ${messagesToInsert.length} msgs found, new=${messagesToInsert.length - (messagesToInsert.length - syncedMessages)}`);
    } catch (chatErr: any) {
      console.warn(`  ✗ chat error: ${chatErr.message}`);
    }
  }

  return { synced_chats: syncedChats, synced_messages: syncedMessages, total_chats_found: chats.length };
}
