import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/*
  Evolution API Webhook — processes WhatsApp events:
  - messages.upsert (fromMe=false) → inbound message → insert into outreach_messages
  - messages.update → delivery/read status → update outreach_messages status
*/
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const payload = await req.json();
    const event = payload?.event;

    // ── Inbound message ──
    if (event === "messages.upsert") {
      const data = payload?.data;
      const key = data?.key;
      const fromMe = key?.fromMe ?? true;

      // Only process incoming messages (not our own sends)
      if (fromMe) {
        return ok({ received: true, skipped: "fromMe" });
      }

      const remoteJid = key?.remoteJid || "";
      const phone = remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
      const messageText =
        data?.message?.conversation ||
        data?.message?.extendedTextMessage?.text ||
        data?.message?.imageMessage?.caption ||
        "[mídia]";
      const timestamp = data?.messageTimestamp
        ? new Date(Number(data.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      // Try to find the contact by phone number
      let contactId: string | null = null;
      if (phone) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id")
          .or(`phone.eq.${phone},phone.ilike.%${phone.slice(-8)}%`)
          .limit(1);

        if (contacts && contacts.length > 0) {
          contactId = contacts[0].id;
        }
      }

      await supabase.from("outreach_messages").insert({
        contact_id: contactId,
        channel: "whatsapp",
        direction: "inbound",
        message_text: messageText,
        status: "delivered",
        provider: "evolution",
        provider_message_id: key?.id ?? null,
        sent_at: timestamp,
        metadata: {
          remote_jid: remoteJid,
          phone,
          instance: payload?.instance,
          push_name: data?.pushName ?? null,
        },
      });

      console.log(`[evolution-webhook] Inbound from ${phone} → contact ${contactId || "unknown"}`);
      return ok({ received: true, direction: "inbound", contact_id: contactId });
    }

    // ── Status update (delivery/read receipts) ──
    if (event === "messages.update") {
      const updates = Array.isArray(payload?.data) ? payload.data : [payload?.data];

      for (const update of updates) {
        const messageId = update?.key?.id;
        const status = update?.update?.status;
        if (!messageId || !status) continue;

        // Map Evolution status codes to our statuses
        // 2 = sent, 3 = delivered, 4 = read
        let mappedStatus: string | null = null;
        if (status === 3 || status === "DELIVERY_ACK") mappedStatus = "delivered";
        if (status === 4 || status === "READ") mappedStatus = "read";
        if (status === 5 || status === "PLAYED") mappedStatus = "read";

        if (mappedStatus) {
          await supabase
            .from("outreach_messages")
            .update({ status: mappedStatus })
            .eq("provider_message_id", messageId)
            .eq("direction", "outbound");

          console.log(`[evolution-webhook] Status update: ${messageId} → ${mappedStatus}`);
        }
      }

      return ok({ received: true, type: "status_update" });
    }

    // Other events — acknowledge but don't process
    console.log(`[evolution-webhook] Unhandled event: ${event}`);
    return ok({ received: true, event });
  } catch (error) {
    console.error("[evolution-webhook] Error:", error);
    return new Response(JSON.stringify({ error: "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}
