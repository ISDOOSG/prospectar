// Validate (test against provider) + save project API key in vault. Admin only.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_SERVICES = new Set([
  "apollo",
  "apify",
  "crustdata",
  "tavily",
  "pdl",
  "evolution",
  "resend",
]);

async function validateKey(service: string, key: string, extra: Record<string, any> = {}): Promise<{ valid: boolean; message: string; warning?: string }> {
  try {
    switch (service) {
      case "apollo": {
        const r = await fetch("https://api.apollo.io/api/v1/auth/health", {
          headers: { "x-api-key": key },
        });
        const d = await r.json().catch(() => ({}));
        if (d?.is_logged_in !== true) {
          return { valid: false, message: "Apollo: chave inválida ou sem permissão" };
        }
        // A chave é válida, mas o plano FREE bloqueia a API de busca/enriquecimento.
        // Aceitamos a chave (workspace fica "ready"), mas avisamos que NÃO haverá resultados.
        const probe = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key },
          body: JSON.stringify({ per_page: 1, page: 1 }),
        });
        if (!probe.ok) {
          const pb = await probe.json().catch(() => ({} as any));
          if (probe.status === 403 || pb?.error_code === "API_INACCESSIBLE") {
            return {
              valid: true,
              message: "Conectado ao Apollo.io (plano FREE)",
              warning: "Seu plano Apollo é FREE: a API de busca está bloqueada, então buscas pelo Apollo retornarão ZERO resultados. Faça upgrade em app.apollo.io ou use outras fontes (Apify, PDL, Tavily, Google Maps).",
            };
          }
        }
        return { valid: true, message: "Conectado ao Apollo.io" };
      }
      case "apify": {
        const r = await fetch("https://api.apify.com/v2/acts?limit=1", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return r.ok
          ? { valid: true, message: "Conectado ao Apify" }
          : { valid: false, message: `Apify: ${r.status}` };
      }
      case "crustdata": {
        const r = await fetch("https://api.crustdata.com/screener/person/search", {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-api-version": "2025-11-01" },
          body: JSON.stringify({ filters: { field: "basic_profile.headline", type: "(.)", value: "test" }, limit: 1 }),
        });
        return r.ok
          ? { valid: true, message: "Conectado ao CrustData" }
          : { valid: false, message: `CrustData: ${r.status}` };
      }
      case "tavily": {
        const r = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key, query: "test", max_results: 1 }),
        });
        return r.ok
          ? { valid: true, message: "Conectado ao Tavily" }
          : { valid: false, message: `Tavily: ${r.status}` };
      }
      case "pdl": {
        const r = await fetch("https://api.peopledatalabs.com/v5/person/search?size=1&query=" + encodeURIComponent('{"query":{"match_all":{}}}'), {
          headers: { "X-Api-Key": key },
        });
        return r.ok || r.status === 402
          ? { valid: true, message: "Conectado ao People Data Labs" }
          : { valid: false, message: `PDL: ${r.status}` };
      }
      case "resend": {
        const r = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return r.ok
          ? { valid: true, message: "Conectado ao Resend" }
          : { valid: false, message: `Resend: ${r.status}` };
      }
      case "evolution": {
        // Evolution requires URL too — test via /instance/fetchInstances
        const url = (extra.evolution_api_url || "").replace(/\/$/, "");
        if (!url) return { valid: false, message: "URL da Evolution é obrigatória para validar" };
        const r = await fetch(`${url}/instance/fetchInstances`, {
          headers: { apikey: key },
        });
        return r.ok
          ? { valid: true, message: "Conectado à Evolution API" }
          : { valid: false, message: `Evolution: ${r.status}` };
      }
      default:
        return { valid: false, message: "Serviço desconhecido" };
    }
  } catch (e) {
    return { valid: false, message: `Erro ao validar: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { service_name, api_key, label, validate_only, evolution_api_url } = body;

    if (!service_name || !ALLOWED_SERVICES.has(service_name)) {
      return new Response(JSON.stringify({ error: "service_name inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!api_key || typeof api_key !== "string" || api_key.trim().length < 4) {
      return new Response(JSON.stringify({ error: "api_key obrigatória (mínimo 4 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate against provider
    const validation = await validateKey(service_name, api_key.trim(), { evolution_api_url });

    if (validate_only) {
      return new Response(JSON.stringify(validation), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.message, valid: false }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Save to vault via SECURITY DEFINER RPC (admin check inside)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { error } = await supabase.rpc("set_project_secret", {
      p_service_name: service_name,
      p_secret: api_key.trim(),
      p_label: label || null,
      p_validation_status: "valid",
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.message.includes("administradores") ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, valid: true, message: validation.message, warning: validation.warning || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
