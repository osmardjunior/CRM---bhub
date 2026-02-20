import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { conversationId, messages, metadata } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        stream: true,
        system: `You are a WhatsApp CRM assistant. Analyze conversations and return JSON with this exact schema:
{
  "next_funnel_stage": "stage name or null",
  "suggested_tags": ["tag1", "tag2"],
  "trigger_dialog": "dialog name or null",
  "urgency_level": "low|medium|high",
  "sentiment": "positive|neutral|negative",
  "summary": "2-sentence summary in Portuguese",
  "recommended_action": "specific next action in Portuguese"
}
Always respond with valid JSON only. No markdown, no explanation.`,
        messages: [{
          role: "user",
          content: `Analyze this WhatsApp conversation:

Messages (last 10):
${(messages || []).map((m: any) => `[${m.direction === 'inbound' ? 'CLIENT' : 'AGENT'}] ${m.content || m.body}`).join("\n")}

Current chat state:
- Funnel stage: ${metadata?.currentStage ?? "none"}
- Tags: ${metadata?.tags?.join(", ") ?? "none"}
- Status: ${metadata?.attendanceStatus ?? "open"}
- Time in current status: ${metadata?.timeInStatus ?? "unknown"} minutes
- Assigned agent: ${metadata?.assignedAgent ?? "unassigned"}`
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track usage asynchronously (best-effort)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's company_id
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.company_id) {
      serviceClient.from("ai_interactions").insert({
        conversation_id: conversationId,
        user_id: userId,
        interaction_type: "chat-assist",
        model_used: "claude-sonnet-4",
        company_id: profile.company_id,
      }).then(() => {});
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("ai-chat-assist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
