import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find pending messages that should be sent
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*, conversations:conversation_id(contact_id, company_id, channel)")
      .is("sent_at", null)
      .is("cancelled_at", null)
      .lte("scheduled_at", new Date().toISOString())
      .limit(20);

    if (fetchError) {
      console.error("Error fetching scheduled messages:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (let i = 0; i < pendingMessages.length; i++) {
      const scheduled = pendingMessages[i];
      // Delay between messages to avoid WhatsApp spam detection (skip first)
      // 3-8s random delay — mimics human pacing and avoids ban triggers
      if (i > 0) await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));

      try {
        const conv = scheduled.conversations as any;
        if (!conv) continue;

        // Insert into messages table
        const { error: insertError } = await supabase.from("messages").insert({
          conversation_id: scheduled.conversation_id,
          company_id: scheduled.company_id,
          sender_type: "agent",
          sender_id: scheduled.created_by,
          body: scheduled.content,
          media_url: scheduled.media_url,
        });

        if (insertError) {
          console.error(`Failed to insert message for scheduled ${scheduled.id}:`, insertError);
          continue;
        }

        // Update last_message_at
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", scheduled.conversation_id);

        // Try to send via WhatsApp
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              apikey: serviceRoleKey,
            },
            body: JSON.stringify({
              conversation_id: scheduled.conversation_id,
              body: scheduled.content,
              ...(scheduled.media_url ? { media_url: scheduled.media_url } : {}),
            }),
          });
        } catch {
          // WhatsApp send is best-effort
        }

        // Mark as sent
        await supabase
          .from("scheduled_messages")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", scheduled.id);

        processed++;
      } catch (err) {
        console.error(`Error processing scheduled message ${scheduled.id}:`, err);
      }
    }

    // Cleanup old rate limit logs (older than 25 hours) to prevent table bloat
    try {
      await supabase
        .from("send_rate_log")
        .delete()
        .lt("sent_at", new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString());
    } catch (cleanupErr) {
      console.warn("Rate log cleanup failed (non-critical):", cleanupErr);
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
