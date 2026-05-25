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
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-evolution-signature",
};

/**
 * Verify HMAC-SHA256 webhook signature.
 * Returns true if valid or if secret is not configured (backwards compat).
 */
async function verifyWebhookSignature(
  bodyText: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

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
  quoted_stanza_id?: string;
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

      // Extract quoted message stanza ID (for reply threading)
      // Evolution API v2 may place contextInfo in different locations depending
      // on the message type — cover all known sub-objects AND top-level fallbacks.
      const contextInfo =
        message.extendedTextMessage?.contextInfo ||
        message.imageMessage?.contextInfo ||
        message.videoMessage?.contextInfo ||
        message.audioMessage?.contextInfo ||
        message.documentMessage?.contextInfo ||
        message.stickerMessage?.contextInfo ||
        message.contactMessage?.contextInfo ||
        message.locationMessage?.contextInfo ||
        message.listResponseMessage?.contextInfo ||
        message.buttonsResponseMessage?.contextInfo ||
        message.templateButtonReplyMessage?.contextInfo ||
        data.contextInfo ||
        null;
      const quotedStanzaId = contextInfo?.stanzaId || null;
      if (quotedStanzaId) {
        console.log(`[incoming] Reply detected — quoted stanzaId: ${quotedStanzaId}`);
      }

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
        quoted_stanza_id: quotedStanzaId || undefined,
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
  prioritizeOnline = false,
): Promise<string | null> {
  try {
    // Get all active agents/supervisors for the company
    const { data: agents } = await supabase
      .from("profiles")
      .select("id, round_robin_weight, allowed_integration_ids, last_seen_at")
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

    // Filter agents: must have eligible role, pass integration filter,
    // and NOT have round_robin_weight = 0 (excluded from auto-assign)
    let eligible = agents.filter((a: any) => {
      if (!eligibleRoleIds.has(a.id)) return false;
      // weight = 0 means "manual delegation only"
      if ((a as any).round_robin_weight === 0) return false;
      // If agent has allowed_integration_ids set, check if current integration is allowed
      if (a.allowed_integration_ids && a.allowed_integration_ids.length > 0) {
        if (!integrationId) return false;
        return a.allowed_integration_ids.includes(integrationId);
      }
      return true; // null = receives from all integrations
    });

    if (eligible.length === 0) return null;

    // Project filter: if the integration belongs to a project, only pick agents
    // who are active members of that project.
    if (integrationId) {
      const { data: integ } = await supabase
        .from("integrations")
        .select("project_id")
        .eq("id", integrationId)
        .maybeSingle();
      if (integ?.project_id) {
        const { data: projectMembers } = await supabase
          .from("user_projects")
          .select("user_id")
          .eq("project_id", integ.project_id)
          .eq("active", true);
        if (projectMembers && projectMembers.length > 0) {
          const memberSet = new Set(projectMembers.map((m: any) => m.user_id));
          const projectEligible = eligible.filter((a: any) => memberSet.has(a.id));
          if (projectEligible.length > 0) {
            console.log(`[round-robin] project filter: ${projectEligible.length}/${eligible.length} agents in project ${integ.project_id}`);
            eligible = projectEligible;
          } else {
            console.log(`[round-robin] project filter: no eligible agents in project, using all eligible`);
          }
        }
      }
    }

    // Online-first: if prioritizeOnline is true, prefer agents active in the last 5 minutes.
    // Falls back to all eligible agents if no online agents are found.
    if (prioritizeOnline) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const onlineEligible = eligible.filter(
        (a: any) => a.last_seen_at && a.last_seen_at > fiveMinAgo,
      );
      if (onlineEligible.length > 0) {
        console.log(
          `[round-robin] online-first: ${onlineEligible.length}/${eligible.length} agents online`,
        );
        eligible.length = 0;
        eligible.push(...onlineEligible);
      } else {
        console.log("[round-robin] online-first: no agents online, fallback to all eligible");
      }
    }

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
 * Pick an agent or supervisor for a given integration's PROJECT.
 * NEVER delegates to admins — only agents/supervisors connected to the project.
 *
 * Optimized for scale: pre-fetches all active profiles + roles in parallel,
 * then filters in-memory. Max 5 queries regardless of team size.
 */
async function pickSupervisorOrAdmin(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  integrationId: string | null,
  prioritizeOnline = false,
): Promise<string | null> {
  try {
    // Step 1: resolve project_id and department_id from integration
    let projectId: string | null = null;
    let departmentId: string | null = null;
    if (integrationId) {
      const { data: integ } = await supabase
        .from("integrations")
        .select("project_id")
        .eq("id", integrationId)
        .maybeSingle();
      if (integ?.project_id) {
        projectId = integ.project_id;
        const { data: project } = await supabase
          .from("projects")
          .select("department_id")
          .eq("id", integ.project_id)
          .maybeSingle();
        departmentId = project?.department_id ?? null;
      }
    }

    // Step 2a: fetch active profiles first (needed to scope roles query)
    const profilesRes = await supabase
      .from("profiles")
      .select("id, last_seen_at")
      .eq("company_id", companyId)
      .eq("is_active", true);

    const profiles = profilesRes.data ?? [];
    const activeIds = profiles.map((p: any) => p.id);

    // Step 2b: fetch roles + project members in parallel (scoped by active user IDs)
    const [rolesRes, projectMembersRes] = await Promise.all([
      activeIds.length > 0
        ? supabase.from("user_roles").select("user_id, role").in("user_id", activeIds)
        : Promise.resolve({ data: [] as any[] }),
      projectId
        ? supabase.from("user_projects").select("user_id").eq("project_id", projectId).eq("active", true)
        : Promise.resolve({ data: null }),
    ]);
    if (profiles.length === 0) return null;

    const activeSet = new Set(profiles.map((p: any) => p.id));
    const lastSeenMap = new Map(profiles.map((p: any) => [p.id, p.last_seen_at || ""]));

    // Build role sets
    const adminSet = new Set<string>();
    const supervisorSet = new Set<string>();
    for (const r of (rolesRes.data ?? [])) {
      if (!activeSet.has(r.user_id)) continue;
      if (r.role === "admin") adminSet.add(r.user_id);
      if (r.role === "supervisor") supervisorSet.add(r.user_id);
    }

    const projectMemberSet = projectMembersRes.data
      ? new Set((projectMembersRes.data as any[]).map((m: any) => m.user_id))
      : null;

    // Helper: pick from filtered IDs, prefer online
    const pickFrom = (ids: string[]): string | null => {
      if (ids.length === 0) return null;
      if (prioritizeOnline) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const online = ids.filter(id => (lastSeenMap.get(id) || "") > fiveMinAgo);
        if (online.length > 0) {
          const pick = online[Math.floor(Math.random() * online.length)];
          console.log(`[project-route] online pick → ${pick}`);
          return pick;
        }
      }
      return ids[Math.floor(Math.random() * ids.length)];
    };

    // Chain 1: project members (not admin)
    if (projectMemberSet && projectMemberSet.size > 0) {
      const eligible = [...projectMemberSet].filter(uid => activeSet.has(uid) && !adminSet.has(uid));
      const picked = pickFrom(eligible);
      if (picked) {
        console.log(`[project-route] project=${projectId} → ${picked}`);
        return picked;
      }
    }

    // Chain 2: department supervisors (not admin) — must be project member if project exists
    if (departmentId) {
      const { data: deptMembers } = await supabase
        .from("profile_departments")
        .select("profile_id")
        .eq("department_id", departmentId)
        .eq("role_in_department", "supervisor");
      const eligible = (deptMembers ?? [])
        .map((m: any) => m.profile_id)
        .filter((uid: string) => activeSet.has(uid) && !adminSet.has(uid) && (!projectMemberSet || projectMemberSet.has(uid)));
      const picked = pickFrom(eligible);
      if (picked) {
        console.log(`[project-route] dept supervisor → ${picked}`);
        return picked;
      }
    }

    // Chain 3: any supervisor in company (not admin) — must be project member if project exists
    const allSupervisors = [...supervisorSet].filter(uid => !adminSet.has(uid) && (!projectMemberSet || projectMemberSet.has(uid)));
    const picked = pickFrom(allSupervisors);
    if (picked) {
      console.log(`[project-route] fallback supervisor → ${picked}`);
      return picked;
    }

    // Chain 4 (last resort): if project filtering left nobody, try ANY project member regardless of role
    if (projectMemberSet && projectMemberSet.size > 0) {
      const anyProjectMember = [...projectMemberSet].filter(uid => activeSet.has(uid) && !adminSet.has(uid));
      const lastResort = pickFrom(anyProjectMember);
      if (lastResort) {
        console.log(`[project-route] last-resort project member → ${lastResort}`);
        return lastResort;
      }
    }

    console.log(`[project-route] no eligible agent found (company=${companyId})`);
    return null;
  } catch (err: any) {
    console.warn("[project-route] error:", err.message);
    return null;
  }
}

/**
 * Returns the assigned_user_id from the most recent conversation this contact
 * had on the SAME integration, if the agent is still active, belongs to the
 * project, and is NOT admin.
 *
 * Optimized: 2 queries (conversation + profile+role check in parallel).
 */
async function getLastAssignedAgent(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  contactId: string,
  integrationId: string | null,
): Promise<string | null> {
  try {
    // Query 1: find previous agent from same integration
    let query = supabase
      .from("conversations")
      .select("assigned_user_id")
      .eq("company_id", companyId)
      .eq("contact_id", contactId)
      .not("assigned_user_id", "is", null)
      .order("last_message_at", { ascending: false })
      .limit(1);

    if (integrationId) {
      query = query.eq("integration_id", integrationId);
    }

    const { data } = await query.maybeSingle();
    if (!data?.assigned_user_id) return null;

    const agentId = data.assigned_user_id;

    // Query 2+3 in parallel: verify active + not admin + in project
    const [profileRes, roleRes, projectRes] = await Promise.all([
      supabase.from("profiles").select("id, is_active").eq("id", agentId).eq("company_id", companyId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", agentId).eq("role", "admin").maybeSingle(),
      integrationId
        ? supabase.from("integrations").select("project_id").eq("id", integrationId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (!profileRes.data?.is_active) return null;
    if (roleRes.data) { console.log(`[routing] agent ${agentId} is admin — skip`); return null; }

    // Check project membership if project is known
    const projectId = (projectRes.data as any)?.project_id;
    if (projectId) {
      const { data: membership } = await supabase
        .from("user_projects")
        .select("user_id")
        .eq("user_id", agentId)
        .eq("project_id", projectId)
        .eq("active", true)
        .maybeSingle();
      if (!membership) {
        console.log(`[routing] agent ${agentId} not in project ${projectId} — skip`);
        return null;
      }
    }

    return agentId;
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
  chatbotEnabled?: boolean,
): Promise<boolean> {
  try {
    // Respect per-contact chatbot disable flag (passed from caller to avoid extra DB query)
    if (chatbotEnabled === false) return false;

    // Get ALL active flows — support multiple simultaneous chatbot flows
    const { data: activeFlows } = await supabase
      .from("chatbot_flows")
      .select("id, business_hours")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!activeFlows || activeFlows.length === 0) {
      console.log(`[willChatbotTrigger] no active flows for company=${companyId}`);
      return false;
    }

    console.log(`[willChatbotTrigger] checking ${activeFlows.length} flows, msg="${messageBody}", integ=${integrationId}`);
    // Check each flow: return true if any flow matches the trigger
    for (const activeFlow of activeFlows) {
      const bh = (activeFlow.business_hours || {}) as Record<string, any>;
      const triggerType: string = bh._trigger?.type || "none";
      const triggerKeyword: string = bh._trigger?.keyword || "";
      const allowedIntegrationIds: string[] = bh._trigger?.integration_ids || [];

      console.log(`[willChatbotTrigger] flow=${activeFlow.id} trigger=${triggerType} keyword="${triggerKeyword}" allowedIntegs=${JSON.stringify(allowedIntegrationIds)}`);

      const integrationAllowed =
        allowedIntegrationIds.length === 0 ||
        (integrationId !== null && allowedIntegrationIds.includes(integrationId));

      if (!integrationAllowed) {
        console.log(`[willChatbotTrigger] flow=${activeFlow.id} SKIPPED — integration ${integrationId} not in allowed list`);
        continue;
      }

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
          if (keywords.length > 0 && keywords.some((k: string) => msgLower.includes(k))) return true;
          break;
        }
        default:
          break;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Find the matching chatbot flow for a given message + integration.
 * Returns the flow id and its nodes trigger config or null if no match.
 */
async function findMatchingFlow(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  integrationId: string | null,
  messageBody: string,
  conversationId: string,
): Promise<{ flowId: string; shouldRun: boolean; triggerType: string } | null> {
  const { data: activeFlows } = await supabase
    .from("chatbot_flows")
    .select("id, business_hours")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!activeFlows || activeFlows.length === 0) return null;

  // First check if any conversation already has an active chatbot flow running
  const { data: convState } = await supabase
    .from("conversations")
    .select("chatbot_active, chatbot_current_node")
    .eq("id", conversationId)
    .single();

  // If chatbot already active, find which flow owns the current node
  if (convState?.chatbot_active === true && convState?.chatbot_current_node) {
    const { data: nodeFlow } = await supabase
      .from("chatbot_nodes")
      .select("flow_id")
      .eq("id", convState.chatbot_current_node)
      .maybeSingle();
    if (nodeFlow?.flow_id) {
      return { flowId: nodeFlow.flow_id, shouldRun: true, triggerType: "active_session" };
    }
    // fallback: use first active flow
    return { flowId: activeFlows[0].id, shouldRun: true, triggerType: "active_session" };
  }

  // Otherwise find first flow whose trigger matches
  console.log(`[findMatchingFlow] checking ${activeFlows.length} flows, msg="${messageBody}", integ=${integrationId}`);
  for (const flow of activeFlows) {
    const bh = (flow.business_hours || {}) as Record<string, any>;
    const triggerType: string = bh._trigger?.type || "none";
    const triggerKeyword: string = bh._trigger?.keyword || "";
    const allowedIntegrationIds: string[] = bh._trigger?.integration_ids || [];

    console.log(`[findMatchingFlow] flow=${flow.id} trigger=${triggerType} keyword="${triggerKeyword}" allowedIntegs=${JSON.stringify(allowedIntegrationIds)}`);

    const integrationAllowed =
      allowedIntegrationIds.length === 0 ||
      (integrationId !== null && allowedIntegrationIds.includes(integrationId));

    if (!integrationAllowed) {
      console.log(`[findMatchingFlow] flow=${flow.id} SKIPPED — integration not allowed`);
      continue;
    }

    switch (triggerType) {
      case "any_message":
        console.log(`[findMatchingFlow] flow=${flow.id} MATCHED any_message`);
        return { flowId: flow.id, shouldRun: true, triggerType: "any_message" };
      case "first_message": {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
          .eq("sender_type", "user");
        if ((count ?? 0) <= 1) {
          console.log(`[findMatchingFlow] flow=${flow.id} MATCHED first_message (count=${count})`);
          return { flowId: flow.id, shouldRun: true, triggerType: "first_message" };
        }
        break;
      }
      case "keyword": {
        const keywords = triggerKeyword
          .split(",")
          .map((k: string) => k.trim().toLowerCase())
          .filter(Boolean);
        const msgLower = messageBody.toLowerCase();
        console.log(`[findMatchingFlow] flow=${flow.id} keyword check: keywords=${JSON.stringify(keywords)} msg="${msgLower}"`);
        if (keywords.length > 0 && keywords.some((k: string) => msgLower.includes(k))) {
          console.log(`[findMatchingFlow] flow=${flow.id} MATCHED keyword`);
          return { flowId: flow.id, shouldRun: true, triggerType: "keyword" };
        }
        console.log(`[findMatchingFlow] flow=${flow.id} keyword NO MATCH`);
        break;
      }
      default:
        console.log(`[findMatchingFlow] flow=${flow.id} trigger=${triggerType} — skipping`);
        break;
    }
  }

  console.log(`[findMatchingFlow] NO flow matched`);
  return null;
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
    // Read raw body text first for HMAC signature validation
    const bodyText = await req.text();
    const rawBody = JSON.parse(bodyText);

    // Detect if this is an Evolution API webhook (has event + instance fields)
    const isEvolutionWebhook = !!(rawBody.event && rawBody.instance);

    // ── Auth: Webhook signature validation ──────────────────────────────────
    if (isEvolutionWebhook) {
      const evolutionSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET");
      if (evolutionSecret) {
        const sig = req.headers.get("x-evolution-signature");
        const valid = await verifyWebhookSignature(bodyText, sig, evolutionSecret);
        if (!valid) {
          console.warn("[incoming] Evolution webhook signature mismatch");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
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

    // ── Log every incoming webhook for diagnostics ──
    if (evolution.isEvolution) {
      console.log(`[incoming] event=${evolution.event} instance=${evolution.instance_name} from=${evolution.from_phone} group=${evolution.is_group} fromMe=${evolution.from_me} jid=${evolution.remote_jid_raw} body="${(evolution.body || '').slice(0, 50)}"`);
    }

    // ── Ultra-early group rejection — BEFORE any DB work ──
    if (evolution.isEvolution && evolution.is_group) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "group_message" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Ultra-early: reject non-message events quickly ──
    if (evolution.isEvolution && evolution.event && !["messages_upsert", "messages.update", "MESSAGES_UPDATE", "messages.delete", "MESSAGES_DELETE", "presence.update", "PRESENCE_UPDATE", "connection.update", "CONNECTION_UPDATE", "qrcode.updated", "QRCODE_UPDATED"].includes(evolution.event)) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, event: evolution.event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
      // ── Handle MESSAGES_UPDATE (edit from WhatsApp) ──
      if (evolution.event === "messages.update" || evolution.event === "MESSAGES_UPDATE") {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const updates = Array.isArray(rawBody.data) ? rawBody.data : [rawBody.data];
        for (const upd of updates) {
          const msgId = upd?.key?.id;
          const newText = upd?.update?.message?.conversation || upd?.update?.message?.extendedTextMessage?.text;
          if (msgId && newText) {
            await supabaseAdmin.from("messages")
              .update({ body: newText, edited_at: new Date().toISOString() })
              .eq("external_message_id", msgId);
            console.log(`[incoming-message] Edited message ${msgId}`);
          }
        }
        return new Response(JSON.stringify({ ok: true, handled: "messages_update" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── Handle MESSAGES_DELETE (delete from WhatsApp) ──
      if (evolution.event === "messages.delete" || evolution.event === "MESSAGES_DELETE") {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const keys = Array.isArray(rawBody.data) ? rawBody.data : [rawBody.data];
        for (const item of keys) {
          const msgId = item?.key?.id || item?.id || item?.message?.key?.id;
          if (msgId) {
            await supabaseAdmin.from("messages")
              .update({ deleted_at: new Date().toISOString() })
              .eq("external_message_id", msgId);
            console.log(`[incoming-message] Deleted message ${msgId}`);
          }
        }
        return new Response(JSON.stringify({ ok: true, handled: "messages_delete" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── Handle PRESENCE_UPDATE (typing indicator) ──
      if (evolution.event === "presence.update" || evolution.event === "PRESENCE_UPDATE") {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const presenceData = rawBody.data || {};
        const remoteJid = presenceData.id || Object.keys(presenceData.presences || {})[0] || "";
        const rawPhone = remoteJid.replace(/@.*$/, "").replace(/:.*$/, "");
        const presences = presenceData.presences || {};
        const presenceEntry = Object.values(presences)[0] as any;
        const lastPresence = presenceEntry?.lastKnownPresence || "available";
        const isTyping = lastPresence === "composing";

        // Find integration by instance name
        const { data: foundInteg } = await supabaseAdmin
          .from("integrations")
          .select("id, company_id")
          .eq("channel", "whatsapp")
          .eq("provider", "evolution")
          .filter("config->>instance_name", "eq", rawBody.instance)
          .maybeSingle();

        if (foundInteg && rawPhone) {
          // Find contact by phone
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("company_id", foundInteg.company_id)
            .or(`phone.eq.${rawPhone},phone_e164.eq.+${rawPhone}`)
            .maybeSingle();

          if (contact) {
            // Find open conversation
            const { data: conv } = await supabaseAdmin
              .from("conversations")
              .select("id")
              .eq("contact_id", contact.id)
              .eq("company_id", foundInteg.company_id)
              .not("status", "eq", "closed")
              .order("last_message_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (conv) {
              // Broadcast typing state via Realtime
              const channel = supabaseAdmin.channel(`typing-${conv.id}`);
              await channel.send({
                type: "broadcast",
                event: "typing",
                payload: { conversation_id: conv.id, is_typing: isTyping },
              });
              supabaseAdmin.removeChannel(channel);
            }
          }
        }
        return new Response(JSON.stringify({ ok: true, handled: "presence_update" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── Handle CONNECTION_UPDATE (instance connect/disconnect) ──
      if (evolution.event === "connection.update" || evolution.event === "CONNECTION_UPDATE") {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const connData = rawBody.data || {};
        const state = connData.state || "unknown";
        // "open" / "connected" = connected; "close" / "disconnected" = disconnected; "connecting" = transitional (ignore)
        if (state !== "connecting") {
          const isConnected = state === "open" || state === "connected";
          const newStatus = isConnected ? "connected" : "disconnected";

          const { data: foundInteg } = await supabaseAdmin
            .from("integrations")
            .select("id")
            .eq("channel", "whatsapp")
            .eq("provider", "evolution")
            .filter("config->>instance_name", "eq", rawBody.instance)
            .maybeSingle();

          if (foundInteg) {
            await supabaseAdmin
              .from("integrations")
              .update({ status: newStatus })
              .eq("id", foundInteg.id);
            console.log(`[incoming-message] CONNECTION_UPDATE: ${rawBody.instance} → ${newStatus} (state=${state})`);
          }
        }
        return new Response(JSON.stringify({ ok: true, handled: "connection_update" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Skip non-message events
      if (evolution.event !== "messages_upsert") {
        return new Response(
          JSON.stringify({ ok: true, skipped: true, event: evolution.event }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Group messages already rejected at ultra-early check above

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
        console.warn(`[incoming] No integration found for instance: ${evolution.instance_name} — ignoring`);
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "unknown_instance" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    // ── Validate company + idempotency check (parallel) ──
    const [{ data: company, error: companyErr }, { data: existing }] = await Promise.all([
      supabase.from("companies").select("id, priority_online_agents").eq("id", company_id).maybeSingle(),
      supabase.from("messages").select("id, conversation_id").eq("external_message_id", external_message_id).maybeSingle(),
    ]);

    if (companyErr) throw companyErr;
    if (!company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
        .select("id, name, is_group, avatar_url, chatbot_enabled")
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
      const contactSelect = "id, name, is_group, avatar_url, chatbot_enabled, phone";
      let phoneContact: any = null;
      let needsPhoneSync = false;

      // 1) Exact match on phone column
      { const { data } = await supabase
          .from("contacts").select(contactSelect)
          .eq("company_id", company_id).eq("phone", from_phone).maybeSingle();
        if (data) phoneContact = data;
      }

      // 2) Normalized phone variant
      if (!phoneContact) {
        const normalizedAttempt = normalizeWhatsAppPhone(from_phone);
        if (normalizedAttempt !== from_phone) {
          const { data } = await supabase
            .from("contacts").select(contactSelect)
            .eq("company_id", company_id).eq("phone", normalizedAttempt).maybeSingle();
          if (data) phoneContact = data;
        }
      }

      // 3) phone_e164 fallback — catches the 9th-digit mismatch where
      //    send-whatsapp updated phone_e164 but phone stayed with old format
      if (!phoneContact) {
        const e164Attempt = normalizeWhatsAppNumberSafe(from_phone);
        if (e164Attempt) {
          const { data } = await supabase
            .from("contacts").select(contactSelect)
            .eq("company_id", company_id).eq("phone_e164", e164Attempt).maybeSingle();
          if (data) { phoneContact = data; needsPhoneSync = true; }
        }
      }

      // 4) 9th digit variant — BR numbers may exist with or without the 9th digit
      if (!phoneContact) {
        const digits = from_phone.replace(/\D/g, "");
        let variant: string | null = null;
        if (digits.startsWith("55") && digits.length === 13) {
          // Has 9th digit → try without it: 55 + DDD(2) + 9 + local(8) → 55 + DDD(2) + local(8)
          variant = digits.slice(0, 4) + digits.slice(5);
        } else if (digits.startsWith("55") && digits.length === 12) {
          // No 9th digit → try with it: 55 + DDD(2) + local(8) → 55 + DDD(2) + 9 + local(8)
          variant = digits.slice(0, 4) + "9" + digits.slice(4);
        }
        if (variant) {
          const { data } = await supabase
            .from("contacts").select(contactSelect)
            .eq("company_id", company_id).eq("phone", variant).maybeSingle();
          if (data) { phoneContact = data; needsPhoneSync = true; }
        }
      }

      if (phoneContact) {
        // Sync phone column so future lookups hit on the first try
        if (needsPhoneSync && phoneContact.phone !== from_phone) {
          console.log(`[incoming] syncing phone: ${phoneContact.phone} → ${from_phone} (contact ${phoneContact.id})`);
          await supabase.from("contacts").update({ phone: from_phone }).eq("id", phoneContact.id);
        }
      } else {
        // No existing contact found → create new one
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
        .select("id, status, integration_id, assigned_user_id, archived_at")
        .eq("company_id", company_id)
        .eq("contact_id", contact.id)
        .eq("channel", channel);

      // Scope to the specific integration/number when known,
      // BUT also match conversations with NULL integration_id (from imports/sync)
      // to prevent duplicates when a contact already has an unlinked conversation.
      if (integrationId) {
        query = query.or(`integration_id.eq.${integrationId},integration_id.is.null`);
      }

      var { data: conversation } = await query
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    const isConvArchived = !!(conversation as any)?.archived_at;

    if (conversation) {
      // Reopen closed/resolved conversations when a new inbound message arrives
      const isClosed = conversation.status === "closed" || conversation.status === "resolved";
      const updates: Record<string, any> = {};

      // Fix orphaned conversations: assign integration_id if it was NULL
      if (!conversation.integration_id && integrationId) {
        updates.integration_id = integrationId;
        console.log(`[routing] fixed NULL integration_id → ${integrationId} on conversation ${conversation.id}`);
      }

      if (isClosed && !from_me && !isConvArchived) {
        updates.status = "new";
        updates.close_reason = null;
        // Re-assign only if previously unassigned.
        // If the conversation already has an assigned agent, keep it (returning lead → same agent).
        if (!conversation.assigned_user_id) {
          // Unassigned closed conversation → keep unassigned (manual distribution)
          console.log(`[routing] reopened conversation ${conversation.id} → stays unassigned`);
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
        // 1. Check if this contact has been previously assigned to an agent (same integration/project)
        const previousAgent = await getLastAssignedAgent(supabase, company_id, contact.id, integrationId);
        if (previousAgent) {
          assignedAgentId = previousAgent;
          console.log(`[routing] returning lead → same agent ${previousAgent}`);
        } else {
          // 2. Check if chatbot would trigger for this new message
          const chatbotWillHandle = await willChatbotTriggerForNew(
            supabase, company_id, contact.id, integrationId, messageBody,
            contact?.chatbot_enabled,
          );
          if (chatbotWillHandle) {
            // Chatbot is in charge — no agent assignment yet (chatbot flow will delegate)
            assignedAgentId = null;
            console.log(`[routing] chatbot trigger matched → no assignment`);
          } else {
            // 3. No chatbot trigger → stays unassigned (manual distribution by supervisor)
            assignedAgentId = null;
            console.log(`[routing] no chatbot trigger → unassigned (manual distribution)`);
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

      if (convErr) {
        // Race condition: another request created the conversation between our lookup and insert
        // Retry the lookup once to find the existing conversation
        if (convErr.code === "23505") {
          console.log(`[incoming] conversation conflict — retrying lookup for contact ${contact.id}`);
          let retryQ = supabase
            .from("conversations")
            .select("id, status, integration_id, assigned_user_id, archived_at")
            .eq("company_id", company_id)
            .eq("contact_id", contact.id)
            .eq("channel", channel);
          if (integrationId) {
            retryQ = retryQ.or(`integration_id.eq.${integrationId},integration_id.is.null`);
          }
          const { data: retryConv } = await retryQ
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (retryConv) {
            conversation = retryConv;
          } else {
            throw convErr;
          }
        } else {
          throw convErr;
        }
      } else {
        conversation = newConv;
      }

      if (assignedAgentId) {
        console.log(`[routing] conversa ${newConv.id} atribuída a ${assignedAgentId}`);
      }
    }

    // Media download moved to fire-and-forget AFTER message INSERT (see below)
    const shouldDownloadMedia = evolution.isEvolution && media_url && media_type !== "text" && evolutionIntegConfig;
    const originalMediaUrl = media_url;

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

    // ── Resolve reply_to_id from quoted stanza ───
    let replyToId: string | null = null;
    if (evolution.quoted_stanza_id) {
      const { data: quotedDbMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .eq("external_message_id", evolution.quoted_stanza_id)
        .maybeSingle();
      replyToId = quotedDbMsg?.id ?? null;
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
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    });

    if (msgErr) throw msgErr;
    // last_message_at is kept up-to-date by the DB trigger on messages INSERT

    // ── Fire-and-forget: download media from Evolution and store in our bucket ──
    // Runs AFTER the message is saved so media download never delays delivery.
    // The message appears immediately with Evolution's temporary URL; we update
    // it in the background with our permanent Storage URL.
    if (shouldDownloadMedia) {
      const _convId = conversation.id;
      const _extMsgId = external_message_id;
      const _cfg = evolutionIntegConfig as any;
      const _instName = evolution.instance_name;
      (async () => {
        try {
          let evoUrl = (_cfg?.api_url || "").trim().replace(/\/+$/, "");
          if (evoUrl && !/^https?:\/\//i.test(evoUrl)) evoUrl = `https://${evoUrl}`;
          evoUrl = evoUrl.replace(/\/(manager|api)\/?$/i, "");
          const evoKey = _cfg?.api_key || "";
          if (!evoUrl || !evoKey) return;

          const mediaResp = await fetch(
            `${evoUrl}/chat/getBase64FromMediaMessage/${_instName}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evoKey },
              body: JSON.stringify({ message: { key: { id: _extMsgId } }, convertToMp4: false }),
            },
          );
          if (!mediaResp.ok) return;

          const mediaData = await mediaResp.json();
          const base64 = mediaData.base64 || mediaData.data;
          const mimetype = mediaData.mimetype || mediaData.mediaType || "application/octet-stream";
          if (!base64) return;

          const extMap: Record<string, string> = {
            "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
            "audio/aac": "aac", "audio/opus": "opus",
            "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
            "video/mp4": "mp4", "video/3gpp": "3gp",
            "application/pdf": "pdf",
          };
          const ext = extMap[mimetype] || mimetype.split("/")[1] || "bin";
          const fileName = `${company_id}/${_convId}/${_extMsgId}.${ext}`;

          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("chat-media")
            .upload(fileName, bytes.buffer, { contentType: mimetype, upsert: true });

          if (!uploadErr && uploadData) {
            const { data: publicUrl } = supabase.storage.from("chat-media").getPublicUrl(fileName);
            await supabase.from("messages")
              .update({ media_url: publicUrl.publicUrl })
              .eq("external_message_id", _extMsgId)
              .eq("conversation_id", _convId);
            console.log(`[media] Stored async: ${publicUrl.publicUrl}`);
          }
        } catch (e: any) {
          console.warn("[media] Async download failed:", e.message);
        }
      })();
    }

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
    console.log(`[chatbot] from_me=${from_me} messageBody="${messageBody}" contactId=${contact.id}`);
    if (!from_me && !isConvArchived) {
      try {
        // Use chatbot_enabled from the contact already fetched above (no extra query)
        const chatbotEnabled = contact?.chatbot_enabled !== false;
        console.log(`[chatbot] chatbotEnabled=${chatbotEnabled}`);

        if (chatbotEnabled) {
          // Find the matching chatbot flow (supports multiple active flows)
          // Use the global integrationId (from Evolution webhook) — conversation object may not have it
          const convIntegrationId: string | null = integrationId ?? (conversation as any).integration_id ?? null;
          console.log(`[chatbot] calling findMatchingFlow convId=${conversation.id} integId=${convIntegrationId}`);
          const matched = await findMatchingFlow(
            supabase,
            company_id,
            convIntegrationId,
            messageBody,
            conversation.id,
          );

          console.log(`[chatbot] findMatchingFlow result: ${JSON.stringify(matched)}`);
          if (matched?.shouldRun) {
            // ── Guard: skip chatbot re-trigger when conversation already has an assigned agent ──
            // If the lead sends the trigger keyword again on the same conversation,
            // the delegate/smart_router node would randomly reassign to a different agent.
            // We only allow re-trigger for active chatbot sessions (user is mid-flow).
            const alreadyAssigned = !!(conversation as any).assigned_user_id;
            const isRetrigger = matched.triggerType === "keyword" || matched.triggerType === "any_message";
            if (alreadyAssigned && isRetrigger) {
              console.log(`[chatbot] SKIPPED — conversation ${conversation.id} already assigned to ${(conversation as any).assigned_user_id}, trigger=${matched.triggerType}`);
            } else {
              // Only keyword triggers should reopen pending conversations
              // any_message and first_message triggers should NOT change pending status
              if (conversation.status === "pending" && matched.triggerType === "keyword") {
                await supabase
                  .from("conversations")
                  .update({ status: "open" })
                  .eq("id", conversation.id);
                console.log(`[chatbot] conversation ${conversation.id} was pending → reopened to open (keyword trigger)`);
              }
              // Invoke chatbot-process asynchronously (fire-and-forget)
              // Pass flow_id so chatbot-process uses the correct flow
              supabase.functions.invoke("chatbot-process", {
                body: {
                  conversation_id: conversation.id,
                  message_body: messageBody,
                  company_id,
                  contact_id: contact.id,
                  flow_id: matched.flowId,
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
    // Log full context so we can diagnose 500s from Evolution webhooks
    let debugCtx = "";
    try {
      const clonedBody = await req.clone().json().catch(() => null);
      debugCtx = clonedBody
        ? ` | event=${clonedBody.event} instance=${clonedBody.instance} dataKeys=${JSON.stringify(Object.keys(clonedBody.data || {}))}`
        : "";
    } catch { /* ignore */ }
    console.error(`Webhook error:${debugCtx}`, err?.stack || err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
