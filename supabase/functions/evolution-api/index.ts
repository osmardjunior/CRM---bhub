import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, api_url, api_key, instance_name, integration_id } = body;

    if (!api_url || !api_key) {
      return new Response(
        JSON.stringify({ error: "api_url and api_key are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize URL - remove trailing slash
    const baseUrl = api_url.replace(/\/+$/, "");

    // ── Action: create-instance ──────────────────────
    if (action === "create-instance") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create instance
      const createResp = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: api_key,
        },
        body: JSON.stringify({
          instanceName: instance_name,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error("Evolution create instance error:", errText);
        
        // If instance already exists, try to get QR code instead
        if (createResp.status === 403 || createResp.status === 409 || errText.includes("already")) {
          console.log("Instance may already exist, trying to connect...");
          const connectResp = await fetch(
            `${baseUrl}/instance/connect/${instance_name}`,
            {
              method: "GET",
              headers: { apikey: api_key },
            }
          );
          if (connectResp.ok) {
            const connectData = await connectResp.json();
            return new Response(
              JSON.stringify({
                success: true,
                qrcode: connectData.base64 || connectData.qrcode?.base64 || null,
                pairingCode: connectData.pairingCode || null,
                instance: { instanceName: instance_name, status: "created" },
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          return new Response(
            JSON.stringify({ error: `Instance error: ${errText}` }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            error: `Failed to create instance [${createResp.status}]: ${errText}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const createData = await createResp.json();
      console.log("Instance created:", JSON.stringify(createData));

      // Extract QR code from response
      const qrcode =
        createData.qrcode?.base64 ||
        createData.base64 ||
        createData.qr?.base64 ||
        null;

      return new Response(
        JSON.stringify({
          success: true,
          qrcode,
          pairingCode: createData.qrcode?.pairingCode || createData.pairingCode || null,
          instance: createData.instance || {
            instanceName: instance_name,
            status: "created",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: get-qrcode ──────────────────────────
    if (action === "get-qrcode") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const qrResp = await fetch(
        `${baseUrl}/instance/connect/${instance_name}`,
        {
          method: "GET",
          headers: { apikey: api_key },
        }
      );

      if (!qrResp.ok) {
        const errText = await qrResp.text();
        return new Response(
          JSON.stringify({
            error: `Failed to get QR [${qrResp.status}]: ${errText}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const qrData = await qrResp.json();
      return new Response(
        JSON.stringify({
          success: true,
          qrcode: qrData.base64 || qrData.qrcode?.base64 || null,
          pairingCode: qrData.pairingCode || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: check-status ────────────────────────
    if (action === "check-status") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const statusResp = await fetch(
        `${baseUrl}/instance/connectionState/${instance_name}`,
        {
          method: "GET",
          headers: { apikey: api_key },
        }
      );

      if (!statusResp.ok) {
        const errText = await statusResp.text();
        return new Response(
          JSON.stringify({
            error: `Failed to check status [${statusResp.status}]: ${errText}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const statusData = await statusResp.json();
      const state = statusData.instance?.state || statusData.state || "unknown";
      const isConnected = state === "open" || state === "connected";

      // If connected and we have an integration_id, update its status
      if (isConnected && integration_id) {
        await supabase
          .from("integrations")
          .update({ status: "connected" })
          .eq("id", integration_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          state,
          connected: isConnected,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: set-webhook ─────────────────────────
    if (action === "set-webhook") {
      if (!instance_name) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/incoming-message`;

      const whResp = await fetch(
        `${baseUrl}/webhook/set/${instance_name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: api_key,
          },
          body: JSON.stringify({
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED",
            ],
          }),
        }
      );

      const whData = await whResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          success: whResp.ok,
          webhook: whData,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid action. Use: create-instance, get-qrcode, check-status, set-webhook",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Evolution API error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
