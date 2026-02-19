import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id, message_body, company_id, contact_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get active flow for company
    const { data: flow, error: flowErr } = await supabase
      .from("chatbot_flows")
      .select("*")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .maybeSingle();

    if (flowErr || !flow) {
      return new Response(JSON.stringify({ action: "no_flow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all nodes for this flow ordered by position
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
      .select("chatbot_current_node, chatbot_active")
      .eq("id", conversation_id)
      .single();

    let currentNodeId = conv?.chatbot_current_node;
    let currentNode = currentNodeId
      ? nodes.find((n: any) => n.id === currentNodeId)
      : null;

    // If no current node, start from beginning
    if (!currentNode) {
      currentNode = nodes[0];
      await supabase
        .from("conversations")
        .update({ chatbot_current_node: currentNode.id, chatbot_active: true })
        .eq("id", conversation_id);
    }

    const responses: string[] = [];
    let shouldTransfer = false;
    let nextNode = currentNode;
    let processedCount = 0;
    const MAX_STEPS = 10; // prevent infinite loops

    while (nextNode && processedCount < MAX_STEPS) {
      processedCount++;
      const config = nextNode.config || {};

      switch (nextNode.node_type) {
        case "message":
          responses.push(config.text || "");
          nextNode = getNextNode(nodes, nextNode.position);
          break;

        case "menu":
          if (processedCount === 1 && message_body) {
            // User is responding to a menu - find matching option
            const optionIndex = parseInt(message_body) - 1;
            const options = config.options || [];
            if (optionIndex >= 0 && optionIndex < options.length) {
              const chosen = options[optionIndex];
              if (chosen.next_position != null) {
                nextNode = nodes.find((n: any) => n.position === chosen.next_position) || getNextNode(nodes, nextNode.position);
              } else {
                nextNode = getNextNode(nodes, nextNode.position);
              }
            } else {
              responses.push(config.text || "Escolha uma opção:");
              responses.push(options.map((o: any, i: number) => `${i + 1}. ${o.label}`).join("\n"));
              nextNode = null; // Wait for valid input
            }
          } else {
            // Show menu
            responses.push(config.text || "Escolha uma opção:");
            const options = config.options || [];
            responses.push(options.map((o: any, i: number) => `${i + 1}. ${o.label}`).join("\n"));
            nextNode = null; // Wait for user input
          }
          break;

        case "collect_data":
          responses.push(config.prompt || "Por favor, informe seus dados:");
          // In a real implementation, you'd track which field is being collected
          nextNode = getNextNode(nodes, nextNode.position);
          break;

        case "ai_response": {
          const aiResponse = await callAI(flow, config, message_body);
          responses.push(aiResponse);
          nextNode = getNextNode(nodes, nextNode.position);
          break;
        }

        case "transfer":
          responses.push(config.message || "Transferindo para um atendente...");
          shouldTransfer = true;
          nextNode = null;
          break;

        case "condition": {
          const isWithinHours = checkBusinessHours(flow.business_hours);
          if (isWithinHours) {
            nextNode = getNextNode(nodes, nextNode.position);
          } else {
            responses.push(flow.offline_message);
            nextNode = null;
          }
          break;
        }

        default:
          nextNode = getNextNode(nodes, nextNode.position);
      }
    }

    // Update conversation state
    const updateData: any = {};
    if (nextNode) {
      updateData.chatbot_current_node = nextNode.id;
      updateData.chatbot_active = true;
    } else if (shouldTransfer) {
      updateData.chatbot_active = false;
      updateData.chatbot_current_node = null;
    }
    if (Object.keys(updateData).length > 0) {
      await supabase.from("conversations").update(updateData).eq("id", conversation_id);
    }

    // Send responses as messages
    for (const body of responses.filter(Boolean)) {
      await supabase.from("messages").insert({
        conversation_id,
        company_id,
        body,
        sender_type: "system",
      });
    }

    return new Response(
      JSON.stringify({ action: shouldTransfer ? "transfer" : "continue", responses }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chatbot-process error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getNextNode(nodes: any[], currentPosition: number) {
  return nodes.find((n: any) => n.position > currentPosition) || null;
}

function checkBusinessHours(businessHours: any): boolean {
  if (!businessHours || Object.keys(businessHours).length === 0) return true;
  const now = new Date();
  const dayMap: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
  const dayKey = dayMap[now.getDay()];
  const dayConfig = businessHours[dayKey];
  if (!dayConfig?.enabled) return false;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return currentTime >= dayConfig.start && currentTime <= dayConfig.end;
}

async function callAI(flow: any, nodeConfig: any, userMessage: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return "Desculpe, o serviço de IA não está configurado.";

  const systemPrompt = [flow.ai_instructions, nodeConfig.context].filter(Boolean).join("\n\n");

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt || "Você é um assistente útil de atendimento ao cliente. Seja educado e objetivo." },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI error:", response.status, await response.text());
      return "Desculpe, não consegui processar sua mensagem. Um atendente irá ajudá-lo em breve.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Não consegui gerar uma resposta.";
  } catch (e) {
    console.error("AI call failed:", e);
    return "Desculpe, houve um erro ao processar sua mensagem.";
  }
}
