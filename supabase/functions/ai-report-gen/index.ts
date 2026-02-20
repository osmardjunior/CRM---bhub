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

    const { periodStart, periodEnd, metrics } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        stream: true,
        system: `You are a senior CRM analytics expert.
Generate executive reports in Brazilian Portuguese.
Format output as structured Markdown.
Focus on actionable insights, not just data description.
Always include: what happened, why it matters, what to do next.`,
        messages: [{
          role: "user",
          content: `Generate a complete executive report for this CRM data.

Period: ${periodStart} to ${periodEnd}

Metrics data:
${JSON.stringify(metrics, null, 2)}

Required sections:
# Resumo Executivo
(3 bullet points with the most critical insights)

## Performance de Atendimento
(response times, resolution rates, volume trends)

## Análise de Funis e Conversões
(conversion rates per stage, bottlenecks)

## Performance por Agente
(rankings, highlights, areas for improvement)

## Análise de NPS e Satisfação
(score trends, qualitative patterns)

## Gargalos Identificados
(top 3 problems with evidence)

## Recomendações Acionáveis
(exactly 3 specific, measurable actions with expected impact)`
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

    // Save report async
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    // We'll save the report after streaming completes on the client side
    // For now, just track the interaction
    if (profile?.company_id) {
      serviceClient.from("ai_interactions").insert({
        user_id: userId,
        interaction_type: "report",
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
    console.error("ai-report-gen error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
