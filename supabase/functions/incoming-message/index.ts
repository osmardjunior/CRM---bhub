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
  profile_picture_url?: string;
  timestamp?: string;
  instance_name?: string;
  is_group?: boolean;
  group_subject?: string;
} {
  // Evolution API v2 sends: { event, instance, data, ... }
  if (body.event && body.instance) {
    const event = body.event;
    const instanceName = body.instance;

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const data = body.data || {};
      const key = data.key || {};
      const message = data.message || {};

      // Skip messages sent by us (fromMe = true)
      if (key.fromMe) {
        return { isEvolution: true, event: "skip_from_me" };
      }

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

      // Extract media URL if present
      const mediaUrl = data.media?.url || null;

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
        body: messageBody,
        media_url: mediaUrl,
        profile_picture_url: isGroup ? null : profilePictureUrl,
        timestamp: ts,
        instance_name: instanceName,
        is_group: isGroup,
        group_subject: groupSubject || undefined,
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
          .insert({
            company_id,
            name: from_name || from_phone,
            phone: from_phone,
            source: channel,
            tags: [],
            is_group: is_group,
            avatar_url: is_group ? null : (profile_picture_url || null),
          })
          .select("id, name, is_group")
          .single();

        if (contactErr) throw contactErr;
        contact = newContact;
      }
    }

    // ── Update contact metadata ────────────────────────
    const contactUpdates: Record<string, any> = {};

    // Update avatar only for individual contacts (not groups)
    if (profile_picture_url && !is_group) {
      contactUpdates.avatar_url = profile_picture_url;
    }

    // Set is_group flag if not already set
    if (is_group && !contact.is_group) {
      contactUpdates.is_group = true;
    }

    // For groups: update name only if we have a group subject and current name looks like a person's name
    // (i.e., the name was incorrectly set from pushName)
    if (is_group && from_name && from_name !== from_phone && from_name !== contact.name) {
      // Only update if from_name is a group subject (not pushName)
      // from_name for groups is set to groupSubject in parseEvolutionPayload
      contactUpdates.name = from_name;
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
      // If it's closed or pending, reopen it
      if (conversation.status !== "open") {
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

    // ── Insert message (with sender_name for groups) ───
    const { error: msgErr } = await supabase.from("messages").insert({
      company_id,
      conversation_id: conversation.id,
      sender_type: "user",
      sender_id: null,
      sender_name: sender_name || null,
      body: messageBody,
      media_url: media_url || null,
      external_message_id,
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
