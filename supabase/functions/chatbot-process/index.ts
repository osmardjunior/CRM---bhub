import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Private/internal IP ranges that webhook URLs must NOT resolve to (SSRF prevention). */
const BLOCKED_IP_PREFIXES = [
  "10.", "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
  "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
  "172.30.", "172.31.", "192.168.", "127.", "0.",
  "169.254.", "100.64.",
];

/**
 * Validate a webhook URL for safety:
 * - Must be HTTPS (except localhost in dev)
 * - Must not target private/internal IPs
 * - Must be a valid URL
 */
function isWebhookUrlSafe(url: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }

  // Must be HTTPS
  if (parsed.protocol !== "https:") {
    return { safe: false, reason: "Only HTTPS URLs are allowed" };
  }

  // Block localhost and common internal hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { safe: false, reason: "Internal hostnames are not allowed" };
  }

  // Block private IP ranges
  for (const prefix of BLOCKED_IP_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      return { safe: false, reason: "Private IP addresses are not allowed" };
    }
  }

  // Block IPv6 loopback
  if (hostname === "::1" || hostname === "[::1]") {
    return { safe: false, reason: "IPv6 loopback is not allowed" };
  }

  return { safe: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: require JWT or service-role key ──────────────────────────────
    const auth = await verifyAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Test-AI path (used by FlowSimulator in the frontend) ────────────────
    if (body.test_ai === true) {
      const aiResponse = await callAI(
        body.ai_instructions || "",
        body.ai_context || "",
        body.user_message || "",
      );
      return new Response(JSON.stringify({ ai_response: aiResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Real processing ──────────────────────────────────────────────────────
    const { conversation_id, message_body, company_id, contact_id, flow_id } = body;

    if (!conversation_id || !company_id) {
      return new Response(JSON.stringify({ error: "conversation_id and company_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get flow: if flow_id is provided use that specific flow; otherwise fallback to first active flow
    let flow: any = null;
    if (flow_id) {
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("*")
        .eq("company_id", company_id)
        .eq("is_active", true)
        .eq("id", flow_id)
        .maybeSingle();
      if (!error) flow = data;
    }
    if (!flow) {
      // Fallback: get first active flow (use .limit(1) to avoid maybeSingle error with multiple rows)
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("*")
        .eq("company_id", company_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1);
      if (!error && data && data.length > 0) flow = data[0];
    }

    if (!flow) {
      console.log(`[chatbot-process] no active flow found for company=${company_id} flow_id=${flow_id}`);
      return new Response(JSON.stringify({ action: "no_flow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`[chatbot-process] using flow=${flow.id} name="${flow.name}"`);

    // ── Pre-fetch: resolve project + valid agents in 3 parallel queries ────
    // This avoids N+1 queries when validating candidates in delegate/smart_router
    const flowBh = (flow.business_hours || {}) as Record<string, any>;
    const flowIntegrationIds: string[] = flowBh._trigger?.integration_ids || [];

    let flowProjectId: string | null = null;
    if (flowIntegrationIds.length > 0) {
      const { data: flowInteg } = await supabase
        .from("integrations")
        .select("project_id")
        .eq("id", flowIntegrationIds[0])
        .maybeSingle();
      flowProjectId = flowInteg?.project_id ?? null;
    }

    // Fallback: if flow has no integration, try to get project from the conversation itself
    if (!flowProjectId && conversation_id) {
      const { data: convInteg } = await supabase
        .from("conversations")
        .select("integration:integrations!conversations_integration_id_fkey(project_id)")
        .eq("id", conversation_id)
        .maybeSingle();
      flowProjectId = (convInteg as any)?.integration?.project_id ?? null;
    }

    // Pre-fetch all eligible agents for this project (active, non-admin, in project)
    // This is done ONCE and reused by delegate + smart_router nodes
    const validAgentSet = new Set<string>();
    const agentLastSeen = new Map<string, string>(); // userId → last_seen_at ISO

    {
      // 1. Get all active profiles in this company
      const { data: activeProfiles } = await supabase
        .from("profiles")
        .select("id, last_seen_at")
        .eq("company_id", company_id)
        .eq("is_active", true);
      const allActiveIds = (activeProfiles ?? []).map((p: any) => p.id);

      if (allActiveIds.length > 0) {
        // 2. Get admin user IDs to exclude (single query)
        const { data: adminRows } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("user_id", allActiveIds)
          .eq("role", "admin");
        const adminSet = new Set((adminRows ?? []).map((r: any) => r.user_id));

        // 3. Get project members — ALWAYS when project is known
        let projectMemberSet: Set<string> | null = null;
        if (flowProjectId) {
          const { data: projectMembers } = await supabase
            .from("user_projects")
            .select("user_id")
            .eq("project_id", flowProjectId)
            .eq("active", true);
          projectMemberSet = new Set((projectMembers ?? []).map((m: any) => m.user_id));
        }

        // Build the valid set: active + not admin + in project (mandatory if known)
        for (const profile of (activeProfiles ?? [])) {
          const uid = profile.id;
          if (adminSet.has(uid)) continue;
          if (projectMemberSet && !projectMemberSet.has(uid)) continue;
          validAgentSet.add(uid);
          if (profile.last_seen_at) agentLastSeen.set(uid, profile.last_seen_at);
        }
      }
    }

    console.log(`[chatbot-process] flow=${flow.id} project=${flowProjectId} validAgents=${validAgentSet.size} integrations=${JSON.stringify(flowIntegrationIds)}`);

    // Fast in-memory check — O(1) per candidate instead of 3 DB queries
    const isValidAgent = (userId: string): boolean => {
      if (!userId) return false;
      return validAgentSet.has(userId);
    };

    // Pick an online agent from a list of valid candidates
    const pickOnlineFirst = (candidates: string[]): string | null => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const online = candidates.filter(uid => {
        const seen = agentLastSeen.get(uid);
        return seen && seen > fiveMinAgo;
      });
      if (online.length > 0) return online[Math.floor(Math.random() * online.length)];
      return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    };

    // Get all nodes ordered by position
    const { data: nodes } = await supabase
      .from("chatbot_nodes")
      .select("*")
      .eq("flow_id", flow.id)
      .order("position", { ascending: true });

    if (!nodes || nodes.length === 0) {
      return new Response(JSON.stringify({ action: "no_nodes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation state
    const { data: conv } = await supabase
      .from("conversations")
      .select("chatbot_current_node, chatbot_active, channel")
      .eq("id", conversation_id)
      .single();

    let currentNodeId = conv?.chatbot_current_node;
    let currentNode = currentNodeId
      ? nodes.find((n: any) => n.id === currentNodeId)
      : null;

    // If no current node, start from the first one
    if (!currentNode) {
      currentNode = nodes[0];
      await supabase
        .from("conversations")
        .update({ chatbot_current_node: currentNode.id, chatbot_active: true })
        .eq("id", conversation_id);
    }

    const responses: string[] = [];
    let shouldTransfer = false;
    let nextNode: any = currentNode;
    let processedCount = 0;
    const MAX_STEPS = 10; // guard against infinite loops

    while (nextNode && processedCount < MAX_STEPS) {
      processedCount++;
      const config = nextNode.config || {};

      switch (nextNode.node_type) {
        // ── Basic nodes ──────────────────────────────────────────────────────

        case "message": {
          responses.push(config.text || "");
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "menu": {
          if (processedCount === 1 && message_body) {
            // User is responding to a displayed menu
            const optionIndex = parseInt(message_body.trim()) - 1;
            const options: any[] = config.options || [];
            if (optionIndex >= 0 && optionIndex < options.length) {
              const chosen = options[optionIndex];
              if (chosen.next_position != null) {
                nextNode = nodes.find((n: any) => n.position === chosen.next_position)
                  || getNextNode(nodes, nextNode.position);
              } else {
                nextNode = getNextNode(nodes, nextNode.position);
              }
            } else {
              // Invalid option — re-show menu
              responses.push(config.text || "Escolha uma opção:");
              const opts: any[] = config.options || [];
              responses.push(opts.map((o, i) => `${i + 1}. ${o.label}`).join("\n"));
              nextNode = null; // wait for valid input
            }
          } else {
            // Show menu for the first time
            responses.push(config.text || "Escolha uma opção:");
            const options: any[] = config.options || [];
            responses.push(options.map((o, i) => `${i + 1}. ${o.label}`).join("\n"));
            nextNode = null; // wait for user input
          }
          break;
        }

        case "collect_data": {
          responses.push(config.prompt || "Por favor, informe seus dados:");
          // In a real scenario you'd track which field is pending — for now, advance
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "ai_response": {
          const aiResponse = await callAI(
            flow.ai_instructions || "",
            config.context || "",
            message_body || "",
          );
          responses.push(aiResponse);
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "transfer": {
          responses.push(config.message || "Transferindo para um atendente...");
          shouldTransfer = true;
          nextNode = null;
          break;
        }

        case "condition": {
          const isWithinHours = checkBusinessHours(flow.business_hours);
          if (isWithinHours) {
            nextNode = getNextNode(nodes, nextNode.position);
          } else {
            responses.push(flow.offline_message || "Estamos fora do horário de atendimento.");
            nextNode = null;
          }
          break;
        }

        // ── New node types ───────────────────────────────────────────────────

        case "apply_tag": {
          // Frontend saves tag_ids as array of UUIDs
          const tagIds: string[] = config.tag_ids || [];
          // Legacy: also support config.tag (name-based lookup)
          const tagName: string = config.tag || "";

          if (tagIds.length > 0 && contact_id) {
            for (const tagId of tagIds) {
              await supabase
                .from("contact_tags")
                .upsert(
                  { contact_id, tag_id: tagId, company_id },
                  { onConflict: "contact_id,tag_id" },
                );
            }
            console.log(`[chatbot-apply_tag] applied ${tagIds.length} tags to contact ${contact_id}`);
          } else if (tagName && contact_id) {
            // Legacy fallback: lookup by name
            const { data: tag } = await supabase
              .from("tags")
              .select("id")
              .eq("company_id", company_id)
              .eq("name", tagName)
              .maybeSingle();
            if (tag) {
              await supabase
                .from("contact_tags")
                .upsert(
                  { contact_id, tag_id: tag.id, company_id },
                  { onConflict: "contact_id,tag_id" },
                );
              console.log(`[chatbot-apply_tag] applied tag "${tagName}" (${tag.id}) to contact ${contact_id}`);
            }
          } else {
            console.log(`[chatbot-apply_tag] no tags to apply (tag_ids=${JSON.stringify(tagIds)}, tag="${tagName}", contact=${contact_id})`);
          }
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "move_to_funnel": {
          const funnelId: string = config.funnel_id || "";
          const stageId: string = config.stage_id || "";
          if (funnelId && stageId && contact_id) {
            await supabase
              .from("contact_funnel_stages")
              .upsert(
                { contact_id, funnel_id: funnelId, stage_id: stageId, company_id },
                { onConflict: "contact_id,funnel_id" },
              );
            console.log(`[chatbot-move_to_funnel] moved contact ${contact_id} to funnel=${funnelId} stage=${stageId}`);
          } else {
            console.log(`[chatbot-move_to_funnel] skipped — funnel_id="${funnelId}" stage_id="${stageId}" contact=${contact_id}`);
          }
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "delegate": {
          // Frontend saves user_ids (array) and department_ids (array)
          // PRIORITY: user_ids first — department is secondary context only
          const userIds: string[] = config.user_ids || [];
          const deptIds: string[] = config.department_ids || [];
          const legacyUserId: string = config.user_id || "";
          const preferOnline: boolean = config.prefer_online || false;

          // Build candidate list — user_ids have absolute priority
          let candidates: string[] = [...userIds];
          if (legacyUserId && !candidates.includes(legacyUserId)) {
            candidates.push(legacyUserId);
          }

          let validCandidates: string[];

          if (candidates.length > 0) {
            // Explicit user_ids: validate active + in project (isValidAgent checks both)
            validCandidates = candidates.filter(isValidAgent);
            console.log(`[chatbot-delegate] user_ids=${candidates.length} valid=${validCandidates.length} (project=${flowProjectId})`);
          } else if (deptIds.length > 0) {
            // Department fallback (only when NO user_ids configured)
            const { data: deptMembers } = await supabase
              .from("profile_departments")
              .select("profile_id")
              .in("department_id", deptIds)
              .in("role_in_department", ["supervisor", "agent"]);
            candidates = (deptMembers ?? []).map((m: any) => m.profile_id);
            // isValidAgent checks: active + not admin + in project
            validCandidates = candidates.filter(isValidAgent);
            console.log(`[chatbot-delegate] dept members=${candidates.length} valid=${validCandidates.length} (project=${flowProjectId})`);
          } else {
            validCandidates = [];
          }

          // Pick agent: prefer online if configured
          const convUpdate: Record<string, any> = {};
          if (validCandidates.length > 0) {
            const chosen = preferOnline
              ? pickOnlineFirst(validCandidates)
              : validCandidates[Math.floor(Math.random() * validCandidates.length)];
            if (chosen) {
              convUpdate.assigned_user_id = chosen;
              console.log(`[chatbot-delegate] → ${chosen} (project=${flowProjectId})`);
            }
          } else {
            // No valid candidates → leave unassigned (will appear in "não delegado")
            console.warn(`[chatbot-delegate] 0 valid candidates from ${candidates.length} — conversation stays unassigned (project=${flowProjectId})`);
          }

          // Department is context only — set it but it does NOT drive agent selection
          if (deptIds.length > 0) convUpdate.department_id = deptIds[0];

          if (Object.keys(convUpdate).length > 0) {
            await supabase.from("conversations").update(convUpdate).eq("id", conversation_id);
          }

          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "delay": {
          // Cap at 30 seconds so the function doesn't time out
          const delaySecs = Math.min(
            (config.seconds || 0) + (config.minutes || 0) * 60,
            30,
          );
          if (delaySecs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delaySecs * 1000));
          }
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "close_chat": {
          const closeMsg: string = config.message || "";
          if (closeMsg) responses.push(closeMsg);
          const closeStatus: string = config.status || "closed";
          await supabase
            .from("conversations")
            .update({ status: closeStatus, chatbot_active: false, chatbot_current_node: null })
            .eq("id", conversation_id);
          nextNode = null;
          break;
        }

        case "webhook": {
          const webhookUrl: string = config.url || "";
          const webhookMethod: string = (config.method || "POST").toUpperCase();
          if (webhookUrl) {
            // Validate URL safety (SSRF prevention)
            const urlCheck = isWebhookUrlSafe(webhookUrl);
            if (!urlCheck.safe) {
              console.warn(`Webhook node blocked: ${urlCheck.reason} — URL: ${webhookUrl}`);
            } else {
              try {
                let extraHeaders: Record<string, string> = {};
                if (config.headers) {
                  try { extraHeaders = JSON.parse(config.headers); } catch { /* ignore */ }
                }
                await fetch(webhookUrl, {
                  method: webhookMethod,
                  headers: { "Content-Type": "application/json", ...extraHeaders },
                  body: webhookMethod !== "GET"
                    ? JSON.stringify({
                        conversation_id,
                        contact_id,
                        message: message_body,
                        company_id,
                      })
                    : undefined,
                });
              } catch (e) {
                console.warn("Webhook node call failed:", e);
              }
            }
          }
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "smart_router": {
          const srMode: string = config.mode || "rules";
          const srRoutes: any[] = config.routes || [];
          const srDefaultRoute: any = config.default_route || {};
          const srAiPrompt: string = config.ai_prompt || "";

          let matchedRoute: any = null;

          // ── Rules matching ───────────────────────────────────────────────
          if (srMode === "rules" || srMode === "both") {
            const msgLower = (message_body || "").toLowerCase();
            for (const route of srRoutes) {
              const keywords: string[] = route.keywords || [];
              if (keywords.some((kw: string) => kw.trim() && msgLower.includes(kw.trim().toLowerCase()))) {
                matchedRoute = route;
                break;
              }
            }
          }

          // ── AI matching (fallback when no rule matched) ───────────────────
          if (!matchedRoute && (srMode === "ai" || srMode === "both") && srRoutes.length > 0) {
            const routeDescriptions = srRoutes
              .map((r: any) => `${r.label}: ${r.ai_intent_description || r.label}`)
              .join("\n");
            const aiContext = `Rotas disponíveis:\n${routeDescriptions}\n\nResponda com APENAS o nome exato de uma das rotas listadas acima.`;
            try {
              const aiDecision = await callAI(
                srAiPrompt || "Você é um classificador de intenções de mensagens de clientes. Classifique a mensagem em uma das rotas fornecidas.",
                aiContext,
                message_body || "",
              );
              const aiLower = aiDecision.toLowerCase();
              matchedRoute = srRoutes.find((r: any) => aiLower.includes(r.label.toLowerCase())) || null;
            } catch (e) {
              console.warn("smart_router AI classification failed:", e);
            }
          }

          // ── Execute matched route (no default fallback) ──────────────────
          const activeRoute: any = matchedRoute;

          if (!activeRoute) {
            // No route matched and no default — router is terminal, do nothing
            nextNode = null;
            break;
          }

          if (activeRoute.response) {
            responses.push(activeRoute.response);
          }

          // Apply tags by ID (stored directly as UUIDs)
          const routeTagIds: string[] = activeRoute.tag_ids || [];
          if (routeTagIds.length > 0 && contact_id) {
            for (const tagId of routeTagIds) {
              await supabase
                .from("contact_tags")
                .upsert(
                  { contact_id, tag_id: tagId, company_id },
                  { onConflict: "contact_id,tag_id" },
                );
            }
          }

          // Move to funnel stage
          const routeFunnelId: string = activeRoute.funnel_id || "";
          const routeStageId: string = activeRoute.stage_id || "";
          if (routeFunnelId && routeStageId && contact_id) {
            await supabase
              .from("contact_funnel_stages")
              .upsert(
                { contact_id, funnel_id: routeFunnelId, stage_id: routeStageId, company_id },
                { onConflict: "contact_id,funnel_id" },
              );
          }

          // Delegate to user by weighted percentage (in-memory filter — no DB queries)
          // isValidAgent checks: active + not admin + in project
          const userAssignments: Array<{ user_id: string; percentage: number }> = activeRoute.delegate_assignments || [];
          if (userAssignments.length > 0) {
            const validAssignments = userAssignments.filter(a => isValidAgent(a.user_id));
            if (validAssignments.length > 0) {
              const chosenUserId = weightedRandomPick(
                validAssignments.map((a: any) => ({ id: a.user_id, weight: a.percentage || 0 }))
              );
              if (chosenUserId) {
                await supabase
                  .from("conversations")
                  .update({ assigned_user_id: chosenUserId })
                  .eq("id", conversation_id);
                console.log(`[smart-router] → ${chosenUserId} (project=${flowProjectId})`);
              }
            } else {
              // No valid agents → stays unassigned ("não delegado")
              console.warn(`[smart-router] 0 valid agents from ${userAssignments.length} — stays unassigned (project=${flowProjectId})`);
            }
          }

          // Delegate to department by weighted percentage
          const deptAssignments: Array<{ department_id: string; percentage: number }> = activeRoute.delegate_dept_assignments || [];
          if (deptAssignments.length > 0) {
            const chosenDeptId = weightedRandomPick(
              deptAssignments.map((a: any) => ({ id: a.department_id, weight: a.percentage || 0 }))
            );
            if (chosenDeptId) {
              await supabase
                .from("conversations")
                .update({ department_id: chosenDeptId })
                .eq("id", conversation_id);
            }
          }

          // Smart router is terminal — flow ends after executing the route
          nextNode = null;
          break;
        }

        default: {
          // Unknown node type — skip to next
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }
      }
    }

    // ── Update conversation chatbot state ────────────────────────────────────
    const stateUpdate: Record<string, unknown> = {};
    if (nextNode) {
      stateUpdate.chatbot_current_node = nextNode.id;
      stateUpdate.chatbot_active = true;
    } else if (shouldTransfer) {
      stateUpdate.chatbot_active = false;
      stateUpdate.chatbot_current_node = null;
    } else if (!nextNode) {
      // Flow ended naturally
      stateUpdate.chatbot_active = false;
      stateUpdate.chatbot_current_node = null;
    }
    if (Object.keys(stateUpdate).length > 0) {
      await supabase.from("conversations").update(stateUpdate).eq("id", conversation_id);
    }

    // ── Send responses: insert to DB + deliver via WhatsApp ─────────────────
    // Delay between messages to simulate human behavior and avoid WhatsApp spam detection
    const channel = conv?.channel || "whatsapp";
    const validResponses = responses.filter(Boolean);
    for (let i = 0; i < validResponses.length; i++) {
      const responseBody = validResponses[i];

      // Delay between multiple messages (skip for first)
      // Random delay between 1000ms and 2500ms to simulate human behavior
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
      }

      // Insert to DB
      await supabase.from("messages").insert({
        conversation_id,
        company_id,
        body: responseBody,
        sender_type: "system",
      });

      // Deliver via integration
      if (channel === "whatsapp") {
        await sendViaWhatsApp(supabase, conversation_id, company_id, responseBody);
      }
    }

    // Update conversation last_message_at if we sent any message
    if (responses.filter(Boolean).length > 0) {
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversation_id);
    }

    return new Response(
      JSON.stringify({ action: shouldTransfer ? "transfer" : "continue", responses }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("chatbot-process error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNextNode(nodes: any[], currentPosition: number): any | null {
  return nodes.find((n: any) => n.position > currentPosition) ?? null;
}

/** Pick an ID from a weighted list. Returns null if list empty or all weights zero. */
function weightedRandomPick(items: Array<{ id: string; weight: number }>): string | null {
  const valid = items.filter(i => i.id && i.weight > 0);
  if (valid.length === 0) return null;
  const total = valid.reduce((s, i) => s + i.weight, 0);
  let rand = Math.random() * total;
  for (const item of valid) {
    rand -= item.weight;
    if (rand <= 0) return item.id;
  }
  return valid[valid.length - 1].id;
}

function checkBusinessHours(businessHours: any): boolean {
  if (!businessHours || Object.keys(businessHours).length === 0) return true;
  const now = new Date();
  const dayMap: Record<number, string> = {
    0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
  };
  const dayKey = dayMap[now.getDay()];
  const dayConfig = businessHours[dayKey];
  if (!dayConfig?.enabled) return false;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return currentTime >= dayConfig.start && currentTime <= dayConfig.end;
}

/** Call AI — prefers ANTHROPIC_API_KEY, falls back to LOVABLE_API_KEY */
async function callAI(
  aiInstructions: string,
  context: string,
  userMessage: string,
): Promise<string> {
  const systemPrompt = [aiInstructions, context].filter(Boolean).join("\n\n")
    || "Você é um assistente útil de atendimento ao cliente. Seja educado e objetivo.";

  // ── Try Anthropic first ──────────────────────────────────────────────────
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content?.[0]?.text || "Não consegui gerar uma resposta.";
      }
      console.error("Anthropic error:", res.status, await res.text());
    } catch (e) {
      console.error("Anthropic call failed:", e);
    }
  }

  // ── Fallback: Lovable gateway ────────────────────────────────────────────
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "Não consegui gerar uma resposta.";
      }
    } catch (e) {
      console.error("Lovable AI call failed:", e);
    }
  }

  return "Desculpe, o serviço de IA não está disponível no momento. Um atendente irá ajudá-lo.";
}

/** Send a text message via the company's WhatsApp integration */
async function sendViaWhatsApp(
  supabase: any,
  conversation_id: string,
  company_id: string,
  messageBody: string,
): Promise<void> {
  try {
    // Get contact phone and integration_id from conversation
    const { data: conv } = await supabase
      .from("conversations")
      .select("integration_id, contact:contacts!conversations_contact_id_fkey(phone, phone_e164)")
      .eq("id", conversation_id)
      .single();

    const phone: string | undefined = conv?.contact?.phone_e164 || conv?.contact?.phone;
    if (!phone) return;

    // Use the conversation's own integration_id, fallback to first connected
    let integration: any = null;
    if (conv?.integration_id) {
      const { data: intData } = await supabase
        .from("integrations")
        .select("*")
        .eq("id", conv.integration_id)
        .single();
      if (intData?.status === "connected") integration = intData;
    }

    if (!integration) {
      const { data: integrations } = await supabase
        .from("integrations")
        .select("*")
        .eq("company_id", company_id)
        .eq("channel", "whatsapp")
        .eq("status", "connected");
      if (!integrations || integrations.length === 0) return;
      integration = integrations[0];
    }
    const config = integration.config as Record<string, any>;
    const provider: string = integration.provider || "";

    if (provider === "evolution" || provider === "Evolution") {
      const apiKey: string = config.api_key || "";
      let apiUrl: string = (config.api_url || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(apiUrl)) apiUrl = `https://${apiUrl}`;
      apiUrl = apiUrl.replace(/\/(manager|api)\/?$/i, "");
      const instanceName: string = config.instance_name || "";

      if (!apiKey || !apiUrl || !instanceName) return;

      // ── Volume tracking + humanization (shared with send-whatsapp) ──
      // Never blocks — just adds progressive delay to look human
      const ageDays = integration.created_at
        ? Math.floor((Date.now() - new Date(integration.created_at).getTime()) / 86_400_000)
        : 999;
      const isNewNumber = ageDays <= 7;

      // Log + check volume + cleanup in parallel
      const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
      const cutoff25h = new Date(Date.now() - 25 * 3_600_000).toISOString();
      const [, { count: recentCount }] = await Promise.all([
        supabase.from("send_rate_log").insert({ integration_id: integration.id }),
        supabase.from("send_rate_log").select("id", { count: "exact", head: true })
          .eq("integration_id", integration.id).gte("sent_at", oneMinAgo),
        supabase.from("send_rate_log").delete().lt("sent_at", cutoff25h),
      ]);
      const msgsLastMin = recentCount ?? 0;

      // Always send typing indicator — core human behavior signal
      const phoneDigits = phone.replace(/\D/g, "");
      try {
        // Try v2 format first, fallback to flat format
        const v2Body = { number: phoneDigits, options: { delay: 1500, presence: "composing", number: phoneDigits } };
        const presRes = await fetch(`${apiUrl}/chat/sendPresence/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify(v2Body),
        });
        console.log(`[chatbot] sendPresence v2 ${presRes.status}`);
        if (!presRes.ok) {
          const v1Body = { number: phoneDigits, delay: 1500, presence: "composing" };
          const presRes2 = await fetch(`${apiUrl}/chat/sendPresence/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify(v1Body),
          });
          console.log(`[chatbot] sendPresence flat ${presRes2.status}`);
        }
      } catch (e: any) { console.warn(`[chatbot] sendPresence failed: ${e.message}`); }

      // Hard-block: aligned with send-whatsapp thresholds
      const hardMinute = ageDays <= 1 ? 2 : ageDays <= 3 ? 6 : ageDays <= 7 ? 10 : 20;
      if (msgsLastMin >= hardMinute) {
        console.warn(`[chatbot] HARD BLOCK: ${msgsLastMin}/${hardMinute} msgs/min (age=${ageDays}d) — waiting 60s`);
        await new Promise(r => setTimeout(r, 60_000));
      }

      // Progressive delay: more volume or newer number = longer delay
      const baseMsMin = isNewNumber ? 1000 : 600;
      const baseMsMax = isNewNumber ? 2000 : 1200;
      // Volume multiplier: each msg/min adds ~15% delay
      const volumeMultiplier = 1 + Math.min(msgsLastMin, 15) * 0.15;
      // Text length adds realistic "typing time" (up to 500ms for long messages)
      const textFactor = Math.min((messageBody?.length ?? 0) / 200, 1) * 500;
      const humanDelay = (baseMsMin + Math.random() * (baseMsMax - baseMsMin)) * volumeMultiplier + textFactor * 0.5;
      console.log(`[chatbot] Humanize: ${Math.round(humanDelay)}ms (${msgsLastMin}/min, age=${ageDays}d, hard=${hardMinute})`);
      await new Promise(r => setTimeout(r, humanDelay));

      const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: phone.replace(/\D/g, ""), text: messageBody }),
      });
      if (!res.ok) {
        console.warn("Evolution sendText failed:", res.status, await res.text());
      }
    } else if (provider === "meta" || provider === "Meta Cloud API") {
      const accessToken: string = config.access_token || config.token || "";
      const phoneNumberId: string = config.phone_number_id || "";
      if (!accessToken || !phoneNumberId) return;

      await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace(/\D/g, ""),
          type: "text",
          text: { body: messageBody },
        }),
      });
    }
    // Other providers (Twilio, 360dialog, etc.) can be added here if needed
  } catch (e) {
    console.warn("sendViaWhatsApp (chatbot) failed — message was saved to DB:", e);
  }
}
