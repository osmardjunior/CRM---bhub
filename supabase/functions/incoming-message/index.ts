import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

/** Detect if a phone/JID is a group */
function isGroupJid(phone: string): boolean {
  if (phone.includes("@g.us")) return true;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("120363")) return true;
  if (digits.length >= 18) return true;
  return false;
}

/**
 * Parse Evolution API v2 webhook payload into our internal format.
 * Evolution sends different event types; we only care about MESSAGES_UPSERT.
 */
function parseEvolutionPayload(body: any): {
  isEvolution: boolean;
  event?: string;
  company_id?: string;
  channel?: string;
  external_message_id?: string;
  from_phone?: string;
  from_name?: string;
  sender_name?: string;
  participant_phone?: string;
  body?: string;
  media_url?: string;
  media_type?: string;
  profile_picture_url?: string;
  timestamp?: string;
  instance_name?: string;
  is_group?: boolean;
  group_subject?: string;
  from_me?: boolean;
} {
  // Evolution API v2 sends: { event, instance, data, ... }
  if (body.event && body.instance) {
    const event = body.event;
    const instanceName = body.instance;

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const data = body.data || {};
      const key = data.key || {};
      const message = data.message || {};

      // Track if message was sent by us (fromMe = true)
      const isFromMe = !!key.fromMe;

      // Extract phone from remoteJid (format: 5531XXXX@s.whatsapp.net or ...@g.us)
      const remoteJid = key.remoteJid || "";
      const fromPhone = remoteJid.replace(/@.*$/, "");

      // Detect group
      const isGroup = isGroupJid(remoteJid);

      // For groups, participant is the actual sender's JID
      const participant = key.participant || data.participant || "";
      const participantPhone = participant ? participant.replace(/@.*$/, "") : "";

      // Extract message body
      const messageBody =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        data.body ||
        "";

      // Extract media URL — Evolution may place it in different locations
      const mediaUrl =
        data.media?.url ||
        data.message?.mediaUrl ||
        data.message?.imageMessage?.url ||
        data.message?.audioMessage?.url ||
        data.message?.videoMessage?.url ||
        data.message?.documentMessage?.url ||
        data.message?.stickerMessage?.url ||
        null;

      // Detect message type for proper rendering
      const hasAudio = !!(message.audioMessage || data.message?.audioMessage);
      const hasImage = !!(message.imageMessage || data.message?.imageMessage);
      const hasVideo = !!(message.videoMessage || data.message?.videoMessage);
      const hasDocument = !!(message.documentMessage || data.message?.documentMessage);
      const hasSticker = !!(message.stickerMessage || data.message?.stickerMessage);
      const detectedType = hasAudio ? "audio" : hasImage ? "image" : hasVideo ? "video" : hasDocument ? "document" : hasSticker ? "sticker" : "text";

      // Log media details for debugging
      if (hasAudio || hasImage || hasVideo || hasDocument || hasSticker) {
        console.log(`Media message detected — type: ${detectedType}, mediaUrl: ${mediaUrl}, keys: ${JSON.stringify(Object.keys(data.media || {}))}, messageKeys: ${JSON.stringify(Object.keys(message))}`);
      }

      // Extract contact name and profile picture
      const pushName = data.pushName || key.pushName || fromPhone;
      const profilePictureUrl = data.profilePictureUrl || null;

      // Group subject (group name) — Evolution may send this
      const groupSubject = data.groupSubject || data.subject || message.groupSubject || null;

      // Message ID
      const messageId = key.id || data.messageId || `evo_${Date.now()}`;

      // Timestamp
      const ts = data.messageTimestamp
        ? new Date(data.messageTimestamp * 1000).toISOString()
        : new Date().toISOString();

      return {
        isEvolution: true,
        event: "messages_upsert",
        channel: "whatsapp",
        external_message_id: messageId,
        from_phone: fromPhone,
        from_name: isGroup ? (groupSubject || undefined) : pushName,
        sender_name: isGroup ? pushName : undefined,
        participant_phone: isGroup ? participantPhone : undefined,
        body: messageBody || (mediaUrl ? "" : ""),
        media_url: mediaUrl,
        media_type: detectedType,
        profile_picture_url: isGroup ? null : profilePictureUrl,
        timestamp: ts,
        instance_name: instanceName,
        is_group: isGroup,
        group_subject: groupSubject || undefined,
        from_me: isFromMe,
      };
    }

    // Other events we don't process as messages
    return { isEvolution: true, event };
  }

  return { isEvolution: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.json();

    // Detect if this is an Evolution API webhook (has event + instance fields)
    const isEvolutionWebhook = !!(rawBody.event && rawBody.instance);

    // ── Auth: X-WEBHOOK-SECRET (skip for Evolution webhooks, validated by instance lookup) ──
    if (!isEvolutionWebhook) {
      const secret = req.headers.get("x-webhook-secret");
      const expected = Deno.env.get("WEBHOOK_SECRET");
      if (!expected || secret !== expected) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Try to parse as Evolution API payload ──────────
    const evolution = parseEvolutionPayload(rawBody);

    let company_id: string;
    let channel: string;
    let external_message_id: string;
    let from_phone: string;
    let from_name: string;
    let messageBody: string;
    let media_url: string | null;
    let profile_picture_url: string | null = null;
    let timestamp: string | undefined;
    let sender_name: string | undefined;
    let is_group = false;
    let media_type = "text";
    let from_me = false;

    if (evolution.isEvolution) {
      // Skip non-message events
      if (evolution.event !== "messages_upsert") {
        return new Response(
          JSON.stringify({ ok: true, skipped: true, event: evolution.event }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // For Evolution, we need to look up the company_id from the integration
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Find integration by instance name to get company_id
      const { data: integrations } = await supabaseAdmin
        .from("integrations")
        .select("company_id, config")
        .eq("channel", "whatsapp")
        .eq("provider", "evolution");

      let foundCompanyId: string | null = null;
      if (integrations) {
        for (const integ of integrations) {
          const config = integ.config as any;
          if (config?.instance_name === evolution.instance_name) {
            foundCompanyId = integ.company_id;
            break;
          }
        }
      }

      if (!foundCompanyId) {
        console.error(`No integration found for instance: ${evolution.instance_name}`);
        return new Response(
          JSON.stringify({ error: "No integration found for this instance" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      company_id = foundCompanyId;
      channel = evolution.channel!;
      external_message_id = evolution.external_message_id!;
      from_phone = evolution.from_phone!;
      from_name = evolution.from_name || from_phone;
      messageBody = evolution.body || "";
      media_url = evolution.media_url || null;
      profile_picture_url = evolution.profile_picture_url || null;
      timestamp = evolution.timestamp;
      sender_name = evolution.sender_name;
      is_group = evolution.is_group || false;
      media_type = evolution.media_type || "text";
      from_me = evolution.from_me || false;

      // ── Filter invalid JIDs (status broadcasts, newsletters, communities, invalid phones) ──
      const phoneDigits = from_phone.replace(/\D/g, "");
      const looksLikeGroupJid = /^\d+-\d+$/.test(from_phone); // e.g. 553183022054-1632608644
      const looksLikeCommunity = phoneDigits.startsWith("120363");
      if (
        phoneDigits.length > 15 ||
        phoneDigits.length < 8 ||
        from_phone.includes("status") ||
        from_phone.includes("newsletter") ||
        from_phone === "0" ||
        looksLikeCommunity ||
        (looksLikeGroupJid && !is_group)
      ) {
        console.log(`Skipping invalid JID: ${from_phone}`);
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "invalid_jid" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // For media messages without body, set a descriptive placeholder
      if (!messageBody && media_url) {
        const typeLabels: Record<string, string> = {
          audio: "🎤 Áudio",
          image: "📷 Imagem",
          video: "🎬 Vídeo",
          document: "📄 Documento",
          sticker: "🏷️ Figurinha",
        };
        messageBody = typeLabels[media_type] || "📎 Mídia";
      }

      if (!messageBody && !media_url) {
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "empty_message" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // ── Standard payload format ──────────────────────
      company_id = rawBody.company_id;
      channel = rawBody.channel;
      external_message_id = rawBody.external_message_id;
      from_phone = rawBody.from_phone;
      from_name = rawBody.from_name;
      messageBody = rawBody.body;
      media_url = rawBody.media_url || null;
      timestamp = rawBody.timestamp;
      sender_name = rawBody.sender_name;
      is_group = rawBody.is_group || false;
    }

    // ── Validation ─────────────────────────────────────
    if (!company_id || typeof company_id !== "string") {
      return new Response(
        JSON.stringify({ error: "company_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const validChannels = ["whatsapp", "instagram", "webchat"];
    if (!channel || !validChannels.includes(channel)) {
      return new Response(
        JSON.stringify({ error: `channel must be one of: ${validChannels.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!external_message_id || typeof external_message_id !== "string") {
      return new Response(
        JSON.stringify({ error: "external_message_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!from_phone || typeof from_phone !== "string") {
      return new Response(
        JSON.stringify({ error: "from_phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if ((!messageBody || typeof messageBody !== "string") && !media_url) {
      return new Response(
        JSON.stringify({ error: "body or media_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Ensure messageBody is at least empty string
    if (!messageBody) messageBody = "";

    // ── Supabase client (service role) ─────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Validate company exists ────────────────────────
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .maybeSingle();

    if (companyErr) throw companyErr;
    if (!company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Idempotency check ──────────────────────────────
    const { data: existing } = await supabase
      .from("messages")
      .select("id, conversation_id")
      .eq("external_message_id", external_message_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, conversation_id: existing.conversation_id, deduplicated: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Find or create contact ─────────────────────────
    const normalizedPhone = from_phone.replace(/\D/g, "");

    let { data: contact } = await supabase
      .from("contacts")
      .select("id, name, is_group")
      .eq("company_id", company_id)
      .eq("phone", from_phone)
      .maybeSingle();

    if (!contact) {
      // Try normalized match
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, phone, is_group")
        .eq("company_id", company_id);

      const match = (contacts ?? []).find(
        (c: any) => c.phone && c.phone.replace(/\D/g, "") === normalizedPhone,
      );

      if (match) {
        contact = match;
      } else {
        const { data: newContact, error: contactErr } = await supabase
          .from("contacts")
          .upsert(
            {
              company_id,
              name: from_name || from_phone,
              phone: from_phone,
              source: channel,
              tags: [],
              is_group: is_group,
              avatar_url: is_group ? null : (profile_picture_url || null),
            },
            { onConflict: "company_id,phone" }
          )
          .select("id, name, is_group")
          .single();

        if (contactErr) throw contactErr;
        contact = newContact;
      }
    }

    // ── Update contact metadata ────────────────────────
    const contactUpdates: Record<string, any> = {};

    // Set is_group flag if not already set
    if (is_group && !contact.is_group) {
      contactUpdates.is_group = true;
    }

    // Update avatar only for individual contacts (not groups)
    if (profile_picture_url && !is_group) {
      contactUpdates.avatar_url = profile_picture_url;
    }

    // For groups: update name only if we have a group subject
    if (is_group && from_name && from_name !== from_phone && from_name !== contact.name) {
      contactUpdates.name = from_name;
    }

    // ── Fetch missing data from Evolution API ──────────
    if (evolution.isEvolution && evolution.instance_name) {
      // Look up Evolution API credentials
      const { data: evoInteg } = await supabase
        .from("integrations")
        .select("config")
        .eq("company_id", company_id)
        .eq("provider", "evolution")
        .limit(1)
        .maybeSingle();

      if (evoInteg) {
        const evoConfig = evoInteg.config as any;
        let evoBaseUrl = (evoConfig?.api_url || "").trim().replace(/\/+$/, "");
        if (evoBaseUrl && !/^https?:\/\//i.test(evoBaseUrl)) {
          evoBaseUrl = `https://${evoBaseUrl}`;
        }
        evoBaseUrl = evoBaseUrl.replace(/\/(manager|api)\/?$/i, "");
        const evoApiKey = evoConfig?.api_key || "";
        const instName = evolution.instance_name;

        // Fetch profile picture if contact has none
        if (!contact.avatar_url && !profile_picture_url && evoBaseUrl && evoApiKey) {
          try {
            const remoteJid = is_group
              ? `${from_phone}@g.us`
              : `${from_phone}@s.whatsapp.net`;
            const picResp = await fetch(
              `${evoBaseUrl}/chat/fetchProfilePictureUrl/${instName}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoApiKey },
                body: JSON.stringify({ number: remoteJid }),
              },
            );
            if (picResp.ok) {
              const picData = await picResp.json();
              const picUrl = picData?.profilePictureUrl || picData?.picture || picData?.url || null;
              if (picUrl) {
                contactUpdates.avatar_url = picUrl;
              }
            }
          } catch (e) {
            console.warn("Failed to fetch profile picture:", e);
          }
        }

        // Fetch group name if it looks like a JID/number
        const nameIsJid = contact.name && /^\d{10,}$/.test(contact.name.replace(/\D/g, ""));
        if (is_group && nameIsJid && evoBaseUrl && evoApiKey) {
          try {
            const groupJid = `${from_phone}@g.us`;
            const grpResp = await fetch(
              `${evoBaseUrl}/group/findGroupInfos/${instName}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoApiKey },
                body: JSON.stringify({ groupJid }),
              },
            );
            if (grpResp.ok) {
              const grpData = await grpResp.json();
              const subject = grpData?.subject || grpData?.name || null;
              if (subject) {
                contactUpdates.name = subject;
              }
            }
          } catch (e) {
            console.warn("Failed to fetch group info:", e);
          }
        }
      }
    }

    if (Object.keys(contactUpdates).length > 0) {
      await supabase
        .from("contacts")
        .update(contactUpdates)
        .eq("id", contact.id);
    }

    // ── Find the most recent conversation for this contact (any status) ───
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id, status")
      .eq("company_id", company_id)
      .eq("contact_id", contact.id)
      .eq("channel", channel)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversation) {
      // If it's closed or pending, reopen it — but only for incoming messages (not fromMe)
      if (conversation.status !== "open" && !from_me) {
        await supabase
          .from("conversations")
          .update({
            status: "open",
            close_reason: null,
            last_message_at: timestamp || new Date().toISOString(),
          })
          .eq("id", conversation.id);
      }
    } else {
      // No conversation exists, create a new one
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          company_id,
          contact_id: contact.id,
          channel,
          status: "open",
          last_message_at: timestamp || new Date().toISOString(),
        })
        .select("id")
        .single();

      if (convErr) throw convErr;
      conversation = newConv;
    }

    // ── Download media from Evolution and store in our bucket ───
    if (evolution.isEvolution && media_url && media_type !== "text") {
      try {
        const { data: evoInteg2 } = await supabase
          .from("integrations")
          .select("config")
          .eq("company_id", company_id)
          .eq("provider", "evolution")
          .limit(1)
          .maybeSingle();

        if (evoInteg2) {
          const ec = evoInteg2.config as any;
          let evoUrl = (ec?.api_url || "").trim().replace(/\/+$/, "");
          if (evoUrl && !/^https?:\/\//i.test(evoUrl)) evoUrl = `https://${evoUrl}`;
          evoUrl = evoUrl.replace(/\/(manager|api)\/?$/i, "");
          const evoKey = ec?.api_key || "";

          if (evoUrl && evoKey) {
            // Use getBase64FromMediaMessage to get decoded media
            const mediaResp = await fetch(
              `${evoUrl}/chat/getBase64FromMediaMessage/${evolution.instance_name}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoKey },
                body: JSON.stringify({ message: { key: { id: external_message_id } }, convertToMp4: false }),
              },
            );

            if (mediaResp.ok) {
              const mediaData = await mediaResp.json();
              const base64 = mediaData.base64 || mediaData.data;
              const mimetype = mediaData.mimetype || mediaData.mediaType || "application/octet-stream";

              if (base64) {
                // Determine file extension
                const extMap: Record<string, string> = {
                  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
                  "audio/aac": "aac", "audio/opus": "opus",
                  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                  "video/mp4": "mp4", "video/3gpp": "3gp",
                  "application/pdf": "pdf",
                };
                const ext = extMap[mimetype] || mimetype.split("/")[1] || "bin";
                const fileName = `${company_id}/${conversation.id}/${external_message_id}.${ext}`;

                // Decode base64 and upload
                const binaryStr = atob(base64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }

                const { data: uploadData, error: uploadErr } = await supabase.storage
                  .from("chat-media")
                  .upload(fileName, bytes.buffer, {
                    contentType: mimetype,
                    upsert: true,
                  });

                if (!uploadErr && uploadData) {
                  const { data: publicUrl } = supabase.storage
                    .from("chat-media")
                    .getPublicUrl(fileName);
                  media_url = publicUrl.publicUrl;
                  console.log(`Media stored: ${media_url}`);
                } else {
                  console.warn("Upload failed:", uploadErr?.message);
                }
              }
            } else {
              console.warn(`getBase64FromMediaMessage failed: ${mediaResp.status}`);
            }
          }
        }
      } catch (mediaErr: any) {
        console.warn("Media download/upload failed:", mediaErr.message);
        // Continue with original URL as fallback
      }
    }

    // ── Deduplication for fromMe messages ────────────
    // Messages sent from the phone (fromMe) may already exist in the DB
    // if they were sent via the CRM (without external_message_id).
    if (from_me) {
      const recentCutoff = new Date(Date.now() - 60000).toISOString();
      const { data: recentMatch } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .eq("body", messageBody)
        .eq("sender_type", "agent")
        .gte("created_at", recentCutoff)
        .limit(1)
        .maybeSingle();

      if (recentMatch) {
        // Update the existing message with the external_message_id and skip insertion
        await supabase
          .from("messages")
          .update({ external_message_id })
          .eq("id", recentMatch.id);
        
        console.log(`Deduplicated fromMe message: ${external_message_id}`);
        return new Response(
          JSON.stringify({ ok: true, conversation_id: conversation.id, deduplicated: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Insert message (with sender_name for groups) ───
    const { error: msgErr } = await supabase.from("messages").insert({
      company_id,
      conversation_id: conversation.id,
      sender_type: from_me ? "agent" : "user",
      sender_id: null,
      sender_name: sender_name || null,
      body: messageBody,
      media_url: media_url || null,
      type: media_type !== "text" ? media_type : "text",
      external_message_id,
      direction: from_me ? "outbound" : "inbound",
      created_at: timestamp || new Date().toISOString(),
    });

    if (msgErr) throw msgErr;

    // ── Update last_message_at ─────────────────────────
    await supabase
      .from("conversations")
      .update({ last_message_at: timestamp || new Date().toISOString() })
      .eq("id", conversation.id);

    // ── Check for pending NPS survey response ──────────
    const trimmedBody = messageBody.trim();
    const npsScore = parseInt(trimmedBody, 10);
    if (npsScore >= 1 && npsScore <= 5 && trimmedBody.length <= 2) {
      const { data: pendingSurvey } = await supabase
        .from("satisfaction_surveys")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("company_id", company_id)
        .is("score", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingSurvey) {
        await supabase
          .from("satisfaction_surveys")
          .update({ score: npsScore, answered_at: new Date().toISOString() })
          .eq("id", pendingSurvey.id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, conversation_id: conversation.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
