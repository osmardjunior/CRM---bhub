import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Always return 200 so the JS client puts the body in `data` (not `error`)
function respond(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company_name, user_name, email, password } = await req.json();

    if (!company_name || !user_name || !email || !password) {
      return respond({ error: "Todos os campos são obrigatórios" });
    }

    if (password.length < 6) {
      return respond({ error: "Senha deve ter pelo menos 6 caracteres" });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Create company
    const slug =
      company_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      crypto.randomUUID().slice(0, 8);

    const { data: company, error: companyErr } = await adminClient
      .from("companies")
      .insert({ name: company_name, slug, plan: "free" })
      .select("id")
      .single();

    if (companyErr) {
      console.error("Company creation error:", companyErr);
      return respond({ error: "Erro ao criar empresa: " + companyErr.message });
    }

    const companyId = company.id;

    // 2. Create auth user — duplicate email naturally caught here
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: user_name,
        company_id: companyId,
        role: "admin",
      },
    });

    if (authErr) {
      await adminClient.from("companies").delete().eq("id", companyId);
      const msg = authErr.message?.includes("already registered")
        ? "Este email já está cadastrado"
        : "Erro ao criar usuário: " + authErr.message;
      return respond({ error: msg });
    }

    // Profile + user_roles are auto-created by the DB trigger handle_new_user()
    // But the trigger can fail silently — ensure user_roles is always set explicitly.
    if (authData.user) {
      await adminClient
        .from("user_roles")
        .upsert({ user_id: authData.user.id, role: "admin" }, { onConflict: "user_id,role" });

      // Also ensure profile has correct company_id (in case trigger ran before company insert)
      await adminClient
        .from("profiles")
        .upsert({ id: authData.user.id, company_id: companyId, name: user_name, email }, { onConflict: "id" });
    }

    // 3. Create default department + project
    const { data: dept } = await adminClient
      .from("departments")
      .insert({ company_id: companyId, name: "Geral" })
      .select("id")
      .single();

    if (dept) {
      const { data: project } = await adminClient
        .from("projects")
        .insert({ company_id: companyId, department_id: dept.id, name: "Principal", active: true })
        .select("id")
        .single();

      if (project && authData.user) {
        await adminClient
          .from("user_projects")
          .insert({ user_id: authData.user.id, project_id: project.id, active: true });
      }
    }

    // 4. Create default pipeline with stages
    const { data: pipeline } = await adminClient
      .from("pipelines")
      .insert({ company_id: companyId, name: "Pipeline Principal", is_default: true })
      .select("id")
      .single();

    if (pipeline) {
      await adminClient.from("pipeline_stages").insert([
        { pipeline_id: pipeline.id, label: "Leads", position: 0, color: "#F59E0B" },
        { pipeline_id: pipeline.id, label: "Qualificação", position: 1, color: "#3B82F6" },
        { pipeline_id: pipeline.id, label: "Negociação", position: 2, color: "#8B5CF6" },
        { pipeline_id: pipeline.id, label: "Fechado", position: 3, color: "#10B981" },
      ]);
    }

    return respond({
      success: true,
      company_id: companyId,
      user_id: authData.user?.id,
      message: "Empresa criada com sucesso!",
    });
  } catch (err) {
    console.error("register-company error:", err);
    return respond({ error: "Erro interno do servidor. Tente novamente." });
  }
});
