import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth: require JWT or service-role key ──────────────────────────────
  const auth = await verifyAuth(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));
    const { campaign_id } = body;

    // ── No campaign_id: process all due scheduled campaigns ──────────────
    if (!campaign_id) {
      const now = new Date().toISOString();
      const { data: due } = await supabase
        .from("campaigns")
        .select("id")
        .eq("status", "scheduled")
        .lte("schedule_at", now);

      if (!due || due.length === 0) {
        return new Response(JSON.stringify({ ok: true, triggered: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let triggered = 0;
      for (const c of due) {
        supabase.functions.invoke("execute-campaign", { body: { campaign_id: c.id } })
          .catch((e: unknown) => console.warn("execute-campaign invoke failed:", e));
        triggered++;
      }

      return new Response(JSON.stringify({ ok: true, triggered }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Single campaign execution ────────────────────────────────────────
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      console.error("[execute-campaign] Campaign not found:", campaign_id, campErr);
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[execute-campaign] Starting campaign:", campaign_id, "status:", campaign.status);

    if (campaign.status === "completed") {
      return new Response(JSON.stringify({ ok: true, skipped: "already_completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check deadline
    if (campaign.deadline_at && new Date(campaign.deadline_at) < new Date()) {
      await supabase.from("campaigns").update({ status: "completed" }).eq("id", campaign_id);
      return new Response(JSON.stringify({ ok: true, skipped: "deadline_passed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check send window (HH:MM - HH:MM)
    const sendWindow = (campaign.send_window as { start?: string; end?: string } | null) ?? {};
    if (sendWindow.start && sendWindow.end) {
      const now = new Date();
      const toMinutes = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        return h * 60 + m;
      };
      const cur = now.getHours() * 60 + now.getMinutes();
      if (cur < toMinutes(sendWindow.start) || cur > toMinutes(sendWindow.end)) {
        return new Response(JSON.stringify({ ok: true, skipped: "outside_send_window" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check skip weekends
    if (campaign.skip_weekends) {
      const day = new Date().getDay();
      if (day === 0 || day === 6) {
        return new Response(JSON.stringify({ ok: true, skipped: "weekend" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Mark as running
    await supabase.from("campaigns").update({ status: "running" }).eq("id", campaign_id);

    const filters = (campaign.filters ?? {}) as Record<string, any>;
    const actionConfig = (campaign.action_config ?? {}) as Record<string, any>;
    const companyId = campaign.company_id as string;
    const minDelay = Math.max(2, (campaign.min_delay_seconds as number) ?? 3);
    const maxDelay = Math.max(minDelay, (campaign.max_delay_seconds as number) ?? 8);
    const excludedSet = new Set<string>(
      Array.isArray(campaign.excluded_contact_ids) ? campaign.excluded_contact_ids as string[] : []
    );

    // ── Resolve actions to run (multi-action or legacy single) ──────────
    const actionsToRun: Array<Record<string, any>> =
      Array.isArray(actionConfig.actions) && actionConfig.actions.length > 0
        ? actionConfig.actions
        : [{ type: campaign.action_type as string, ...actionConfig }];

    console.log("[execute-campaign] Actions to run:", JSON.stringify(actionsToRun));

    // ── Fetch contacts in funnel/stage if filter is set ──────────────────
    let funnelContactIds: Set<string> | null = null;
    if (filters.funnel_id && filters.funnel_id !== "all") {
      const funnelQuery = supabase
        .from("contact_funnel_stages")
        .select("contact_id")
        .eq("funnel_id", filters.funnel_id);

      if (filters.funnel_stage_id && filters.funnel_stage_id !== "all") {
        funnelQuery.eq("stage_id", filters.funnel_stage_id);
      }

      const { data: funnelRows } = await funnelQuery;
      funnelContactIds = new Set((funnelRows ?? []).map((r: any) => r.contact_id));
      console.log("[execute-campaign] Funnel filter: found", funnelContactIds.size, "contacts");
    }

    // ── Build contact list ───────────────────────────────────────────────
    let contactQuery = supabase
      .from("contacts")
      .select(`
        id, phone, phone_e164, name, tags, created_at, source,
        conversations(
          id, status, channel, last_message_at,
          assigned_user_id
        )
      `)
      .eq("company_id", companyId)
      .eq("is_group", false);

    // include_tags filter via contact_tags junction table
    let includeTagContactIds: Set<string> | null = null;
    if (filters.include_tags?.length > 0) {
      const { data: tagRows } = await supabase
        .from("contact_tags")
        .select("contact_id")
        .in("tag_id", filters.include_tags)
        .eq("company_id", companyId);
      includeTagContactIds = new Set((tagRows ?? []).map((r: any) => r.contact_id));
    }

    // exclude_tags filter via contact_tags junction table
    let excludeTagContactIds: Set<string> | null = null;
    if (filters.exclude_tags?.length > 0) {
      const { data: exTagRows } = await supabase
        .from("contact_tags")
        .select("contact_id")
        .in("tag_id", filters.exclude_tags)
        .eq("company_id", companyId);
      excludeTagContactIds = new Set((exTagRows ?? []).map((r: any) => r.contact_id));
    }
    if (filters.registered_from) {
      contactQuery = contactQuery.gte("created_at", filters.registered_from);
    }
    if (filters.registered_to) {
      contactQuery = contactQuery.lte("created_at", `${filters.registered_to}T23:59:59Z`);
    }

    const { data: rawContacts, error: contErr } = await contactQuery;
    if (contErr) {
      console.error("[execute-campaign] Contact query error:", contErr);
      throw contErr;
    }

    const contacts = (rawContacts ?? []) as any[];
    console.log("[execute-campaign] Raw contacts fetched:", contacts.length);

    // ── Apply in-memory filters ──────────────────────────────────────────
    const filtered = contacts.filter((contact: any) => {
      // Excluded contacts (manually unchecked in preview)
      if (excludedSet.has(contact.id)) return false;

      // Funnel filter (pre-fetched above)
      if (funnelContactIds !== null && !funnelContactIds.has(contact.id)) return false;

      // Include tags filter
      if (includeTagContactIds !== null && !includeTagContactIds.has(contact.id)) return false;

      // Exclude tags filter
      if (excludeTagContactIds !== null && excludeTagContactIds.has(contact.id)) return false;

      const convs: any[] = contact.conversations ?? [];

      // If no conversations, only keep for actions that don't require them
      if (convs.length === 0) {
        // apply_tag and move_funnel work without conversations
        const nonConvTypes = new Set(["apply_tag", "move_funnel"]);
        return actionsToRun.every(a => nonConvTypes.has(a.type));
      }

      const latestConv = [...convs].sort((a: any, b: any) =>
        new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
      )[0];

      // Channel filters
      if (filters.include_channels?.length > 0) {
        if (!filters.include_channels.includes(latestConv.channel)) return false;
      }
      if (filters.exclude_channels?.length > 0) {
        if (filters.exclude_channels.includes(latestConv.channel)) return false;
      }

      // Conversation status
      if (filters.conversation_status && filters.conversation_status !== "all") {
        const statusMap: Record<string, string[]> = {
          open: ["open", "new"],
          new: ["new"],
          pending: ["pending"],
          closed: ["closed", "resolved"],
        };
        const allowed = statusMap[filters.conversation_status] ?? [filters.conversation_status];
        if (!allowed.includes(latestConv.status)) return false;
      }

      // Responsible user
      if (filters.responsible_user_id && filters.responsible_user_id !== "all") {
        if (latestConv.assigned_user_id !== filters.responsible_user_id) return false;
      }

      // Inactivity days
      if (filters.inactive_days_min != null || filters.inactive_days_max != null) {
        const daysSince = (Date.now() - new Date(latestConv.last_message_at ?? 0).getTime()) / 86400000;
        if (filters.inactive_days_min != null && daysSince < filters.inactive_days_min) return false;
        if (filters.inactive_days_max != null && daysSince > filters.inactive_days_max) return false;
      }

      return true;
    });

    console.log("[execute-campaign] Filtered contacts:", filtered.length, "of", contacts.length);

    // Update total count
    await supabase
      .from("campaigns")
      .update({ total_contacts: filtered.length })
      .eq("id", campaign_id);

    if (filtered.length === 0) {
      console.log("[execute-campaign] No contacts matched filters, completing.");
      await supabase.from("campaigns").update({ status: "completed", processed: 0 }).eq("id", campaign_id);
      return new Response(JSON.stringify({ ok: true, processed: 0, total: 0, note: "no_contacts_matched_filters" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Execute actions per contact ──────────────────────────────────────
    let processed = 0;

    for (const contact of filtered) {
      try {
        const convs: any[] = contact.conversations ?? [];
        const latestConv = convs.length > 0
          ? [...convs].sort((a: any, b: any) =>
              new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
            )[0]
          : null;

        for (const action of actionsToRun) {
          try {
            switch (action.type) {
              case "send_message": {
                if (!latestConv) {
                  console.warn(`[execute-campaign] send_message: no conversation for contact ${contact.id}`);
                  break;
                }
                const raw = (action.message ?? "") as string;
                if (!raw.trim()) {
                  console.warn(`[execute-campaign] send_message: empty message for contact ${contact.id}`);
                  break;
                }
                const message = raw.replace(/\{nome\}/gi, contact.name ?? "");
                await supabase.from("messages").insert({
                  conversation_id: latestConv.id,
                  company_id: companyId,
                  sender_type: "agent",
                  sender_id: null,
                  body: message,
                });
                supabase.functions.invoke("send-whatsapp", {
                  body: { conversation_id: latestConv.id, body: message },
                }).catch((e: any) => console.warn("[execute-campaign] send-whatsapp failed:", e));
                break;
              }

              case "apply_tag": {
                const tagIds: string[] = action.tag_ids ?? [];
                if (tagIds.length === 0) {
                  console.warn(`[execute-campaign] apply_tag: no tag_ids for contact ${contact.id}`);
                  break;
                }
                // Insert into contact_tags (the junction table the UI reads from)
                for (const tagId of tagIds) {
                  const { error: tagErr } = await supabase.from("contact_tags").upsert({
                    contact_id: contact.id,
                    tag_id: tagId,
                    company_id: companyId,
                  }, { onConflict: "contact_id,tag_id" });
                  if (tagErr) console.warn(`[execute-campaign] apply_tag upsert failed for tag ${tagId}:`, tagErr);
                }
                break;
              }

              case "set_status": {
                if (!latestConv) {
                  console.warn(`[execute-campaign] set_status: no conversation for contact ${contact.id}`);
                  break;
                }
                if (!action.status) {
                  console.warn(`[execute-campaign] set_status: no status configured for contact ${contact.id}`);
                  break;
                }
                await supabase
                  .from("conversations")
                  .update({ status: action.status })
                  .eq("id", latestConv.id);
                break;
              }

              case "archive_chats": {
                if (!latestConv) {
                  console.warn(`[execute-campaign] archive_chats: no conversation for contact ${contact.id}`);
                  break;
                }
                await supabase
                  .from("conversations")
                  .update({ status: "closed", close_reason: "campanha" })
                  .eq("id", latestConv.id);
                break;
              }

              case "delegate": {
                if (!latestConv) {
                  console.warn(`[execute-campaign] delegate: no conversation for contact ${contact.id}`);
                  break;
                }
                if (action.user_id) {
                  await supabase.from("conversations")
                    .update({ assigned_user_id: action.user_id })
                    .eq("id", latestConv.id);
                }
                break;
              }

              case "move_funnel": {
                if (!action.funnel_id || !action.stage_id) {
                  console.warn(`[execute-campaign] move_funnel: missing funnel_id or stage_id for contact ${contact.id}`);
                  break;
                }
                await supabase.from("contact_funnel_stages").upsert({
                  contact_id: contact.id,
                  company_id: companyId,
                  funnel_id: action.funnel_id,
                  stage_id: action.stage_id,
                }, { onConflict: "contact_id,funnel_id" });
                break;
              }

              case "run_flow": {
                if (!latestConv || !action.flow_id) {
                  console.warn(`[execute-campaign] run_flow: missing conversation or flow_id for contact ${contact.id}`);
                  break;
                }
                await supabase.from("conversations").update({
                  chatbot_active: true,
                  chatbot_current_node: 0,
                }).eq("id", latestConv.id);
                supabase.functions.invoke("chatbot-process", {
                  body: {
                    conversation_id: latestConv.id,
                    message_body: "",
                    company_id: companyId,
                    contact_id: contact.id,
                    force_flow_id: action.flow_id,
                  },
                }).catch((e: any) => console.warn("[execute-campaign] chatbot-process failed:", e));
                break;
              }

              default:
                console.warn(`[execute-campaign] Unknown action type: ${action.type}`);
            }
          } catch (actionErr) {
            console.error(`[execute-campaign] Action ${action.type} failed for contact ${contact.id}:`, actionErr);
          }
        }

        processed++;
        if (processed % 10 === 0) {
          await supabase.from("campaigns").update({ processed }).eq("id", campaign_id);
        }

        // Random delay between sends to avoid WhatsApp restrictions
        if (processed < filtered.length) {
          const delayMs = (minDelay + Math.random() * (maxDelay - minDelay)) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (e) {
        console.error(`[execute-campaign] Failed contact ${contact.id}:`, e);
      }
    }

    console.log("[execute-campaign] Completed. Processed:", processed, "of", filtered.length);

    await supabase
      .from("campaigns")
      .update({ status: "completed", processed, total_contacts: filtered.length })
      .eq("id", campaign_id);

    return new Response(JSON.stringify({ ok: true, processed, total: filtered.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[execute-campaign] Fatal error:", err);
    if (body?.campaign_id) {
      try {
        await supabase.from("campaigns").update({ status: "scheduled" }).eq("id", body.campaign_id);
      } catch (_) { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
