import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get conversation details
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("*, contact:contacts!conversations_contact_id_fkey(id, phone, name)")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if survey already sent for this conversation
    const { data: existing } = await supabase
      .from("satisfaction_surveys")
      .select("id")
      .eq("conversation_id", conversation_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, already_sent: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create survey record
    const { data: survey, error: surveyErr } = await supabase
      .from("satisfaction_surveys")
      .insert({
        company_id: conv.company_id,
        conversation_id: conversation_id,
        contact_id: conv.contact.id,
        assigned_user_id: conv.assigned_user_id,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (surveyErr) throw surveyErr;

    // Try to send survey message via WhatsApp
    const phone = conv.contact?.phone;
    if (phone) {
      const surveyMessage =
        `Olá ${conv.contact.name}! 😊\n\n` +
        `Como foi seu atendimento? Avalie de 1 a 5:\n` +
        `1 ⭐ - Muito ruim\n` +
        `2 ⭐⭐ - Ruim\n` +
        `3 ⭐⭐⭐ - Regular\n` +
        `4 ⭐⭐⭐⭐ - Bom\n` +
        `5 ⭐⭐⭐⭐⭐ - Excelente\n\n` +
        `Responda apenas com o número.`;

      // Insert survey message into DB
      await supabase.from("messages").insert({
        company_id: conv.company_id,
        conversation_id: conversation_id,
        sender_type: "system",
        body: surveyMessage,
      });

      // Try to send via external API (best-effort)
      try {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("company_id", conv.company_id)
          .eq("channel", conv.channel)
          .eq("status", "connected")
          .maybeSingle();

        if (integration) {
          const config = integration.config as Record<string, any>;
          const provider = integration.provider;

          if (provider === "meta" || provider === "Meta Cloud API") {
            const accessToken = config.access_token || config.token;
            const phoneNumberId = config.phone_number_id;
            if (accessToken && phoneNumberId) {
              await fetch(
                `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: phone.replace(/\D/g, ""),
                    type: "text",
                    text: { body: surveyMessage },
                  }),
                },
              );
            }
          }
        }
      } catch (e) {
        console.error("Failed to send survey externally:", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, survey_id: survey.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("send-satisfaction-survey error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
