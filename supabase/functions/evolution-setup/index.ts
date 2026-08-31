import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INSTANCE_NAME = "prospecta-ai";

async function evoFetch(baseUrl: string, apiKey: string, path: string, method = "GET", body?: unknown) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const opts: RequestInit = {
    method,
    headers: { apikey: apiKey, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { action, evolution_api_url, evolution_api_key } = await req.json();

    // Get settings from DB or use provided values
    let apiUrl = evolution_api_url;
    let apiKey = evolution_api_key;

    if (!apiUrl || !apiKey) {
      const { data: settings } = await supabase.from("settings").select("evolution_api_url").limit(1).maybeSingle();
      if (settings) {
        apiUrl = apiUrl || settings.evolution_api_url;
      }
      if (!apiKey) {
        const { data: vaultKey } = await supabase.rpc("get_vault_key", { p_service_name: "evolution" });
        apiKey = apiKey || vaultKey || null;
      }
    }

    if (!apiUrl || !apiKey) {
      return new Response(JSON.stringify({
        error: "Evolution API URL e API Key são obrigatórias. Configure em Settings → Integrações → WhatsApp.",
        missing: { url: !apiUrl, key: !apiKey },
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── TEST CONNECTION ──
    if (action === "test") {
      const result = await evoFetch(apiUrl, apiKey, "/instance/fetchInstances");
      return new Response(JSON.stringify({
        valid: result.ok,
        message: result.ok ? "Conectado à Evolution API" : `Erro: ${result.status}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CREATE INSTANCE + CONFIGURE + GET QR ──
    if (action === "setup") {
      // 1. Check if instance already exists
      const existing = await evoFetch(apiUrl, apiKey, `/instance/fetchInstances?instanceName=${INSTANCE_NAME}`);
      let instanceExists = false;

      if (existing.ok && Array.isArray(existing.data)) {
        instanceExists = existing.data.some((i: any) => i.instance?.instanceName === INSTANCE_NAME);
      }

      // 2. Create instance if not exists
      if (!instanceExists) {
        const createResult = await evoFetch(apiUrl, apiKey, "/instance/create", "POST", {
          instanceName: INSTANCE_NAME,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          reject_call: true,
          groupsIgnore: true,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false,
        });

        if (!createResult.ok) {
          return new Response(JSON.stringify({
            error: `Erro ao criar instância: ${JSON.stringify(createResult.data)}`,
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 3. Configure webhook for messages_upsert
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-webhook`;
        await evoFetch(apiUrl, apiKey, `/webhook/set/${INSTANCE_NAME}`, "POST", {
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: true,
            webhookBase64: false,
            events: ["MESSAGES_UPSERT"],
          },
        });

        // 4. Configure settings to ignore groups
        await evoFetch(apiUrl, apiKey, `/settings/set/${INSTANCE_NAME}`, "POST", {
          rejectCall: true,
          groupsIgnore: true,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
        });
      }

      // 5. Save URL/instance to settings (key stays in Vault)
      const { data: settingsRow } = await supabase.from("settings").select("id").limit(1).maybeSingle();
      if (settingsRow) {
        await supabase.from("settings").update({
          evolution_api_url: apiUrl,
          evolution_instance_name: INSTANCE_NAME,
        }).eq("id", settingsRow.id);
      }

      // 6. Get QR Code
      const qrResult = await evoFetch(apiUrl, apiKey, `/instance/connect/${INSTANCE_NAME}`);

      return new Response(JSON.stringify({
        success: true,
        instance_name: INSTANCE_NAME,
        qrcode: qrResult.data?.base64 || qrResult.data?.qrcode?.base64 || null,
        pairingCode: qrResult.data?.pairingCode || null,
        status: qrResult.data?.instance?.state || "connecting",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CHECK CONNECTION STATUS ──
    if (action === "status") {
      const result = await evoFetch(apiUrl, apiKey, `/instance/connectionState/${INSTANCE_NAME}`);
      const state = result.data?.instance?.state || result.data?.state || "unknown";
      const connected = state === "open";

      // Update settings
      const { data: settingsRow } = await supabase.from("settings").select("id").limit(1).single();
      if (settingsRow) {
        await supabase.from("settings").update({ evolution_connected: connected }).eq("id", settingsRow.id);
      }

      return new Response(JSON.stringify({
        connected,
        state,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── REFRESH QR CODE ──
    if (action === "qrcode") {
      const qrResult = await evoFetch(apiUrl, apiKey, `/instance/connect/${INSTANCE_NAME}`);
      return new Response(JSON.stringify({
        qrcode: qrResult.data?.base64 || qrResult.data?.qrcode?.base64 || null,
        pairingCode: qrResult.data?.pairingCode || null,
        status: qrResult.data?.instance?.state || "connecting",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      await evoFetch(apiUrl, apiKey, `/instance/logout/${INSTANCE_NAME}`, "DELETE");

      const { data: settingsRow } = await supabase.from("settings").select("id").limit(1).single();
      if (settingsRow) {
        await supabase.from("settings").update({ evolution_connected: false }).eq("id", settingsRow.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("evolution-setup error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
