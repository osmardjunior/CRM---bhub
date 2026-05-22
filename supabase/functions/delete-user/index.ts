import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!roleData || roleData.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Apenas admins podem excluir usuários" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get caller company
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("company_id")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerProfile?.company_id) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { user_id, hard_delete } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent admin from deleting themselves
    if (user_id === caller.id) {
      return new Response(
        JSON.stringify({
          error: "Você não pode excluir sua própria conta",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Ensure target user belongs to the same company
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("id", user_id)
      .maybeSingle();

    if (
      !targetProfile ||
      targetProfile.company_id !== callerProfile.company_id
    ) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado nesta empresa" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (hard_delete) {
      // Nullify all FK references to this profile before deleting.
      // Each operation is wrapped in try/catch so missing tables/columns
      // don't break the whole flow.
      const nullifyOps = [
        () =>
          adminClient
            .from("conversations")
            .update({ assigned_user_id: null })
            .eq("assigned_user_id", user_id),
        () =>
          adminClient
            .from("contacts")
            .update({ responsible_user_id: null })
            .eq("responsible_user_id", user_id),
        () =>
          adminClient
            .from("messages")
            .update({ sender_id: null })
            .eq("sender_id", user_id),
        () =>
          adminClient
            .from("deals")
            .update({ assigned_user_id: null })
            .eq("assigned_user_id", user_id),
        () =>
          adminClient
            .from("tasks")
            .update({ assigned_user_id: null })
            .eq("assigned_user_id", user_id),
        () =>
          adminClient
            .from("satisfaction_surveys")
            .update({ assigned_user_id: null })
            .eq("assigned_user_id", user_id),
      ];

      for (const op of nullifyOps) {
        try {
          await op();
        } catch (_) {
          // Ignore — table/column may not exist
        }
      }

      // Delete from junction/auxiliary tables (ignore errors)
      const deleteOps = [
        () =>
          adminClient
            .from("profile_departments")
            .delete()
            .eq("profile_id", user_id),
        () =>
          adminClient
            .from("user_projects")
            .delete()
            .eq("user_id", user_id),
        () =>
          adminClient
            .from("user_roles")
            .delete()
            .eq("user_id", user_id),
      ];

      for (const op of deleteOps) {
        try {
          await op();
        } catch (_) {
          // Ignore — table may not exist
        }
      }

      // Now safe to delete auth user (cascades to profiles)
      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      // Soft delete: deactivate (blocks login without losing history)
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ is_active: false })
        .eq("id", user_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
