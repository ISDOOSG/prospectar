// Read/write non-secret app settings + onboarding state.
// All API keys are managed exclusively via api-keys-* functions + vault.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_FIELDS = [
  "workspace_name",
  "default_country",
  "default_language",
  "default_volume",
  "auto_enrich",
  "onboarding_completed",
  "evolution_api_url",
  "evolution_instance_name",
  "evolution_connected",
  "resend_from_email",
  "resend_from_name",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action, data } = body;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "get") {
      let { data: settings, error } = await admin.from("settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      if (!settings) {
        const { data: created } = await admin.from("settings").insert({ workspace_name: "ProspectAI" }).select().single();
        settings = created;
      }
      return new Response(JSON.stringify({ settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      if (!data || typeof data !== "object") {
        return new Response(JSON.stringify({ error: "data obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updateData: Record<string, unknown> = {};
      for (const field of ALLOWED_FIELDS) {
        if (data[field] !== undefined) updateData[field] = data[field];
      }
      for (const key of Object.keys(data)) {
        if (key.endsWith("_api_key")) {
          return new Response(JSON.stringify({ error: "API keys devem ser gravadas via api-keys-save" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: existing } = await admin.from("settings").select("id").limit(1).maybeSingle();
      if (existing) {
        const { error } = await admin.from("settings").update(updateData).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("settings").insert(updateData);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_onboarding_state") {
      // workspace_ready = Apollo key in vault
      const { data: ready } = await admin.rpc("is_workspace_ready");
      // user_completed = row in user_onboarding for current user
      const { data: userRow } = await admin
        .from("user_onboarding")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      // is_admin
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });

      return new Response(
        JSON.stringify({
          workspace_ready: !!ready,
          user_completed: !!userRow,
          is_admin: !!isAdmin,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "mark_user_onboarded") {
      const { error } = await admin
        .from("user_onboarding")
        .upsert({ user_id: userId, completed_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_user_onboarding") {
      const { error } = await admin.from("user_onboarding").delete().eq("user_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
