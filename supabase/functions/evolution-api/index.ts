import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, api_url, api_key, instance_name, integration_id } = body;

    if (!api_url || !api_key) {
      return new Response(
        JSON.stringify({ error: "api_url and api_key are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize URL - ensure protocol, remove trailing slash and known path prefixes
    let baseUrl = api_url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(baseUrl)) {
      baseUrl = `https://${baseUrl}`;
    }
    // Remove common path prefixes that users might include (e.g. /manager)
    baseUrl = baseUrl.replace(/\/(manager|api)\/?$/i, "");

    // ── Action: create-instance ──────────────────────
    if (action === "create-instance") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create instance — groups_ignore stops group messages at source
      const createResp = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: api_key,
        },
        body: JSON.stringify({
          instanceName: instance_name,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          groups_ignore: true,
          always_online: false,
          reject_call: false,
        }),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error("Evolution create instance error:", errText);
        
        // If instance already exists, try to get QR code instead
        if (createResp.status === 403 || createResp.status === 409 || errText.includes("already")) {
          console.log("Instance may already exist, trying to connect...");
          const connectResp = await fetch(
            `${baseUrl}/instance/connect/${instance_name}`,
            {
              method: "GET",
              headers: { apikey: api_key },
            }
          );
          if (connectResp.ok) {
            const connectData = await connectResp.json();
            return new Response(
              JSON.stringify({
                success: true,
                qrcode: connectData.base64 || connectData.qrcode?.base64 || null,
                pairingCode: connectData.pairingCode || null,
                instance: { instanceName: instance_name, status: "created" },
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          return new Response(
            JSON.stringify({ error: `Instance error: ${errText}` }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            error: `Failed to create instance [${createResp.status}]: ${errText}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const createData = await createResp.json();
      console.log("Instance created:", JSON.stringify(createData));

      // Extract QR code from response
      const qrcode =
        createData.qrcode?.base64 ||
        createData.base64 ||
        createData.qr?.base64 ||
        null;

      return new Response(
        JSON.stringify({
          success: true,
          qrcode,
          pairingCode: createData.qrcode?.pairingCode || createData.pairingCode || null,
          instance: createData.instance || {
            instanceName: instance_name,
            status: "created",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: get-qrcode ──────────────────────────
    if (action === "get-qrcode") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const qrResp = await fetch(
        `${baseUrl}/instance/connect/${instance_name}`,
        {
          method: "GET",
          headers: { apikey: api_key },
        }
      );

      if (!qrResp.ok) {
        const errText = await qrResp.text();
        return new Response(
          JSON.stringify({
            error: `Failed to get QR [${qrResp.status}]: ${errText}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const qrData = await qrResp.json();
      return new Response(
        JSON.stringify({
          success: true,
          qrcode: qrData.base64 || qrData.qrcode?.base64 || null,
          pairingCode: qrData.pairingCode || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: check-status ────────────────────────
    if (action === "check-status") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const statusResp = await fetch(
        `${baseUrl}/instance/connectionState/${instance_name}`,
        {
          method: "GET",
          headers: { apikey: api_key },
        }
      );

      if (!statusResp.ok) {
        const errText = await statusResp.text();
        return new Response(
          JSON.stringify({
            error: `Failed to check status [${statusResp.status}]: ${errText}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const statusData = await statusResp.json();
      const state = statusData.instance?.state || statusData.state || "unknown";
      const isConnected = state === "open" || state === "connected";

      // If connected and we have an integration_id, update status + fetch phone number
      if (isConnected && integration_id) {
        let phoneNumber: string | null = null;

        // Try to fetch the phone number from fetchInstances
        try {
          const fetchResp = await fetch(
            `${baseUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instance_name)}`,
            { method: "GET", headers: { apikey: api_key } }
          );
          if (fetchResp.ok) {
            const fetchData = await fetchResp.json();
            // fetchInstances returns an array; each item may have instance.owner or ownerJid
            const item = Array.isArray(fetchData) ? fetchData[0] : fetchData;
            const owner: string = item?.instance?.owner || item?.ownerJid || item?.owner || "";
            if (owner) {
              // Strip @s.whatsapp.net and normalize to +E.164 style
              const digits = owner.replace(/@.*$/, "").replace(/[^0-9]/g, "");
              if (digits.length >= 10) phoneNumber = `+${digits}`;
            }
          }
        } catch {
          // Best-effort, ignore
        }

        const updatePayload: Record<string, unknown> = { status: "connected" };
        if (phoneNumber) updatePayload.phone_number = phoneNumber;

        await supabase
          .from("integrations")
          .update(updatePayload)
          .eq("id", integration_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          state,
          connected: isConnected,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: set-webhook ─────────────────────────
    if (action === "set-webhook") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const webhookSecret = Deno.env.get("WEBHOOK_SECRET") || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/incoming-message`;

      const webhookPayload = {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          headers: {
            "x-webhook-secret": webhookSecret,
          },
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "PRESENCE_UPDATE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
          ],
        },
      };

      console.log("Setting webhook:", JSON.stringify(webhookPayload));

      const whResp = await fetch(
        `${baseUrl}/webhook/set/${instance_name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: api_key,
          },
          body: JSON.stringify(webhookPayload),
        }
      );

      const whData = await whResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          success: whResp.ok,
          webhook: whData,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: update-groups-setting ────────────────
    if (action === "update-groups-setting") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update instance settings to ignore groups
      const settingsResp = await fetch(
        `${baseUrl}/settings/set/${encodeURIComponent(instance_name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: api_key },
          body: JSON.stringify({
            groups_ignore: true,
            always_online: false,
            reject_call: false,
          }),
        }
      );

      const settingsData = await settingsResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ success: settingsResp.ok, settings: settingsData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Action: fetch-phone ─────────────────────────
    if (action === "fetch-phone") {
      if (!instance_name || !integration_id) {
        return new Response(
          JSON.stringify({ error: "instance_name and integration_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let phoneNumber: string | null = null;

      // Try 1: fetchInstances endpoint
      try {
        const r = await fetch(
          `${baseUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instance_name)}`,
          { method: "GET", headers: { apikey: api_key } }
        );
        if (r.ok) {
          const data = await r.json();
          const item = Array.isArray(data) ? data[0] : data;
          const owner: string =
            item?.instance?.owner ||
            item?.instance?.ownerJid ||
            item?.ownerJid ||
            item?.owner ||
            "";
          if (owner) {
            const digits = owner.replace(/@.*$/, "").replace(/[^0-9]/g, "");
            if (digits.length >= 10) phoneNumber = `+${digits}`;
          }
        }
      } catch { /* ignore */ }

      // Try 2: connectionState endpoint (some Evolution versions include phone here)
      if (!phoneNumber) {
        try {
          const r = await fetch(
            `${baseUrl}/instance/connectionState/${encodeURIComponent(instance_name)}`,
            { method: "GET", headers: { apikey: api_key } }
          );
          if (r.ok) {
            const data = await r.json();
            const owner: string =
              data?.instance?.owner ||
              data?.instance?.ownerJid ||
              data?.ownerJid ||
              data?.owner ||
              "";
            if (owner) {
              const digits = owner.replace(/@.*$/, "").replace(/[^0-9]/g, "");
              if (digits.length >= 10) phoneNumber = `+${digits}`;
            }
          }
        } catch { /* ignore */ }
      }

      if (phoneNumber) {
        await supabase
          .from("integrations")
          .update({ phone_number: phoneNumber })
          .eq("id", integration_id);
      }

      return new Response(
        JSON.stringify({ success: true, phone_number: phoneNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Action: sync-history ─────────────────────────
    if (action === "sync-history") {
      if (!instance_name || !integration_id) {
        return new Response(
          JSON.stringify({ error: "instance_name and integration_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get integration details (company_id, channel)
      const { data: integration } = await supabase
        .from("integrations")
        .select("company_id, channel, phone_number")
        .eq("id", integration_id)
        .single();

      if (!integration) {
        return new Response(
          JSON.stringify({ error: "Integration not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const companyId = integration.company_id;

      // 1. Fetch chats from Evolution API (try multiple endpoint variants)
      let chats: any[] = [];
      const chatEndpoints = [
        { method: "POST", url: `${baseUrl}/chat/findChats/${encodeURIComponent(instance_name)}`, body: JSON.stringify({}) },
        { method: "GET", url: `${baseUrl}/chat/findChats/${encodeURIComponent(instance_name)}`, body: null },
        { method: "POST", url: `${baseUrl}/chat/findContacts/${encodeURIComponent(instance_name)}`, body: JSON.stringify({}) },
        { method: "GET", url: `${baseUrl}/chat/findContacts/${encodeURIComponent(instance_name)}`, body: null },
      ];

      for (const ep of chatEndpoints) {
        if (chats.length > 0) break;
        try {
          const opts: RequestInit = {
            method: ep.method,
            headers: ep.body
              ? { "Content-Type": "application/json", apikey: api_key }
              : { apikey: api_key },
          };
          if (ep.body) opts.body = ep.body;
          const resp = await fetch(ep.url, opts);
          console.log(`sync-history: ${ep.method} ${ep.url} → ${resp.status}`);
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
              chats = data;
            }
          }
        } catch (e) {
          console.error(`sync-history: failed ${ep.url}:`, e);
        }
      }

      if (!Array.isArray(chats) || chats.length === 0) {
        return new Response(
          JSON.stringify({ success: true, synced_chats: 0, synced_messages: 0, message: "Nenhuma conversa encontrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filter only individual chats (not groups, status, newsletters)
      const individualChats = chats.filter((c: any) => {
        const jid = c.id || c.remoteJid || c.jid || "";
        return jid.endsWith("@s.whatsapp.net") && !jid.startsWith("status@");
      }).slice(0, 30); // Limit to 30 chats to avoid timeout

      let syncedChats = 0;
      let syncedMessages = 0;

      for (const chat of individualChats) {
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
          .eq("integration_id", integration_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({
              company_id: companyId,
              contact_id: contactId,
              integration_id,
              channel: "whatsapp",
              status: "open",
            })
            .select("id")
            .single();
          conversationId = newConv?.id || null;
        }

        if (!conversationId) continue;

        // 2. Fetch messages for this chat (try multiple payload formats)
        let messages: any[] = [];
        const msgPayloads = [
          { where: { key: { remoteJid } }, limit: 50 },
          { where: { key: { remoteJid } } },
          { remoteJid, limit: 50 },
          { number: rawPhone, limit: 50 },
        ];

        for (const payload of msgPayloads) {
          if (messages.length > 0) break;
          try {
            const msgsResp = await fetch(`${baseUrl}/chat/findMessages/${encodeURIComponent(instance_name)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: api_key },
              body: JSON.stringify(payload),
            });
            console.log(`sync-history: findMessages ${remoteJid} payload=${JSON.stringify(payload)} → ${msgsResp.status}`);
            if (msgsResp.ok) {
              const msgsData = await msgsResp.json();
              // Response can be: array directly, { messages: [...] }, { messages: { records: [...] } }
              const extracted = Array.isArray(msgsData)
                ? msgsData
                : Array.isArray(msgsData?.messages)
                  ? msgsData.messages
                  : Array.isArray(msgsData?.messages?.records)
                    ? msgsData.messages.records
                    : [];
              if (extracted.length > 0) {
                messages = extracted;
                console.log(`sync-history: got ${messages.length} messages for ${remoteJid}`);
              }
            }
          } catch (e) {
            console.error(`sync-history: findMessages error for ${remoteJid}:`, e);
          }
        }

        if (messages.length === 0) {
          syncedChats++;
          continue;
        }

        // 3. Insert messages (with dedup)
        const messagesToInsert: any[] = [];
        for (const msg of messages) {
          try {
          const key = msg.key || {};
          const msgId = key.id || msg.messageId || msg.id || msg.key?.id;
          if (!msgId) continue;

          const message = msg.message || {};
          const msgBody =
            message.conversation ||
            message.extendedTextMessage?.text ||
            message.imageMessage?.caption ||
            message.videoMessage?.caption ||
            message.documentMessage?.caption ||
            msg.body ||
            msg.content ||
            msg.text ||
            "";

          // Detect media type
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
            // If timestamp is in seconds (< year 2100 in ms), convert; otherwise treat as ms
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
          } catch { /* skip unparseable message */ }
        }

        if (messagesToInsert.length > 0) {
          // Insert one by one, skipping existing (no UNIQUE constraint on external_message_id)
          for (const m of messagesToInsert) {
            try {
              const { data: existing } = await supabase
                .from("messages")
                .select("id")
                .eq("external_message_id", m.external_message_id)
                .maybeSingle();
              if (!existing) {
                const { error: insErr } = await supabase.from("messages").insert(m);
                if (!insErr) syncedMessages++;
              }
            } catch {
              // skip individual message errors
            }
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

        syncedChats++;
       } catch (chatErr) {
        console.error(`sync-history: error processing chat:`, chatErr);
       }
      }

      return new Response(
        JSON.stringify({
          success: true,
          synced_chats: syncedChats,
          synced_messages: syncedMessages,
          total_chats_found: chats.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid action. Use: create-instance, get-qrcode, check-status, set-webhook, fetch-phone, sync-history",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Evolution API error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
