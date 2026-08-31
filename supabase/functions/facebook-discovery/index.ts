import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/*
 Facebook Discovery Agent
 ========================
 Autonomous multi-step agent that finds people on Facebook.

 Pipeline:
 1. DISCOVER — Find relevant groups and pages via Tavily + Apify search
 2. EXTRACT  — Scrape posts, comments, page contacts, reviews
 3. PARSE    — Extract emails, phones, WhatsApp from text content
 4. ENRICH   — Dedup, score, normalize into contacts
*/

const APIFY_BASE = "https://api.apify.com/v2";

// ─── Apify Runner (reusable) ───
async function runApifyActor(actorId: string, input: any, token: string, timeoutSec = 120, maxItems = 50): Promise<any[]> {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const params = new URLSearchParams({ waitForFinish: String(timeoutSec), maxItems: String(maxItems), timeout: String(timeoutSec + 30), maxTotalChargeUsd: "1.0" });

  try {
    const resp = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?${params}`, {
      method: "POST", headers, body: JSON.stringify(input),
    });
    if (!resp.ok) { console.error(`[fb-agent] ${actorId} start error: ${resp.status}`); return []; }

    let run = (await resp.json()).data;
    let polls = 0;
    while ((run.status === "RUNNING" || run.status === "READY") && polls < 3) {
      polls++;
      try {
        const pr = await fetch(`${APIFY_BASE}/actor-runs/${run.id}?waitForFinish=30`, { headers });
        run = (await pr.json()).data;
      } catch { break; }
    }

    if (run.status !== "SUCCEEDED") { console.warn(`[fb-agent] ${actorId} ended: ${run.status}`); return []; }
    if (!run.defaultDatasetId) return [];

    const dr = await fetch(`${APIFY_BASE}/datasets/${run.defaultDatasetId}/items?format=json&clean=true&limit=${maxItems}`, { headers });
    if (!dr.ok) return [];
    const items = await dr.json();
    return Array.isArray(items) ? items : [];
  } catch (e: any) {
    console.error(`[fb-agent] ${actorId} error: ${e.message}`);
    return [];
  }
}

// ─── Text Parsers ───
function extractPhones(text: string): string[] {
  return [...new Set((text.match(/\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/g) || []))];
}
function extractEmails(text: string): string[] {
  return [...new Set((text.match(/[\w.-]+@[\w.-]+\.\w{2,}/g) || []))].filter(e => !e.includes("facebook") && !e.includes("sentry"));
}
function extractWhatsApp(text: string): string[] {
  return [...new Set((text.match(/wa\.me\/(\d{10,15})/g) || []).map(m => m.replace("wa.me/", "")))];
}

// ─── Tavily Helper ───
async function tavilySearch(query: string, key: string, maxResults = 5): Promise<any[]> {
  if (!key) return [];
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query, search_depth: "basic", max_results: maxResults, include_answer: false, include_raw_content: false }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch { return []; }
}

// ─── Main Agent ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Read keys EXCLUSIVELY from Vault — no env fallback
  const { data: APIFY_TOKEN } = await supabase.rpc("get_vault_key", { p_service_name: "apify" });
  const { data: TAVILY_KEY } = await supabase.rpc("get_vault_key", { p_service_name: "tavily" });

  if (!APIFY_TOKEN) {
    return new Response(JSON.stringify({ error: "Apify não configurado no Vault. Vá em Configurações → API Keys." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { searchId, config, listId } = await req.json();

    const professions = config?.persona?.professions || [];
    const interests = config?.persona?.interests || [];
    const locations = config?.location?.person_locations || [];
    const limit = config?.volume?.per_page || 25;
    const query = [...professions, ...interests, ...locations].join(" ") || "profissional";

    console.log(`[fb-agent] Starting for: "${query}", limit: ${limit}`);

    const allContacts: any[] = [];
    const seenNames = new Set<string>();

    // Hard reject patterns — companies, teams, brands, stores
    const GARBAGE = /\b(sport|clube|futebol|football|soccer|fc |united|oficial|official|fan page|meme|news|magazine|store|shop|loja|marketplace|hotel|hostel|resort|farmácia|supermercado|atacad|wikipedia|governo|prefeitura|câmara)\b/i;

    const addContact = (c: any) => {
      if (!c.name || c.name.length < 4) return;
      // Reject garbage
      const allText = `${c.name} ${c.company || ""} ${c.custom_fields?.description || ""}`;
      if (GARBAGE.test(allText)) return;
      // Must look like a person name (2+ words, no numbers)
      const words = c.name.trim().split(/\s+/).filter((w: string) => w.length > 1);
      if (words.length < 2 && !/^(Dra?\.|Prof\.)/i.test(c.name)) return;
      if (/\d/.test(c.name)) return;
      if (c.name.length > 60) return;
      // Dedup
      const key = c.name.toLowerCase().trim();
      if (seenNames.has(key)) return;
      seenNames.add(key);
      allContacts.push(c);
    };

    // ════════════════════════════════════════════
    // STEP 1: DISCOVER — Find groups and pages
    // ════════════════════════════════════════════
    console.log("[fb-agent] Step 1: DISCOVER");

    // 1a. Tavily — find Facebook group URLs
    const groupUrls: string[] = [];
    for (const prof of professions.length ? professions : [query]) {
      const loc = locations[0] || "brasil";
      const results = await tavilySearch(`site:facebook.com/groups "${prof}" "${loc}"`, TAVILY_KEY, 5);
      for (const r of results) {
        const match = r.url?.match(/facebook\.com\/groups\/([^/?]+)/);
        if (match) groupUrls.push(`https://www.facebook.com/groups/${match[1]}/`);
      }
    }
    const uniqueGroupUrls = [...new Set(groupUrls)].slice(0, 5);
    console.log(`[fb-agent] Found ${uniqueGroupUrls.length} group URLs via Tavily`);

    // 1b. Facebook Search PPR — find pages with contact info
    const searchResults = await runApifyActor(
      "danek~facebook-search-ppr",
      { query, maxResults: Math.min(limit, 30), type: "page" },
      APIFY_TOKEN, 90, 30,
    );
    console.log(`[fb-agent] FB Search PPR returned ${searchResults.length} pages`);

    for (const r of searchResults) {
      const phones = extractPhones(JSON.stringify(r));
      const emails = extractEmails(JSON.stringify(r));
      addContact({
        name: r.name || r.title || "",
        phone: phones[0] || r.phone || "",
        email: emails[0] || r.email || "",
        company: r.name || "",
        city: r.address || r.location || locations[0] || "",
        tags: ["facebook-page"],
        custom_fields: {
          source_url: r.url || r.profileUrl || "",
          website: r.website || "",
          category: r.category || "",
          likes: r.likes || r.likesCount || null,
          all_phones: phones.slice(0, 5),
          all_emails: emails.slice(0, 5),
          description: (r.about || r.description || "").slice(0, 500),
        },
      });
    }

    // ════════════════════════════════════════════
    // STEP 2: EXTRACT — Scrape groups for people
    // ════════════════════════════════════════════
    console.log("[fb-agent] Step 2: EXTRACT from groups");

    if (uniqueGroupUrls.length > 0) {
      // 2a. Group posts — extract authors and contacts from text
      const groupPosts = await runApifyActor(
        "apify~facebook-groups-scraper",
        { startUrls: uniqueGroupUrls.map(url => ({ url })), maxPosts: Math.min(limit, 30) },
        APIFY_TOKEN, 120, limit,
      );
      console.log(`[fb-agent] Group posts: ${groupPosts.length}`);

      for (const post of groupPosts) {
        if (post.error) continue;
        const text = post.text || "";
        const userName = post.user?.name || post.userName || "";
        const phones = extractPhones(text);
        const emails = extractEmails(text);
        const whatsapp = extractWhatsApp(text);

        if (userName) {
          const groupName = post.groupTitle || post.groupName || "";
          addContact({
            name: userName,
            phone: phones[0] || "",
            email: emails[0] || "",
            company: groupName ? `Grupo: ${groupName}` : "",
            city: locations[0] || "",
            tags: groupName ? ["facebook-group", groupName] : ["facebook-group"],
            custom_fields: {
              source_url: post.url || "",
              group_name: groupName,
              post_text: text.slice(0, 500),
              user_id: post.user?.id || "",
              whatsapp: whatsapp[0] ? `+${whatsapp[0]}` : "",
              all_phones: phones.slice(0, 5),
              all_emails: emails.slice(0, 5),
              likes: post.likesCount || post.topReactionsCount || 0,
              comments_count: post.commentsCount || 0,
            },
          });
        }

        // Also extract contacts from top comments
        for (const comment of post.topComments || []) {
          const cName = comment.name || comment.profileName || "";
          if (cName) {
            const cText = comment.text || "";
            const cPhones = extractPhones(cText);
            const cEmails = extractEmails(cText);
            const cGroupName = post.groupTitle || post.groupName || "";
            addContact({
              name: cName,
              phone: cPhones[0] || "",
              email: cEmails[0] || "",
              company: cGroupName ? `Grupo: ${cGroupName}` : "",
              city: locations[0] || "",
              tags: cGroupName ? ["facebook-commenter", cGroupName] : ["facebook-commenter"],
              custom_fields: {
                source_url: post.url || "",
                group_name: cGroupName,
                comment_text: cText.slice(0, 300),
                profile_url: comment.profileUrl || "",
              },
            });
          }
        }
      }
    }

    // ════════════════════════════════════════════
    // STEP 3: PAGE CONTACT INFO — direct extraction
    // ════════════════════════════════════════════
    console.log("[fb-agent] Step 3: PAGE CONTACTS");

    // Use Facebook Page Contact Info actor for pages found in Step 1
    const pageUrls = searchResults
      .map(r => r.url || r.profileUrl || "")
      .filter(u => u.includes("facebook.com"))
      .slice(0, 10);

    if (pageUrls.length > 0) {
      const pageContacts = await runApifyActor(
        "apify~facebook-pages-scraper",
        { startUrls: pageUrls.map(url => ({ url })) },
        APIFY_TOKEN, 90, 20,
      );
      console.log(`[fb-agent] Page contact info: ${pageContacts.length}`);

      for (const p of pageContacts) {
        const phones = p.phone ? [p.phone] : extractPhones(JSON.stringify(p));
        const emails = p.email ? [p.email] : extractEmails(JSON.stringify(p));
        if (phones.length || emails.length) {
          addContact({
            name: p.name || p.title || "",
            phone: phones[0] || "",
            email: emails[0] || "",
            company: p.name || "",
            city: p.address || p.city || locations[0] || "",
            tags: ["facebook-page-contact"],
            custom_fields: {
              source_url: p.url || "",
              website: p.website || "",
              category: p.category || p.categories?.[0] || "",
              all_phones: phones.slice(0, 5),
              all_emails: emails.slice(0, 5),
            },
          });
        }
      }
    }

    // ════════════════════════════════════════════
    // STEP 4: REVIEWS — real people who review businesses
    // ════════════════════════════════════════════
    if (pageUrls.length > 0) {
      console.log("[fb-agent] Step 4: REVIEWS");
      const reviews = await runApifyActor(
        "apify~facebook-reviews-scraper",
        { startUrls: pageUrls.slice(0, 5).map(url => ({ url })), maxReviews: Math.min(limit, 20) },
        APIFY_TOKEN, 90, 30,
      );
      console.log(`[fb-agent] Reviews: ${reviews.length}`);

      for (const r of reviews) {
        const reviewerName = r.reviewer?.name || r.reviewerName || r.author || "";
        if (reviewerName) {
          addContact({
            name: reviewerName,
            phone: "",
            email: "",
            company: "",
            city: locations[0] || "",
            tags: ["facebook-reviewer"],
            custom_fields: {
              source_url: r.url || "",
              review_text: (r.text || r.reviewText || "").slice(0, 500),
              rating: r.rating || r.stars || null,
              reviewer_url: r.reviewer?.url || r.reviewerUrl || "",
              page_name: r.pageName || "",
            },
          });
        }
      }
    }

    // ════════════════════════════════════════════
    // FINALIZE — Save to database
    // ════════════════════════════════════════════
    console.log(`[fb-agent] DONE: ${allContacts.length} contacts from Facebook`);

    // Save if searchId and listId provided
    let newCount = 0;
    if (listId) {
      for (const c of allContacts) {
        const phone = c.phone ? normalizeBRPhone(c.phone) : null;
        const { data: result } = await supabase.rpc("upsert_lead_contact", {
          p_name: c.name || "",
          p_phone: phone || "",
          p_company: c.company || "",
          p_city: c.city || "",
          p_tags: c.tags || ["facebook"],
          p_list_id: listId,
          p_custom_fields: {
            email: c.email || "",
            source_search_id: searchId || null,
            ...c.custom_fields,
          },
          p_score: 0,
          p_source: "facebook_discovery",
        });
        if (result?.is_new) newCount++;
      }
    }

    // Update search record if provided
    if (searchId) {
      await supabase.from("lead_searches").update({
        status: "completed",
        contacts_found: allContacts.length,
        contacts_new: newCount,
        result_data: allContacts,
        completed_at: new Date().toISOString(),
      }).eq("id", searchId);
    }

    return new Response(JSON.stringify({
      success: true,
      contacts: allContacts.length,
      contacts_new: newCount,
      steps: {
        groups_found: uniqueGroupUrls.length,
        pages_found: searchResults.length,
        page_urls: pageUrls.length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[fb-agent] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function normalizeBRPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    if (parseInt(num[0], 10) >= 6) digits = ddd + "9" + num;
  }
  return "55" + digits;
}
