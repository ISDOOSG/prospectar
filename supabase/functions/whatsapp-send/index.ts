import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ContactPayload = {
  contact_id?: string;
  phone?: string;
  text?: string;
};

type DbContact = {
  id: string;
  phone: string | null;
  custom_fields: Record<string, any> | null;
};

type PreparedContact = {
  contact_id?: string;
  text: string;
  resolvedPhone: string | null;
  phoneSource: string | null;
  candidates: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const action = body?.action;
    const contacts = Array.isArray(body?.contacts) ? body.contacts as ContactPayload[] : [];

    // Read non-secret settings (URL, instance, connected flag) from settings table.
    // API key comes EXCLUSIVELY from Vault.
    const { data: settings } = await supabase.from("settings").select("evolution_api_url, evolution_instance_name, evolution_connected").limit(1).maybeSingle();
    const { data: apiKey } = await supabase.rpc("get_vault_key", { p_service_name: "evolution" });

    if (!settings?.evolution_api_url || !apiKey) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada. Vá em Configurações → WhatsApp." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!settings.evolution_connected) {
      return new Response(JSON.stringify({ error: "WhatsApp não está conectado. Escaneie o QR Code nas Configurações." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = settings.evolution_api_url.replace(/\/$/, "");
    const instanceName = settings.evolution_instance_name || "prospecta-ai";

    if (action === "resolve_contacts") {
      const prepared = await prepareContacts(supabase, contacts);
      return new Response(JSON.stringify({
        results: prepared.map((item, index) => ({
          contact_id: item.contact_id || null,
          input_phone: contacts[index]?.phone || null,
          resolved_phone: item.resolvedPhone,
          phone_source: item.phoneSource,
          candidates: item.candidates,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_single") {
      const [prepared] = await prepareContacts(supabase, contacts.slice(0, 1));
      if (!prepared?.text) {
        return new Response(JSON.stringify({ error: "phone e text são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!prepared.resolvedPhone) {
        return new Response(JSON.stringify({
          error: "Nenhum número válido para envio foi encontrado neste contato.",
          phone_source: prepared.phoneSource,
          candidates: prepared.candidates,
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resp = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: prepared.resolvedPhone, text: prepared.text }),
      });

      const data = await safeJson(resp);

      // Log to outreach_messages (success or failure)
      await supabase.from("outreach_messages").insert({
        contact_id: prepared.contact_id || null,
        channel: "whatsapp",
        direction: "outbound",
        message_text: prepared.text,
        status: resp.ok ? "sent" : "failed",
        provider: "evolution",
        provider_message_id: data?.key?.id ?? null,
        metadata: {
          resolved_phone: prepared.resolvedPhone,
          phone_source: prepared.phoneSource,
          instance: instanceName,
          error: resp.ok ? null : formatEvolutionError(data, prepared.resolvedPhone!),
        },
      });

      if (!resp.ok) {
        return new Response(JSON.stringify({
          error: formatEvolutionError(data, prepared.resolvedPhone),
          resolved_phone: prepared.resolvedPhone,
          phone_source: prepared.phoneSource,
          details: data,
        }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (prepared.contact_id) {
        await supabase.from("contacts").update({ status: "contatado" }).eq("id", prepared.contact_id);
      }

      return new Response(JSON.stringify({
        success: true,
        message_id: data?.key?.id ?? null,
        resolved_phone: prepared.resolvedPhone,
        phone_source: prepared.phoneSource,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_bulk") {
      if (contacts.length === 0) {
        return new Response(JSON.stringify({ error: "contacts array is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const preparedContacts = await prepareContacts(supabase, contacts);
      const results: Array<Record<string, unknown>> = [];
      const delayMs = 3000 + Math.random() * 5000;

      for (let i = 0; i < preparedContacts.length; i++) {
        const prepared = preparedContacts[i];

        if (!prepared.text) {
          results.push({
            contact_id: prepared.contact_id,
            success: false,
            message_id: null,
            error: "Missing text",
            resolved_phone: prepared.resolvedPhone,
            phone_source: prepared.phoneSource,
          });
          continue;
        }

        if (!prepared.resolvedPhone) {
          results.push({
            contact_id: prepared.contact_id,
            success: false,
            message_id: null,
            error: "Nenhum número válido para envio foi encontrado neste contato.",
            resolved_phone: null,
            phone_source: prepared.phoneSource,
            candidates: prepared.candidates,
          });
          continue;
        }

        try {
          const resp = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ number: prepared.resolvedPhone, text: prepared.text }),
          });

          const data = await safeJson(resp);
          const success = resp.ok;

          if (success && prepared.contact_id) {
            await supabase.from("contacts").update({ status: "contatado" }).eq("id", prepared.contact_id);
          }

          results.push({
            contact_id: prepared.contact_id,
            success,
            message_id: data?.key?.id ?? null,
            resolved_phone: prepared.resolvedPhone,
            phone_source: prepared.phoneSource,
            error: success ? null : formatEvolutionError(data, prepared.resolvedPhone),
          });
        } catch (err) {
          results.push({
            contact_id: prepared.contact_id,
            success: false,
            message_id: null,
            resolved_phone: prepared.resolvedPhone,
            phone_source: prepared.phoneSource,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        if (i < preparedContacts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      // Batch log all results to outreach_messages
      const messageRows = preparedContacts.map((prepared, i) => ({
        contact_id: prepared.contact_id || null,
        channel: "whatsapp",
        direction: "outbound",
        message_text: prepared.text || "",
        status: results[i]?.success ? "sent" : "failed",
        provider: "evolution",
        provider_message_id: (results[i]?.message_id as string) ?? null,
        metadata: {
          resolved_phone: prepared.resolvedPhone,
          phone_source: prepared.phoneSource,
          instance: instanceName,
          error: results[i]?.error ?? null,
        },
      }));
      if (messageRows.length > 0) {
        await supabase.from("outreach_messages").insert(messageRows);
      }

      const sent = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return new Response(JSON.stringify({ sent, failed, total: contacts.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function prepareContacts(supabase: any, contacts: ContactPayload[]): Promise<PreparedContact[]> {
  const contactIds = Array.from(new Set(contacts.map((contact) => contact.contact_id).filter(Boolean))) as string[];
  const contactMap = new Map<string, DbContact>();

  if (contactIds.length > 0) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, phone, custom_fields")
      .in("id", contactIds);

    if (error) {
      throw new Error(`Erro ao carregar contatos para envio: ${error.message}`);
    }

    for (const row of data || []) {
      contactMap.set(row.id, row as DbContact);
    }
  }

  return contacts.map((contact) => {
    const dbContact = contact.contact_id ? contactMap.get(contact.contact_id) : undefined;
    const resolved = resolveBestPhone(contact.phone, dbContact);

    return {
      contact_id: contact.contact_id,
      text: String(contact.text || "").trim(),
      resolvedPhone: resolved.phone,
      phoneSource: resolved.source,
      candidates: resolved.candidates,
    };
  });
}

function resolveBestPhone(inputPhone?: string, dbContact?: DbContact) {
  const entries: Array<{ phone: string; source: string }> = [];
  const seen = new Set<string>();
  const customFields = dbContact?.custom_fields || {};

  const pushCandidate = (value: unknown, source: string) => {
    if (typeof value !== "string") return;
    const normalized = normalizeBrazilPhone(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    entries.push({ phone: normalized, source });
  };

  pushCandidate(customFields.whatsapp, "custom_fields.whatsapp");
  pushCandidate(dbContact?.phone || undefined, "db.phone");
  pushCandidate(inputPhone, "payload.phone");

  if (Array.isArray(customFields.all_phones)) {
    for (const phone of customFields.all_phones) {
      pushCandidate(phone, "custom_fields.all_phones");
    }
  }

  if (typeof customFields.description === "string") {
    for (const phone of extractBrazilPhonesFromText(customFields.description)) {
      pushCandidate(phone, "custom_fields.description");
    }
  }

  const mobileCandidate = entries.find((entry) => isLikelyBrazilMobile(entry.phone));
  const fallbackCandidate = entries[0] || null;
  const chosen = mobileCandidate || fallbackCandidate;

  return {
    phone: chosen?.phone || null,
    source: chosen?.source || null,
    candidates: entries.map((entry) => entry.phone),
  };
}

function extractBrazilPhonesFromText(text: string): string[] {
  const matches = text.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*(?:9\s*)?\d{4}[-.\s]?\d{4}/g) || [];
  return matches;
}

function normalizeBrazilPhone(phone: string): string | null {
  let clean = phone.replace(/\D/g, "");

  if (!clean) return null;

  if (clean.startsWith("5555") && clean.length >= 14) {
    clean = clean.slice(2);
  }

  if (clean.length > 13 && clean.startsWith("55")) {
    clean = clean.slice(0, 13);
  }

  if (clean.length === 10 || clean.length === 11) {
    clean = `55${clean}`;
  }

  if (clean.length !== 12 && clean.length !== 13) {
    return null;
  }

  return clean;
}

function isLikelyBrazilMobile(phone: string): boolean {
  return /^55\d{2}9\d{8}$/.test(phone);
}

function formatEvolutionError(data: any, resolvedPhone: string) {
  const exists = data?.response?.message?.[0]?.exists;
  if (exists === false) {
    return `Número não existe no WhatsApp: ${resolvedPhone}`;
  }

  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;

  return `Erro ao enviar para ${resolvedPhone}`;
}

async function safeJson(resp: Response) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}
