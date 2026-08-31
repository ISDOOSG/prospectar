import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/*
  Email Send via Resend API
  Sends personalized first-touch emails to prospects
*/
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { action, contacts, from_name, from_email, subject, reply_to } = await req.json();

    // Read Resend key EXCLUSIVELY from Vault — no env fallback, no settings table
    const { data: RESEND_KEY, error: keyErr } = await supabase.rpc("get_vault_key", { p_service_name: "resend" });
    if (keyErr || !RESEND_KEY) {
      return new Response(JSON.stringify({ error: "Resend API não configurada no Vault. Vá em Configurações → API Keys." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_single") {
      const contact = contacts?.[0];
      if (!contact?.email || !contact?.text) {
        return new Response(JSON.stringify({ error: "email e text são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from_email ? `${from_name || "ProspectAI"} <${from_email}>` : `ProspectAI <onboarding@resend.dev>`,
          to: [contact.email],
          subject: subject || "Olá!",
          html: contact.text.replace(/\n/g, "<br>"),
          reply_to: reply_to || from_email || undefined,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        // Log failed send
        await supabase.from("outreach_messages").insert({
          contact_id: contact.contact_id || null,
          channel: "email",
          direction: "outbound",
          message_text: contact.text,
          status: "failed",
          provider: "resend",
          metadata: {
            email_to: contact.email,
            subject: subject || "Olá!",
            error: data.message || "Erro ao enviar email",
          },
        });
        return new Response(JSON.stringify({ error: data.message || "Erro ao enviar email", details: data }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update contact status
      if (contact.contact_id) {
        await supabase.from("contacts").update({ status: "contatado" }).eq("id", contact.contact_id);
      }

      // Log to outreach_messages
      await supabase.from("outreach_messages").insert({
        contact_id: contact.contact_id || null,
        channel: "email",
        direction: "outbound",
        message_text: contact.text,
        status: "sent",
        provider: "resend",
        provider_message_id: data.id ?? null,
        metadata: {
          email_to: contact.email,
          subject: subject || "Olá!",
          from: from_email || "onboarding@resend.dev",
        },
      });

      return new Response(JSON.stringify({ success: true, email_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_bulk") {
      if (!contacts?.length) {
        return new Response(JSON.stringify({ error: "contacts array required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: any[] = [];
      for (const contact of contacts) {
        if (!contact.email || !contact.text) {
          results.push({ contact_id: contact.contact_id, success: false, error: "Missing email or text" });
          continue;
        }

        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: from_email ? `${from_name || "ProspectAI"} <${from_email}>` : `ProspectAI <onboarding@resend.dev>`,
              to: [contact.email],
              subject: subject || "Olá!",
              html: contact.text.replace(/\n/g, "<br>"),
              reply_to: reply_to || from_email || undefined,
            }),
          });

          const data = await resp.json();
          const success = resp.ok;

          if (success && contact.contact_id) {
            await supabase.from("contacts").update({ status: "contatado" }).eq("id", contact.contact_id);
          }

          results.push({ contact_id: contact.contact_id, success, email_id: data.id, error: success ? null : data.message });
        } catch (err: any) {
          results.push({ contact_id: contact.contact_id, success: false, error: err.message });
        }

        // Rate limit: 2 emails per second
        await new Promise(r => setTimeout(r, 500));
      }

      // Batch log all results to outreach_messages
      const messageRows = results.map((r: any, i: number) => ({
        contact_id: contacts[i]?.contact_id || null,
        channel: "email",
        direction: "outbound",
        message_text: contacts[i]?.text || "",
        status: r.success ? "sent" : "failed",
        provider: "resend",
        provider_message_id: r.email_id ?? null,
        metadata: {
          email_to: contacts[i]?.email,
          subject: subject || "Olá!",
          from: from_email || "onboarding@resend.dev",
          error: r.error ?? null,
        },
      }));
      if (messageRows.length > 0) {
        await supabase.from("outreach_messages").insert(messageRows);
      }

      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return new Response(JSON.stringify({ sent, failed, total: contacts.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[email-send] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
