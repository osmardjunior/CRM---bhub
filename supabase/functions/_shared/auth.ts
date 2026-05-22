/**
 * Shared auth helpers for Supabase Edge Functions.
 *
 * Used by: chatbot-process, execute-campaign, send-whatsapp
 *
 * Two auth modes:
 *  1. User JWT — verified via supabase.auth.getUser()
 *  2. Service-role key — for internal function-to-function calls
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  isServiceRole: boolean;
  error?: string;
}

/**
 * Validate the Authorization header from a request.
 *
 * Returns { authenticated: true, isServiceRole } on success.
 * Returns { authenticated: false, error } on failure.
 *
 * Service-role calls (from other edge functions invoking via supabase.functions.invoke)
 * are allowed when the Bearer token matches SUPABASE_SERVICE_ROLE_KEY.
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { authenticated: false, isServiceRole: false, error: "Missing authorization header" };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Service-role call (internal function-to-function)
  if (serviceRoleKey.length > 0 && token === serviceRoleKey) {
    return { authenticated: true, isServiceRole: true };
  }

  // User JWT verification
  try {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return { authenticated: false, isServiceRole: false, error: "Invalid or expired token" };
    }
    return { authenticated: true, isServiceRole: false, userId: user.id };
  } catch {
    return { authenticated: false, isServiceRole: false, error: "Auth verification failed" };
  }
}

/**
 * Convenience: returns a 401 Response with CORS headers.
 */
export function unauthorizedResponse(
  corsHeaders: Record<string, string>,
  message = "Unauthorized",
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
