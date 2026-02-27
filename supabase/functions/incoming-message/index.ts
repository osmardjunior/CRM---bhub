import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  normalizeWhatsAppNumberSafe,
  isGroupJid,
  parseWhatsAppIdentifier,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

/**
 * Normalize WhatsApp phone for storage — returns digits-only string (no "+").
 * Uses the shared util but strips the "+" for backwards-compat with existing DB rows.
 */
function normalizeWhatsAppPhone(phone: string): string {
  const result = normalizeWhatsAppNumberSafe(phone);
  if (result) return result.replace(/^\+/, ""); // strip leading "+"
  // Fallback: return raw digits if normalization fails (e.g. group JID)
  return phone.replace(/@.*$/, "").replace(/:.*$/, "").replace(/\D/g, "");
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
  from_jid_kind?: string;
  remote_jid_raw?: string;
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
      // Strip domain AND multi-device suffix (:108) before extracting digits.
      // e.g. "92999597994:108@s.whatsapp.net" → "92999597994" (not "92999597994108")
      const remoteJid = key.remoteJid || "";
      const rawPhone = remoteJid.replace(/@.*$/, "").replace(/:.*$/, "");
      const parsedJid = parseWhatsAppIdentifier(remoteJid);
      const isLidJid = parsedJid.kind === "lid";
      // LID contacts (@lid) must not be normalized as phone — they're device IDs
      const fromPhone = isGroupJid(remoteJid)
        ? rawPhone
        : isLidJid
          ? rawPhone
          : normalizeWhatsAppPhone(rawPhone);

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
        // When isFromMe=true, pushName is the agent's own name — do NOT use it
        // to name the contact (lead), otherwise leads get the agent's name.
        from_name: isGroup ? (groupSubject || undefined) : (isFromMe ? undefined : pushName),
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
        from_jid_kind: isGroupJid(remoteJid) ? "group" : parsedJid.kind,
        remote_jid_raw: remoteJid,
      };
    }

    // Other events we don't process as messages
    return { isEvolution: true, event };
  }

  return { isEvolution: false };
}

/**
 * Pick the best agent via weighted round-robin.
 *
 * Algorithm: score = conversations_assigned_last_30d / round_robin_weight
 * The agent with the lowest score gets the next conversation.
 *
 * Works for both modes:
 *   - weight mode:      weight is a relative multiplier (1–10)
 *   - percentage mode:  weight is an explicit percentage (1–100)
 * The scoring formula is identical — the difference is only in the UI.
 *
 * Uses a 30-day rolling window so that closing conversations doesn't
 * unfairly reset an agent's load counter.
 *
 * Respects allowed_integration_ids: if an agent has a non-null list,
 * they only receive conversations from integrations in that list.
 */
async function pickRoundRobinAgent(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  integrationId: string | null,
): Promise<string | null> {
  try {
    // Get all active agents/supervisors for the company
    const { data: agents } = await supabase
      .from("profiles")
      .select("id, round_robin_weight, allowed_integration_ids")
      .eq("company_id", companyId)
      .eq("is_active", true);

    if (!agents || agents.length === 0) return null;

    // Join with user_roles to get only agent/supervisor roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", agents.map((a: any) => a.id))
      .in("role", ["agent", "supervisor"]);

    const eligibleRoleIds = new Set((roles ?? []).map((r: any) => r.user_id));

    // Filter agents: must have eligible role AND pass integration filter
    const eligible = agents.filter((a: any) => {
      if (!eligibleRoleIds.has(a.id)) return false;
      // If agent has allowed_integration_ids set, check if current integration is allowed
      if (a.allowed_integration_ids && a.allowed_integration_ids.length > 0) {
        if (!integrationId) return false;
        return a.allowed_integration_ids.includes(integrationId);
      }
      return true; // null = receives from all integrations
    });

    if (eligible.length === 0) return null;

    // Count conversations assigned in the last 30 days (rolling window).
    // Using a time window prevents the "agent closed all chats → always gets next" bug.
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: counts } = await supabase
      .from("conversations")
      .select("assigned_user_id")
      .eq("company_id", companyId)
      .in("assigned_user_id", eligible.map((a: any) => a.id))
      .gte("created_at", since30d);

    const countMap: Record<string, number> = {};
    for (const row of (counts ?? [])) {
      if (row.assigned_user_id) {
        countMap[row.assigned_user_id] = (countMap[row.assigned_user_id] ?? 0) + 1;
      }
    }

    // Pick agent with lowest score (assigned_last_30d / weight).
    // Tie-breaking: first in list (consistent ordering from DB).
    let bestAgent: string | null = null;
    let bestScore = Infinity;
    for (const agent of eligible) {
      const assigned = countMap[agent.id] ?? 0;
      const weight = (agent as any).round_robin_weight || 1;
      const score = assigned / weight;
      if (score < bestScore) {
        bestScore = score;
        bestAgent = agent.id;
      }
    }

    console.log(
      `[round-robin] eligible=${eligible.length} best=${bestAgent} score=${bestScore.toFixed(2)}`
    );

    return bestAgent;
  } catch (err: any) {
    console.warn("[round-robin] error:", err.message);
    return null;
  }
}

/**
 * Pick the supervisor for a given integration's department, or fall back to
 * any company supervisor, then to admin.
 *
 * Chain:
 *   1. profile_departments supervisor in integration's department
 *   2. Any active user with role=supervisor in the company
 *   3. Any active user with role=admin in the company
 */
async function pickSupervisorOrAdmin(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  integrationId: string | null,
): Promise<string | null> {
  try {
    // Step 1: resolve department from integration → project → department
    let departmentId: string | null = null;
    if (integrationId) {
      const { data: integ } = await supabase
        .from("integrations")
        .select("project_id")
        .eq("id", integrationId)
        .maybeSingle();
      if (integ?.project_id) {
        const { data: project } = await supabase
          .from("projects")
          .select("department_id")
          .eq("id", integ.project_id)
          .maybeSingle();
        departmentId = project?.department_id ?? null;
      }
    }

    if (departmentId) {
      // Supervisors in this specific department (profile_departments)
      const { data: deptMembers } = await supabase
        .from("profile_departments")
        .select("profile_id")
        .eq("department_id", departmentId)
        .eq("role_in_department", "supervisor");

      const memberIds = (deptMembers ?? []).map((r: any) => r.profile_id);
      if (memberIds.length > 0) {
        const { data: active } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .in("id", memberIds)
          .limit(1);
        if (active?.[0]) {
          console.log(`[supervisor-route] dept=${departmentId} → ${active[0].id}`);
          return active[0].id;
        }
      }
    }

    // Step 2: any supervisor in the company (via user_roles)
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("is_active", true);

    const profileIds = (allProfiles ?? []).map((p: any) => p.id);
    if (profileIds.length === 0) return null;

    for (const roleToFind of ["supervisor", "admin"] as const) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", profileIds)
        .eq("role", roleToFind)
        .limit(1);
      if (roleRows?.[0]) {
        console.log(`[supervisor-route] fallback role=${roleToFind} → ${roleRows[0].user_id}`);
        return roleRows[0].user_id;
      }
    }

    return null;
  } catch (err: any) {
    console.warn("[supervisor-route] error:", err.message);
    return null;
  }
}

/**
 * Returns the assigned_user_id from the most recent conversation this contact
 * ever had (regardless of integration or status), if the agent is still active.
 * Used to re-route returning leads back to their previous agent.
 */
async function getLastAssignedAgent(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  contactId: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("conversations")
      .select("assigned_user_id")
      .eq("company_id", companyId)
      .eq("contact_id", contactId)
      .not("assigned_user_id", "is", null)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.assigned_user_id) return null;

    // Verify agent is still active
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, is_active")
      .eq("id", data.assigned_user_id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!profile?.is_active) return null;
    return profile.id;
  } catch {
    return null;
  }
}

/**
 * Check whether the active chatbot flow would trigger for a brand-new
 * (first) message in a new conversation.
 *
 * For new conversations:
 *   - any_message  → always triggers
 *   - first_message → always triggers (this IS the first message)
 *   - keyword       → triggers only if the message body contains the keyword
 *   - none          → never triggers
 */
async function willChatbotTriggerForNew(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  contactId: string,
  integrationId: string | null,
  messageBody: string,
): Promise<boolean> {
  try {
    // Respect per-contact chatbot disable flag
    const { data: contactData } = await supabase
      .from("contacts")
      .select("chatbot_enabled")
      .eq("id", contactId)
      .single();
    if (contactData?.chatbot_enabled === false) return false;

    const { data: activeFlow } = await supabase
      .from("chatbot_flows")
      .select("id, business_hours")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (!activeFlow) return false;

    const bh = (activeFlow.business_hours || {}) as Record<string, any>;
    const triggerType: string = bh._trigger?.type || "none";
    const triggerKeyword: string = bh._trigger?.keyword || "";
    const allowedIntegrationIds: string[] = bh._trigger?.integration_ids || [];

    const integrationAllowed =
      allowedIntegrationIds.length === 0 ||
      (integrationId !== null && allowedIntegrationIds.includes(integrationId));

    if (!integrationAllowed) return false;

    switch (triggerType) {
      case "any_message":
      case "first_message":
        return true;
      case "keyword": {
        const keywords = triggerKeyword
          .split(",")
          .map((k: string) => k.trim().toLowerCase())
          .filter(Boolean);
        const msgLower = messageBody.toLowerCase();
        return keywords.length > 0 && keywords.some((k: string) => msgLower.includes(k));
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
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
    // Cached integration config — set once during company lookup, reused later
    let evolutionIntegConfig: any = null;
    // integration_id for this message — stored on conversation for correct reply routing
    let integrationId: string | null = null;
    // LID detection — @lid contacts are device IDs, not phone numbers
    let isLidContact = false;
    let remoteJidRaw: string | null = null;

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

      // Find integration by instance name to get company_id (server-side JSONB filter)
      const { data: foundInteg } = await supabaseAdmin
        .from("integrations")
        .select("id, company_id, config")
        .eq("channel", "whatsapp")
        .eq("provider", "evolution")
        .filter("config->>instance_name", "eq", evolution.instance_name)
        .maybeSingle();

      const foundCompanyId = foundInteg?.company_id ?? null;
      integrationId = foundInteg?.id ?? null;
      // Cache integration config to avoid redundant re-fetches later
      if (foundInteg?.config) evolutionIntegConfig = foundInteg.config;

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

      // ── LID detection (device IDs, not phone numbers) ──────────────────
      // LID contacts have @lid domain — must NOT be treated as phone numbers.
      // They're stored in wa_identifier_raw instead of phone/phone_e164.
      isLidContact = evolution.from_jid_kind === "lid";
      remoteJidRaw = evolution.remote_jid_raw || null;
      if (isLidContact) {
        console.log(`[incoming] kind=lid jid=${remoteJidRaw} — LID contact, não normalizar como telefone`);
      }

      // ── Filter invalid JIDs (status broadcasts, newsletters, communities, invalid phones) ──
      const phoneDigits = from_phone.replace(/\D/g, "");
      const looksLikeGroupJid = /^\d+-\d+$/.test(from_phone); // e.g. 553183022054-1632608644
      const looksLikeCommunity = phoneDigits.startsWith("120363");
      // LID contacts bypass the digit-length filter — they're valid with 14-18 digits
      if (
        !isLidContact && (
          phoneDigits.length > 15 ||
          phoneDigits.length < 8 ||
          from_phone.includes("status") ||
          from_phone.includes("newsletter") ||
          from_phone === "0" ||
          looksLikeCommunity ||
          (looksLikeGroupJid && !is_group)
        )
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
    let contact: any = null;

    if (isLidContact) {
      // LID contacts: use wa_identifier_raw for lookup — phone is NOT available
      const { data: lidContact } = await supabase
        .from("contacts")
        .select("id, name, is_group, avatar_url")
        .eq("company_id", company_id)
        .eq("wa_identifier_raw", remoteJidRaw)
        .maybeSingle();
      contact = lidContact;

      if (!contact) {
        console.log(`[incoming] kind=lid jid=${remoteJidRaw} — criando contato sem telefone (wa_identifier_raw)`);
        const { data: newContact, error: contactErr } = await supabase
          .from("contacts")
          .insert({
            company_id,
            name: from_name || "WhatsApp",
            phone: null,
            phone_e164: null,
            wa_identifier_raw: remoteJidRaw,
            remote_jid_raw: remoteJidRaw,
            source: channel,
            tags: [],
            is_group: false,
            avatar_url: null,
          })
          .select("id, name, is_group")
          .single();
        if (contactErr) throw contactErr;
        contact = newContact;
      }
    } else {
      // Regular phone-based contact
      let { data: phoneContact } = await supabase
        .from("contacts")
        .select("id, name, is_group, avatar_url")
        .eq("company_id", company_id)
        .eq("phone", from_phone)
        .maybeSingle();

      if (!phoneContact) {
        // Try normalized phone lookup (indexed query instead of full table scan)
        const normalizedAttempt = normalizeWhatsAppPhone(from_phone);
        if (normalizedAttempt !== from_phone) {
          const { data: contact2 } = await supabase
            .from("contacts")
            .select("id, name, is_group, avatar_url")
            .eq("company_id", company_id)
            .eq("phone", normalizedAttempt)
            .maybeSingle();
          if (contact2) phoneContact = contact2;
        }

        if (!phoneContact) {
          // Compute E.164 and capture raw JID for the new contact
          const phoneE164 = normalizeWhatsAppNumberSafe(from_phone);
          const capturedJidRaw = remoteJidRaw ?? rawBody?.data?.key?.remoteJid ?? null;

          const { data: newContact, error: contactErr } = await supabase
            .from("contacts")
            .upsert(
              {
                company_id,
                name: from_name || from_phone,
                phone: from_phone,
                phone_e164: phoneE164,
                remote_jid_raw: capturedJidRaw,
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
          phoneContact = newContact;
        }
      }
      contact = phoneContact;
    }

    // ── Update contact metadata ────────────────────────
    const contactUpdates: Record<string, any> = {};

    // Set is_group flag if not already set
    if (is_group && !contact.is_group) {
      contactUpdates.is_group = true;
    }

    // Update avatar only for individual contacts (not groups) and only for incoming messages
    // When from_me=true, the profile_picture_url belongs to the agent, not the contact
    if (profile_picture_url && !is_group && !from_me) {
      contactUpdates.avatar_url = profile_picture_url;
    }

    // For groups: update name only if we have a group subject
    if (is_group && from_name && from_name !== from_phone && from_name !== contact.name) {
      contactUpdates.name = from_name;
    }

    // Apply basic contact updates immediately (from webhook data — no API calls)
    if (Object.keys(contactUpdates).length > 0) {
      await supabase
        .from("contacts")
        .update(contactUpdates)
        .eq("id", contact.id);
    }

    // ── Find the most recent conversation for this contact + integration ──
    // Each phone number (integration) gets its own isolated conversation per
    // contact. If the same contact messages Number 1 and Number 2, they
    // appear as TWO separate conversations — one per number.
    {
      let query = supabase
        .from("conversations")
        .select("id, status, integration_id")
        .eq("company_id", company_id)
        .eq("contact_id", contact.id)
        .eq("channel", channel);

      // Scope to the specific integration/number when known
      if (integrationId) {
        query = query.eq("integration_id", integrationId);
      }

      var { data: conversation } = await query
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (conversation) {
      // Reopen closed/resolved conversations when a new inbound message arrives
      const isClosed = conversation.status === "closed" || conversation.status === "resolved";
      const updates: Record<string, any> = {};
      if (isClosed && !from_me) {
        updates.status = "new";
        updates.close_reason = null;
        // Re-assign only if previously unassigned.
        // If the conversation already has an assigned agent, keep it (returning lead → same agent).
        const currentConv = await supabase
          .from("conversations")
          .select("assigned_user_id")
          .eq("id", conversation.id)
          .maybeSingle();
        if (!currentConv.data?.assigned_user_id) {
          // Unassigned closed conversation → route to supervisor/admin (not random agent)
          const supervisorId = await pickSupervisorOrAdmin(supabase, company_id, integrationId);
          if (supervisorId) updates.assigned_user_id = supervisorId;
        }
        // else: has assigned_user_id → keep it (returning lead goes back to same agent)
      }
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("conversations")
          .update(updates)
          .eq("id", conversation.id);
      }
      // last_message_at is kept up-to-date by the DB trigger on messages INSERT
    } else {
      // ── New conversation routing logic ────────────────────────────────────
      // 1. Returning lead: contact has a previous assigned conversation → same agent
      // 2. Chatbot will handle this message → no assignment (chatbot delegates later)
      // 3. No chatbot trigger → supervisor of the integration's department (or admin)
      let assignedAgentId: string | null = null;

      if (!from_me) {
        // 1. Check if this contact has been previously assigned to an agent
        const previousAgent = await getLastAssignedAgent(supabase, company_id, contact.id);
        if (previousAgent) {
          assignedAgentId = previousAgent;
          console.log(`[routing] returning lead → same agent ${previousAgent}`);
        } else {
          // 2. Check if chatbot would trigger for this new message
          const chatbotWillHandle = await willChatbotTriggerForNew(
            supabase, company_id, contact.id, integrationId, messageBody,
          );
          if (chatbotWillHandle) {
            // Chatbot is in charge — no agent assignment yet (chatbot flow will delegate)
            assignedAgentId = null;
            console.log(`[routing] chatbot trigger matched → no assignment`);
          } else {
            // 3. No keyword match and no chatbot trigger → route to supervisor/admin
            assignedAgentId = await pickSupervisorOrAdmin(supabase, company_id, integrationId);
            console.log(`[routing] no trigger → supervisor/admin ${assignedAgentId}`);
          }
        }
      }

      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          company_id,
          contact_id: contact.id,
          channel,
          status: "new",
          last_message_at: timestamp || new Date().toISOString(),
          ...(integrationId ? { integration_id: integrationId } : {}),
          ...(assignedAgentId ? { assigned_user_id: assignedAgentId } : {}),
        })
        .select("id")
        .single();

      if (convErr) throw convErr;
      conversation = newConv;

      if (assignedAgentId) {
        console.log(`[routing] conversa ${newConv.id} atribuída a ${assignedAgentId}`);
      }
    }

    // ── Download media from Evolution and store in our bucket ───
    if (evolution.isEvolution && media_url && media_type !== "text") {
      try {
        // Use cached integration config (fetched during company lookup)
        if (evolutionIntegConfig) {
          const ec = evolutionIntegConfig as any;
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
    // Also handles cases where Evolution fires the webhook with fromMe=false
    // for messages sent via the REST API (Evolution API quirk).
    {
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

        console.log(`Deduplicated agent message (fromMe=${from_me}): ${external_message_id}`);
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
    // last_message_at is kept up-to-date by the DB trigger on messages INSERT

    // ── Fire-and-forget: enrich contact from Evolution API ─────────────────
    // Runs AFTER the message is saved so it never delays delivery.
    if (evolution.isEvolution && evolution.instance_name && evolutionIntegConfig) {
      const _contactId = contact.id;
      const _hasAvatar = !!(contact as any).avatar_url;
      const _contactName: string = contact.name ?? "";
      const _instName = evolution.instance_name;
      const _cfg = evolutionIntegConfig;
      (async () => {
        try {
          let evoBaseUrl = (_cfg?.api_url || "").trim().replace(/\/+$/, "");
          if (evoBaseUrl && !/^https?:\/\//i.test(evoBaseUrl)) evoBaseUrl = `https://${evoBaseUrl}`;
          evoBaseUrl = evoBaseUrl.replace(/\/(manager|api)\/?$/i, "");
          const evoApiKey = _cfg?.api_key || "";
          if (!evoBaseUrl || !evoApiKey) return;

          const enrichUpdates: Record<string, any> = {};
          const nameIsPhone = _contactName && /^\d{8,}$/.test(_contactName.replace(/\D/g, ""));

          // Fetch profile picture if contact has none
          if (!_hasAvatar && !profile_picture_url && !from_me) {
            try {
              const remoteJid = is_group ? `${from_phone}@g.us` : `${from_phone}@s.whatsapp.net`;
              const picResp = await fetch(`${evoBaseUrl}/chat/fetchProfilePictureUrl/${_instName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoApiKey },
                body: JSON.stringify({ number: remoteJid }),
              });
              if (picResp.ok) {
                const picData = await picResp.json();
                const picUrl = picData?.profilePictureUrl || picData?.picture || picData?.url || null;
                if (picUrl) enrichUpdates.avatar_url = picUrl;
              }
            } catch {}
          }

          if (is_group && nameIsPhone) {
            // Fetch group subject
            try {
              const groupJid = `${from_phone}@g.us`;
              const grpResp = await fetch(`${evoBaseUrl}/group/findGroupInfos/${_instName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoApiKey },
                body: JSON.stringify({ groupJid }),
              });
              if (grpResp.ok) {
                const grpData = await grpResp.json();
                const subject = grpData?.subject || grpData?.name || null;
                if (subject) enrichUpdates.name = subject;
              }
            } catch {}
          } else if (!is_group && nameIsPhone) {
            // Fetch WhatsApp display name
            try {
              const contactJid = `${from_phone}@s.whatsapp.net`;
              const ctResp = await fetch(`${evoBaseUrl}/contact/fetchContacts/${_instName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoApiKey },
                body: JSON.stringify({ where: { id: contactJid } }),
              });
              if (ctResp.ok) {
                const ctData = await ctResp.json();
                const ctList = Array.isArray(ctData) ? ctData : (ctData?.contacts || []);
                const found = ctList.find((c: any) => c.id === contactJid || c.remoteJid === contactJid);
                const realName = found?.pushName || found?.name || found?.verifiedName || null;
                if (realName && !/^\d{8,}$/.test(realName.replace(/\D/g, ""))) {
                  enrichUpdates.name = realName;
                }
              }
            } catch {}
          }

          if (Object.keys(enrichUpdates).length > 0) {
            await supabase.from("contacts").update(enrichUpdates).eq("id", _contactId);
          }
        } catch (e) {
          console.warn("Background enrichment failed (non-fatal):", e);
        }
      })();
    }

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

    // ── Chatbot processing ──────────────────────────────────────────────────
    // Only process incoming messages (not messages sent by agents/system)
    if (!from_me) {
      try {
        // Skip chatbot if contact has it disabled
        const { data: contactData } = await supabase
          .from("contacts")
          .select("chatbot_enabled")
          .eq("id", contact.id)
          .single();

        const chatbotEnabled = contactData?.chatbot_enabled !== false;

        if (chatbotEnabled) {
          // Get the company's active chatbot flow
          const { data: activeFlow } = await supabase
            .from("chatbot_flows")
            .select("id, business_hours")
            .eq("company_id", company_id)
            .eq("is_active", true)
            .maybeSingle();

          if (activeFlow) {
            // Get current conversation chatbot state
            const { data: convState } = await supabase
              .from("conversations")
              .select("chatbot_active, chatbot_current_node")
              .eq("id", conversation.id)
              .single();

            let shouldRun = false;

            if (convState?.chatbot_active === true) {
              // Chatbot is already active and waiting for user input — always continue
              shouldRun = true;
            } else {
              // Evaluate the trigger condition to decide whether to start the flow
              const bh = (activeFlow.business_hours || {}) as Record<string, any>;
              const triggerType: string = bh._trigger?.type || "none";
              const triggerKeyword: string = bh._trigger?.keyword || "";
              const allowedIntegrationIds: string[] = bh._trigger?.integration_ids || [];

              // Filter by integration: [] = all; specific IDs = only those numbers
              const convIntegrationId: string | null = (conversation as any).integration_id ?? null;
              const integrationAllowed =
                allowedIntegrationIds.length === 0 ||
                (convIntegrationId !== null && allowedIntegrationIds.includes(convIntegrationId));

              if (integrationAllowed) {
                switch (triggerType) {
                  case "any_message":
                    shouldRun = true;
                    break;

                  case "first_message": {
                    // Only start if this is the very first user message in this conversation
                    const { count } = await supabase
                      .from("messages")
                      .select("id", { count: "exact", head: true })
                      .eq("conversation_id", conversation.id)
                      .eq("sender_type", "user");
                    shouldRun = (count ?? 0) <= 1;
                    break;
                  }

                  case "keyword": {
                    // Check if any keyword matches the message body
                    const keywords = triggerKeyword
                      .split(",")
                      .map((k: string) => k.trim().toLowerCase())
                      .filter(Boolean);
                    const msgLower = messageBody.toLowerCase();
                    shouldRun = keywords.length > 0 && keywords.some((k: string) => msgLower.includes(k));
                    break;
                  }

                  case "none":
                  default:
                    shouldRun = false;
                }
              }
            }

            if (shouldRun) {
              // Invoke chatbot-process asynchronously (fire-and-forget)
              // We don't await so the webhook responds quickly
              supabase.functions.invoke("chatbot-process", {
                body: {
                  conversation_id: conversation.id,
                  message_body: messageBody,
                  company_id,
                  contact_id: contact.id,
                },
              }).catch((e: unknown) =>
                console.warn("chatbot-process invoke failed:", e instanceof Error ? e.message : e)
              );
            }
          }
        }
      } catch (chatbotErr) {
        // Chatbot errors are non-fatal — the message was already saved
        console.warn("Chatbot trigger check failed (non-fatal):", chatbotErr);
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
