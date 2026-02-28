import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
    const flowQuery = supabase
      .from("chatbot_flows")
      .select("*")
      .eq("company_id", company_id)
      .eq("is_active", true);

    if (flow_id) {
      flowQuery.eq("id", flow_id);
    }

    const { data: flow, error: flowErr } = await flowQuery.maybeSingle();

    if (flowErr || !flow) {
      return new Response(JSON.stringify({ action: "no_flow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          const tagName: string = config.tag || "";
          if (tagName && contact_id) {
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
            }
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
          }
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "delegate": {
          const userId: string = config.user_id || "";
          if (userId) {
            await supabase
              .from("conversations")
              .update({ assigned_user_id: userId })
              .eq("id", conversation_id);
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

          // Delegate to user by weighted percentage
          const userAssignments: Array<{ user_id: string; percentage: number }> = activeRoute.delegate_assignments || [];
          if (userAssignments.length > 0) {
            const chosenUserId = weightedRandomPick(
              userAssignments.map((a: any) => ({ id: a.user_id, weight: a.percentage || 0 }))
            );
            if (chosenUserId) {
              await supabase
                .from("conversations")
                .update({ assigned_user_id: chosenUserId })
                .eq("id", conversation_id);
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
    const channel = conv?.channel || "whatsapp";
    for (const responseBody of responses.filter(Boolean)) {
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
