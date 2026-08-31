// Health check for fresh remixes — validates schema, RLS, vault state, and integrations.
// Public endpoint (verify_jwt=false) so it can be called from the setup screen even before login.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUIRED_TABLES = [
  "profiles",
  "user_roles",
  "user_onboarding",
  "api_keys_registry",
  "settings",
  "contacts",
  "contact_lists",
  "lead_searches",
  "outreach_messages",
  "project_config",
];

const REQUIRED_FUNCTIONS = [
  "has_role",
  "is_workspace_ready",
  "get_vault_key",
  "set_project_secret",
  "delete_project_secret",
  "list_project_secrets",
  "handle_new_user",
];

const KNOWN_SERVICES = ["apollo", "apify", "crustdata", "tavily", "pdl", "evolution", "resend"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    // 1+2. Schema + functions via single introspection RPC
    const { data: introspection, error: introErr } = await admin.rpc("_remix_introspect");
    if (introErr) throw introErr;
    const intro = introspection as { tables: string[]; functions: string[] };
    const tableNames = new Set(intro.tables ?? []);
    const fnNames = new Set(intro.functions ?? []);

    const missingTables = REQUIRED_TABLES.filter((t) => !tableNames.has(t));
    checks.schema = {
      ok: missingTables.length === 0,
      detail: missingTables.length
        ? `Missing tables: ${missingTables.join(", ")}`
        : `${REQUIRED_TABLES.length} tables present`,
    };

    const missingFns = REQUIRED_FUNCTIONS.filter((f) => !fnNames.has(f));
    checks.functions = {
      ok: missingFns.length === 0,
      detail: missingFns.length
        ? `Missing functions: ${missingFns.join(", ")}`
        : `${REQUIRED_FUNCTIONS.length} functions present`,
    };

    // 3. Workspace ready (Apollo in vault)
    const { data: ready } = await admin.rpc("is_workspace_ready");
    checks.workspace_ready = {
      ok: !!ready,
      detail: ready ? "Apollo key configured in Vault" : "No Apollo key — admin must complete /setup",
    };

    // 4. Has at least one admin user
    const { count: adminCount } = await admin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    checks.has_admin = {
      ok: (adminCount ?? 0) > 0,
      detail: adminCount ? `${adminCount} admin(s) registered` : "No admin yet — first signup will be promoted",
    };

    // 5. Configured integrations breakdown (informational, not blocking)
    const { data: keys } = await admin
      .from("api_keys_registry")
      .select("service_name, is_active, validation_status");
    const configured = (keys ?? [])
      .filter((k: { is_active: boolean }) => k.is_active)
      .map((k: { service_name: string }) => k.service_name);
    const integrations: Record<string, "configured" | "missing"> = {};
    for (const svc of KNOWN_SERVICES) {
      integrations[svc] = configured.includes(svc) ? "configured" : "missing";
    }

    const allCriticalOk =
      checks.schema.ok && checks.functions.ok;
    const remixReady = allCriticalOk; // schema + functions = remix infra ok
    const usable = remixReady && checks.workspace_ready.ok && checks.has_admin.ok;

    return new Response(
      JSON.stringify({
        remix_ready: remixReady,
        usable,
        checks,
        integrations,
        next_step: !checks.has_admin.ok
          ? "Cadastre o primeiro usuário em /auth — ele será promovido a admin automaticamente"
          : !checks.workspace_ready.ok
            ? "Admin: complete o wizard em /setup e configure ao menos a chave Apollo"
            : "Workspace pronto para uso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        remix_ready: false,
        usable: false,
        error: e instanceof Error ? e.message : "unknown",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
