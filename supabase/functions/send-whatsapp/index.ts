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

    // Verify user token
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

    const { conversation_id, body: messageBody } = await req.json();

    if (!conversation_id || !messageBody) {
      return new Response(
        JSON.stringify({ error: "conversation_id and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get conversation with contact info
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("*, contact:contacts!conversations_contact_id_fkey(phone)")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phone = conv.contact?.phone;
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Contact has no phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get active integration for this channel
    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("company_id", conv.company_id)
      .eq("channel", conv.channel)
      .eq("status", "connected")
      .maybeSingle();

    if (!integration) {
      // No integration configured — message saved to DB but not delivered externally
      return new Response(
        JSON.stringify({ ok: true, delivered: false, reason: "No active integration found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const config = integration.config as Record<string, any>;
    const provider = integration.provider;
    let delivered = false;
    let externalError: string | null = null;

    try {
      if (provider === "meta" || provider === "Meta Cloud API") {
        // Meta Cloud API
        const accessToken = config.access_token || config.token;
        const phoneNumberId = config.phone_number_id;
        if (!accessToken || !phoneNumberId) throw new Error("Meta config missing access_token or phone_number_id");

        const res = await fetch(
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
              text: { body: messageBody },
            }),
          },
        );
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Meta API error: ${err}`);
        }
        delivered = true;
      } else if (provider === "twilio" || provider === "Twilio") {
        const accountSid = config.account_sid;
        const authToken = config.auth_token;
        const fromNumber = config.from_number;
        if (!accountSid || !authToken || !fromNumber) throw new Error("Twilio config missing credentials");

        const params = new URLSearchParams();
        params.append("To", `whatsapp:${phone.replace(/\D/g, "")}`);
        params.append("From", `whatsapp:${fromNumber}`);
        params.append("Body", messageBody);

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params,
          },
        );
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Twilio API error: ${err}`);
        }
        delivered = true;
      } else if (provider === "360dialog" || provider === "360Dialog") {
        const apiKey = config.api_key;
        if (!apiKey) throw new Error("360dialog config missing api_key");

        const res = await fetch("https://waba.360dialog.io/v1/messages", {
          method: "POST",
          headers: {
            "D360-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phone.replace(/\D/g, ""),
            type: "text",
            text: { body: messageBody },
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`360dialog API error: ${err}`);
        }
        delivered = true;
      } else {
        externalError = `Unknown provider: ${provider}`;
      }
    } catch (e: any) {
      externalError = e.message;
      console.error("External delivery error:", e);
    }

    return new Response(
      JSON.stringify({ ok: true, delivered, error: externalError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("send-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
