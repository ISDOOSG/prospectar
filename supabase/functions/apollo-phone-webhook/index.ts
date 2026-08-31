import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/*
  Apollo Phone Reveal Webhook
  Apollo sends phone numbers asynchronously to this endpoint
  after a people/match or bulk_match call with reveal_phone_number=true
*/
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const payload = await req.json();
    console.log("[apollo-webhook] Received:", JSON.stringify(payload).slice(0, 500));

    // Apollo sends: { person: { id, phone_numbers: [...] } }
    const person = payload.person || payload;
    const apolloId = person.id;
    const phoneNumbers = person.phone_numbers || [];

    if (!apolloId || phoneNumbers.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No phone data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find contact by apollo_id in custom_fields
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, phone, custom_fields")
      .filter("custom_fields->>apollo_id", "eq", apolloId)
      .limit(1);

    if (contacts && contacts.length > 0) {
      const contact = contacts[0];
      const bestPhone = phoneNumbers.find((p: any) => p.status_cd === "valid_number")
        || phoneNumbers[0];

      if (bestPhone && !contact.phone) {
        const phone = bestPhone.sanitized_number || bestPhone.raw_number || "";
        let normalized = phone.replace(/\D/g, "");
        // Ensure BR format
        if (normalized.length === 10 || normalized.length === 11) normalized = "55" + normalized;

        await supabase.from("contacts").update({
          phone: normalized,
          custom_fields: {
            ...contact.custom_fields,
            apollo_phone_revealed: true,
            all_phones: phoneNumbers.map((p: any) => p.sanitized_number || p.raw_number).filter(Boolean),
          },
        }).eq("id", contact.id);

        console.log(`[apollo-webhook] Updated contact ${contact.id} with phone ${normalized}`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[apollo-webhook] Error:", error);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, // Apollo expects 200 even on errors
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
