// List configured project API keys (masked). Admin only.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KNOWN_SERVICES = [
  "apollo",
  "apify",
  "crustdata",
  "tavily",
  "pdl",
  "evolution",
  "resend",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // list_project_secrets enforces admin role internally via RAISE EXCEPTION
    const { data, error } = await supabase.rpc("list_project_secrets");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.message.includes("administradores") ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build status map: every known service shows configured=true/false
    const byService = new Map<string, any>();
    for (const row of data || []) byService.set(row.service_name, row);

    const keys: Record<string, any> = {};
    for (const svc of KNOWN_SERVICES) {
      const row = byService.get(svc);
      keys[svc] = {
        service_name: svc,
        configured: !!row,
        masked_value: row?.masked_value || "",
        validation_status: row?.validation_status || "unknown",
        last_validated_at: row?.last_validated_at || null,
        label: row?.label || null,
        updated_at: row?.updated_at || null,
      };
    }

    return new Response(JSON.stringify({ keys }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
