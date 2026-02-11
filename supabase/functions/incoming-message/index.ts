import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

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

  // ── Auth: X-WEBHOOK-SECRET ───────────────────────────
  const secret = req.headers.get("x-webhook-secret");
  const expected = Deno.env.get("WEBHOOK_SECRET");

  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      company_id,
      channel,
      external_message_id,
      from_phone,
      from_name,
      body: messageBody,
      media_url,
      timestamp,
    } = body;

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

    if (!messageBody || typeof messageBody !== "string") {
      return new Response(
        JSON.stringify({ error: "body is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
      .select("id")
      .eq("company_id", company_id)
      .eq("phone", from_phone)
      .maybeSingle();

    if (!contact) {
      // Try normalized match
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, phone")
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
          })
          .select("id")
          .single();

        if (contactErr) throw contactErr;
        contact = newContact;
      }
    }

    // ── Find or create open conversation ───────────────
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("company_id", company_id)
      .eq("contact_id", contact.id)
      .eq("channel", channel)
      .eq("status", "open")
      .maybeSingle();

    if (!conversation) {
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

    // ── Insert message ─────────────────────────────────
    const { error: msgErr } = await supabase.from("messages").insert({
      company_id,
      conversation_id: conversation.id,
      sender_type: "user",
      sender_id: null,
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
