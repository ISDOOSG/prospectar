import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { contacts, template_hint } = await req.json();

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "contacts array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate openers for each contact
    const results = [];

    for (const contact of contacts) {
      const { name, title, company, city, instagram, tags, custom_fields } = contact;

      const contextParts = [];
      if (name) contextParts.push(`Nome: ${name}`);
      if (title) contextParts.push(`Profissão/Cargo: ${title}`);
      if (company) contextParts.push(`Empresa: ${company}`);
      if (city) contextParts.push(`Cidade: ${city}`);
      if (instagram) contextParts.push(`Instagram: @${instagram.replace("@", "")}`);
      if (tags?.length) contextParts.push(`Tags: ${tags.join(", ")}`);
      if (custom_fields) {
        const cf = typeof custom_fields === "string" ? JSON.parse(custom_fields) : custom_fields;
        if (cf.biography) contextParts.push(`Bio: ${cf.biography}`);
        if (cf.followersCount) contextParts.push(`Seguidores: ${cf.followersCount}`);
        if (cf.category) contextParts.push(`Categoria: ${cf.category}`);
      }

      const contactContext = contextParts.join("\n");

      const systemPrompt = `Você é um copywriter especialista em cold outreach via WhatsApp para o mercado brasileiro.
Sua função é criar mensagens de abertura (openers) personalizadas que maximizem a taxa de resposta.

REGRAS:
- Mensagem curta (2-4 linhas no máximo)
- Tom casual e profissional — como se fosse uma pessoa real mandando
- Use os dados do contato para personalizar (nome, profissão, cidade, etc)
- NÃO use emojis em excesso (máximo 1-2)
- NÃO pareça robô ou template genérico
- NÃO use "Prezado(a)" ou linguagem formal demais
- Comece com algo que mostre que você pesquisou sobre a pessoa
- Gere exatamente 3 variações com abordagens diferentes
- IMPORTANTE: responda APENAS em JSON válido

${template_hint ? `CONTEXTO ADICIONAL DO USUÁRIO: ${template_hint}` : ""}`;

      const userPrompt = `Gere 3 openers personalizados para este contato:

${contactContext}

Responda em JSON: {"openers": ["mensagem1", "mensagem2", "mensagem3"]}`;

      const aiResp = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
          response_format: { type: "json_object" },
        }),
      });

      if (!aiResp.ok) {
        console.error("AI Gateway error:", await aiResp.text());
        results.push({ contact_id: contact.id, openers: [], error: "AI generation failed" });
        continue;
      }

      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content || "{}";

      try {
        const parsed = JSON.parse(content);
        results.push({
          contact_id: contact.id,
          contact_name: name,
          openers: parsed.openers || [],
        });
      } catch {
        results.push({ contact_id: contact.id, openers: [content], error: "Parse failed" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-opener error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
