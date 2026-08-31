import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente de prospecção de PESSOAS FÍSICAS (B2C) chamado ProspectAI. Seu foco é encontrar PESSOAS — não empresas.

Quando o usuário descrever quem quer encontrar, extraia:
- Profissão / atividade (ex: dentista, personal trainer, nutricionista, advogado)
- Localização (cidade, estado, bairro)
- Interesses / nicho (ex: estética dental, emagrecimento, direito trabalhista)
- Plataforma / fonte preferida
- Volume de leads desejado

Fontes disponíveis — TODAS extraem PESSOAS FÍSICAS por profissão + localização (busca por termos, não precisam de URLs):

**Bases profissionais (melhor para profissionais liberais e com email/telefone):**
- apollo_search: base Apollo — cargos, email verificado. Ótimo para profissionais e tomadores de decisão.
- pdl_search: People Data Labs — perfis por cargo + país, traz email/telefone/redes.
- crustdata_search: perfis por headline + localização.
- apify_linkedin_search: profissionais no LinkedIn por cargo e localização.

**Negócios locais (melhor para profissionais com estabelecimento — dentistas, clínicas, estúdios):**
- google_maps: estabelecimentos no Google Maps com telefone, site e Instagram.

**Redes sociais (melhor para profissionais digitais e criadores):**
- apify_instagram: pessoas no Instagram por profissão/interesse.
- apify_twitter: autores de tweets sobre temas relevantes.
- apify_tiktok: criadores de conteúdo por tema.

**Busca web aberta:**
- tavily_search: varre a web e extrai telefone, email, WhatsApp e Instagram de qualquer profissional.

**Todas:**
- all: roda Apollo, Google Maps, CrustData, LinkedIn, Instagram, Twitter, TikTok, Tavily e PDL em paralelo, mescla e deduplica. Use quando o usuário não especificar a fonte.

Regras:
1. Para profissionais liberais (advogados, contadores, médicos, engenheiros): priorize apollo_search ou apify_linkedin_search.
2. Para profissionais com estabelecimento físico (dentistas, clínicas, salões): priorize google_maps.
3. Para profissionais digitais / criadores (personal trainers, coaches, nutricionistas influenciadores): priorize apify_instagram.
4. Quando precisar de telefone/WhatsApp direto e o nicho for amplo: use tavily_search ou google_maps.
5. Na dúvida ou quando o usuário não especificar fonte: use "all".
6. NUNCA invente fontes — use SOMENTE os valores do enum source.
7. Responda sempre em português brasileiro.
8. Seja direto, objetivo e amigável.
9. Use markdown para formatar respostas.
10. Quando tiver informações suficientes, execute a busca automaticamente — não peça confirmação.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, systemPrompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const finalPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: finalPrompt },
          ...messages,
        ],
        stream: true,
        tools: [{
          type: "function",
          function: {
            name: "configure_search",
            description: "Configura e executa uma busca de PESSOAS FÍSICAS",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome descritivo da busca" },
                source: { type: "string", enum: [
                  "apollo_search",
                  "pdl_search",
                  "crustdata_search",
                  "apify_linkedin_search",
                  "google_maps",
                  "apify_instagram",
                  "apify_twitter",
                  "apify_tiktok",
                  "tavily_search",
                  "all",
                ] },
                config: {
                  type: "object",
                  properties: {
                    persona: {
                      type: "object",
                      properties: {
                        professions: { type: "array", items: { type: "string" }, description: "Profissões/atividades das pessoas (ex: dentista, nutricionista)" },
                        titles: { type: "array", items: { type: "string" }, description: "Cargos/títulos profissionais (ex: diretor de marketing)" },
                        specialties: { type: "array", items: { type: "string" }, description: "Especialidades/sub-nichos (ex: ortodontia, emagrecimento)" },
                        interests: { type: "array", items: { type: "string" }, description: "Interesses/nichos" },
                        keywords: { type: "array", items: { type: "string" }, description: "Palavras-chave livres para refinar a busca" },
                        industries: { type: "array", items: { type: "string" }, description: "Setores/indústrias" },
                        seniority: { type: "array", items: { type: "string" }, description: "Senioridade: Estagiário, Júnior, Pleno, Sênior, Especialista, Coordenador, Gerente, Diretor, VP, C-Level, Fundador/Sócio" },
                        exclude_keywords: { type: "array", items: { type: "string" }, description: "Termos que, se presentes, descartam o lead" },
                        freeform_description: { type: "string", description: "Descrição livre do perfil ideal" },
                      },
                    },
                    location: {
                      type: "object",
                      properties: {
                        person_locations: { type: "array", items: { type: "string" }, description: "Cidades/estados (ex: São Paulo, RJ)" },
                      },
                    },
                    volume: {
                      type: "object",
                      properties: {
                        per_page: { type: "number", description: "Quantidade de pessoas a buscar (padrão 25)" },
                      },
                    },
                    contact_requirements: {
                      type: "object",
                      properties: {
                        require_phone: { type: "boolean", description: "Só manter leads com telefone" },
                        require_email: { type: "boolean", description: "Só manter leads com email" },
                      },
                    },
                    social: {
                      type: "object",
                      properties: {
                        require_instagram: { type: "boolean", description: "Só manter leads com Instagram" },
                        require_linkedin: { type: "boolean", description: "Só manter leads com LinkedIn" },
                        min_followers: { type: "number", description: "Mínimo de seguidores" },
                      },
                    },
                    demographics: {
                      type: "object",
                      properties: {
                        gender: { type: "string", description: "Filtrar por gênero quando a fonte fornecer (male/female)" },
                      },
                    },
                  },
                },
              },
              required: ["name", "source", "config"],
            },
          },
        }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em breve." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
