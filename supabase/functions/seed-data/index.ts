import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const companyId = "a0000000-0000-0000-0000-000000000001";

    const users = [
      { email: "davi@allin.com", password: "123456", name: "Davi César", role: "admin" },
      { email: "ana@allin.com", password: "123456", name: "Ana Silva", role: "supervisor" },
      { email: "carlos@allin.com", password: "123456", name: "Carlos Rocha", role: "agent" },
      { email: "felipe@allin.com", password: "123456", name: "Felipe Moura", role: "agent" },
    ];

    const createdUsers: { id: string; name: string; email: string }[] = [];

    for (const u of users) {
      // Check if user already exists
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing?.users?.find((eu: any) => eu.email === u.email);
      if (found) {
        createdUsers.push({ id: found.id, name: u.name, email: u.email });
        continue;
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { company_id: companyId, name: u.name, role: u.role },
      });
      if (error) throw error;
      createdUsers.push({ id: data.user.id, name: u.name, email: u.email });
    }

    // Seed contacts
    const contactIds = [
      "c0000000-0000-0000-0000-000000000001",
      "c0000000-0000-0000-0000-000000000002",
      "c0000000-0000-0000-0000-000000000003",
      "c0000000-0000-0000-0000-000000000004",
      "c0000000-0000-0000-0000-000000000005",
      "c0000000-0000-0000-0000-000000000006",
    ];

    const { error: contactErr } = await supabaseAdmin.from("contacts").upsert([
      { id: contactIds[0], company_id: companyId, name: "Maria Lima", phone: "(11) 99999-1234", email: "maria@empresa.com", source: "WhatsApp", tags: ["VIP", "Enterprise"], responsible_user_id: createdUsers[1]?.id, notes: "Cliente premium, atendimento prioritário.", last_contact_at: "2025-02-10T10:00:00Z" },
      { id: contactIds[1], company_id: companyId, name: "André Santos", phone: "(21) 98888-5678", email: "andre@startup.io", source: "Google Ads", tags: ["Lead"], responsible_user_id: createdUsers[2]?.id, notes: "", last_contact_at: "2025-02-08T09:00:00Z" },
      { id: contactIds[2], company_id: companyId, name: "Carla Ribeiro", phone: "(31) 97777-9012", email: "carla@design.com", source: "Indicação", tags: ["Cliente"], responsible_user_id: createdUsers[1]?.id, notes: "Projeto de design finalizado.", last_contact_at: "2025-01-28T14:00:00Z" },
      { id: contactIds[3], company_id: companyId, name: "João Pereira", phone: "(41) 96666-3456", email: "joao@corp.com.br", source: "WhatsApp", tags: ["Enterprise", "Prioritário"], responsible_user_id: createdUsers[3]?.id, notes: "Aguardando proposta de expansão.", last_contact_at: "2025-02-11T07:00:00Z" },
      { id: contactIds[4], company_id: companyId, name: "Fernanda Martins", phone: "(51) 95555-7890", email: "fernanda@loja.com", source: "Instagram", tags: ["Cliente"], responsible_user_id: createdUsers[1]?.id, notes: "Solicitou cancelamento de assinatura.", last_contact_at: "2025-02-05T06:00:00Z" },
      { id: contactIds[5], company_id: companyId, name: "Lucas Borges", phone: "(61) 94444-2345", email: "lucas@dev.com", source: "Webchat", tags: ["Lead", "Desenvolvedor"], responsible_user_id: createdUsers[2]?.id, notes: "Interessado na integração API.", last_contact_at: "2025-02-01T15:00:00Z" },
    ], { onConflict: "id" });
    if (contactErr) throw contactErr;

    // Seed conversations
    const convIds = [
      "d0000000-0000-0000-0000-000000000001",
      "d0000000-0000-0000-0000-000000000002",
      "d0000000-0000-0000-0000-000000000003",
      "d0000000-0000-0000-0000-000000000004",
    ];

    const { error: convErr } = await supabaseAdmin.from("conversations").upsert([
      { id: convIds[0], company_id: companyId, contact_id: contactIds[0], assigned_user_id: createdUsers[1]?.id, status: "open", channel: "whatsapp", last_message_at: "2025-02-11T10:40:00Z" },
      { id: convIds[1], company_id: companyId, contact_id: contactIds[1], assigned_user_id: null, status: "open", channel: "webchat", last_message_at: "2025-02-11T09:16:00Z" },
      { id: convIds[2], company_id: companyId, contact_id: contactIds[2], assigned_user_id: createdUsers[1]?.id, status: "closed", channel: "instagram", last_message_at: "2025-02-10T15:00:00Z" },
      { id: convIds[3], company_id: companyId, contact_id: contactIds[3], assigned_user_id: createdUsers[3]?.id, status: "pending", channel: "whatsapp", last_message_at: "2025-02-11T07:02:00Z" },
    ], { onConflict: "id" });
    if (convErr) throw convErr;

    // Seed messages
    const { error: msgErr } = await supabaseAdmin.from("messages").upsert([
      { id: "e0000001-0000-0000-0000-000000000001", company_id: companyId, conversation_id: convIds[0], sender_type: "user", body: "Olá, preciso de ajuda com meu pedido #4521", created_at: "2025-02-11T10:30:00Z" },
      { id: "e0000001-0000-0000-0000-000000000002", company_id: companyId, conversation_id: convIds[0], sender_type: "agent", sender_id: createdUsers[1]?.id, body: "Olá Maria! Claro, vou verificar o status do seu pedido agora mesmo.", created_at: "2025-02-11T10:31:00Z" },
      { id: "e0000001-0000-0000-0000-000000000003", company_id: companyId, conversation_id: convIds[0], sender_type: "agent", sender_id: createdUsers[1]?.id, body: "O pedido #4521 está em processamento e deve ser enviado até amanhã.", created_at: "2025-02-11T10:32:00Z" },
      { id: "e0000001-0000-0000-0000-000000000004", company_id: companyId, conversation_id: convIds[0], sender_type: "user", body: "Ah que bom! E vocês enviam por qual transportadora?", created_at: "2025-02-11T10:35:00Z" },
      { id: "e0000001-0000-0000-0000-000000000005", company_id: companyId, conversation_id: convIds[1], sender_type: "user", body: "Boa tarde! Vocês têm plano empresarial?", created_at: "2025-02-11T09:15:00Z" },
      { id: "e0000001-0000-0000-0000-000000000006", company_id: companyId, conversation_id: convIds[1], sender_type: "user", body: "Estou buscando uma solução para minha equipe de 15 pessoas.", created_at: "2025-02-11T09:16:00Z" },
      { id: "e0000001-0000-0000-0000-000000000007", company_id: companyId, conversation_id: convIds[3], sender_type: "user", body: "Bom dia, gostaria de saber se houve avanço na proposta.", created_at: "2025-02-11T07:00:00Z" },
      { id: "e0000001-0000-0000-0000-000000000008", company_id: companyId, conversation_id: convIds[3], sender_type: "user", body: "Precisamos de uma resposta até sexta-feira.", created_at: "2025-02-11T07:02:00Z" },
    ], { onConflict: "id" });
    if (msgErr) throw msgErr;

    return new Response(JSON.stringify({ success: true, users: createdUsers.map(u => ({ name: u.name, email: u.email })) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
