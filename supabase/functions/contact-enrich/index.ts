import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { contactId, contactIds } = await req.json();
    const ids: string[] = contactIds || (contactId ? [contactId] : []);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "contactId or contactIds required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all enrichment keys EXCLUSIVELY from Vault — no env fallback
    const loadKey = async (name: string): Promise<string> => {
      const { data } = await supabase.rpc("get_vault_key", { p_service_name: name });
      return (data as string) || "";
    };
    const [APIFY_TOKEN, TAVILY_KEY, PDL_KEY] = await Promise.all([
      loadKey("apify"),
      loadKey("tavily"),
      loadKey("pdl"),
    ]);

    const { data: contacts, error } = await supabase.from("contacts").select("*").in("id", ids);
    if (error || !contacts?.length) {
      return new Response(JSON.stringify({ success: false, error: "Contacts not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let enrichedCount = 0;

    for (const contact of contacts) {
      const cf = contact.custom_fields || {};
      const newData: Record<string, any> = {};
      const newCustom: Record<string, any> = {};
      const enrichSources: string[] = [];

      // ─── Step 1: Instagram Profile ───
      if (contact.instagram && (!cf.email && !contact.phone)) {
        try {
          const igData = await enrichFromInstagramProfile(contact.instagram, APIFY_TOKEN);
          if (igData) {
            if (igData.email && !cf.email) { newCustom.email = igData.email; enrichSources.push("ig-profile"); }
            if (igData.phone && !contact.phone) { newData.phone = igData.phone; enrichSources.push("ig-profile"); }
            if (igData.website && !cf.website) newCustom.website = igData.website;
            if (igData.bio && !cf.bio) newCustom.bio = igData.bio;
            if (igData.followers) newCustom.followers = igData.followers;
            if (igData.isBusinessAccount) newCustom.is_business = true;
          }
        } catch (e) { console.error(`[enrich] IG error for ${contact.instagram}:`, e); }
      }

      // ─── Step 2: Website Contact Scraper ───
      const website = newCustom.website || cf.website;
      if (website && (!cf.email || !contact.phone)) {
        try {
          const siteData = await enrichFromWebsite(website, APIFY_TOKEN);
          if (siteData) {
            if (siteData.email && !cf.email && !newCustom.email) { newCustom.email = siteData.email; enrichSources.push("website"); }
            if (siteData.phone && !contact.phone && !newData.phone) { newData.phone = siteData.phone; enrichSources.push("website"); }
            if (siteData.whatsapp) newCustom.whatsapp = siteData.whatsapp;
            if (siteData.allEmails?.length) newCustom.all_emails = siteData.allEmails;
            if (siteData.allPhones?.length) newCustom.all_phones = siteData.allPhones;
          }
        } catch (e) { console.error(`[enrich] Website error for ${website}:`, e); }
      }

      // ─── Step 3: Tavily Search ───
      const hasEmail = cf.email || newCustom.email;
      const hasPhone = contact.phone || newData.phone;
      if (!hasEmail || !hasPhone) {
        try {
          const tavilyData = await enrichFromTavily(contact.name, cf.title || contact.title, contact.city, TAVILY_KEY);
          if (tavilyData) {
            if (tavilyData.email && !hasEmail) { newCustom.email = tavilyData.email; enrichSources.push("tavily"); }
            if (tavilyData.phone && !hasPhone) { newData.phone = tavilyData.phone; enrichSources.push("tavily"); }
            if (tavilyData.website && !cf.website && !newCustom.website) newCustom.website = tavilyData.website;
          }
        } catch (e) { console.error(`[enrich] Tavily error for ${contact.name}:`, e); }
      }

      // ─── Step 4: PDL ───
      const hasEmail2 = cf.email || newCustom.email;
      const hasPhone2 = contact.phone || newData.phone;
      if (!hasEmail2 || !hasPhone2) {
        try {
          const pdlData = await enrichFromPDL(contact.name, cf.title || contact.title, contact.city, contact.linkedin_url, PDL_KEY);
          if (pdlData) {
            if (pdlData.email && !hasEmail2) { newCustom.email = pdlData.email; enrichSources.push("pdl"); }
            if (pdlData.phone && !hasPhone2) { newData.phone = pdlData.phone; enrichSources.push("pdl"); }
            if (pdlData.linkedin && !contact.linkedin_url) newData.linkedin_url = pdlData.linkedin;
            if (pdlData.title && !contact.title) newCustom.title = pdlData.title;
            if (pdlData.company && !contact.company) newData.company = pdlData.company;
          }
        } catch (e) { console.error(`[enrich] PDL error for ${contact.name}:`, e); }
      }

      // ─── Apply updates ───
      if (Object.keys(newData).length > 0 || Object.keys(newCustom).length > 0 || enrichSources.length > 0) {
        const mergedCustom = { ...cf, ...newCustom, enriched_at: new Date().toISOString(), enrich_sources: [...(cf.enrich_sources || []), ...enrichSources] };
        const tags = [...new Set([...(contact.tags || []), "enriched"])];

        await supabase.from("contacts").update({
          ...newData,
          custom_fields: mergedCustom,
          tags,
          updated_at: new Date().toISOString(),
        }).eq("id", contact.id);

        enrichedCount++;
        console.log(`[enrich] ${contact.name}: enriched via ${enrichSources.join(", ") || "no new data"}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      enriched: enrichedCount,
      total: contacts.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[enrich] Error:", error);
    return new Response(JSON.stringify({
      success: false, error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ─── Instagram Profile Enrichment ───
async function enrichFromInstagramProfile(username: string, APIFY_TOKEN: string): Promise<any | null> {
  if (!APIFY_TOKEN) return null;

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${APIFY_TOKEN}` };
  const params = new URLSearchParams({ waitForFinish: "60", maxItems: "1", timeout: "120", maxTotalChargeUsd: "0.5" });

  const resp = await fetch(`https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?${params}`, {
    method: "POST", headers,
    body: JSON.stringify({ usernames: [username], resultsLimit: 1 }),
  });

  if (!resp.ok) return null;
  let run = (await resp.json()).data;

  let polls = 0;
  while ((run.status === "RUNNING" || run.status === "READY") && polls < 2) {
    polls++;
    const pollResp = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?waitForFinish=30`, { headers });
    run = (await pollResp.json()).data;
  }
  if (run.status !== "SUCCEEDED") return null;

  const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?format=json&limit=1`, { headers })).json();
  const p = items?.[0];
  if (!p) return null;

  return {
    email: p.businessEmail || p.publicEmail || null,
    phone: p.businessPhoneNumber || p.contactPhoneNumber || null,
    website: p.externalUrl || null,
    bio: p.biography || null,
    followers: p.followersCount || null,
    isBusinessAccount: p.isBusinessAccount || false,
  };
}

// ─── Website Contact Scraper ───
async function enrichFromWebsite(url: string, APIFY_TOKEN: string): Promise<any | null> {
  if (!APIFY_TOKEN) return null;

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${APIFY_TOKEN}` };
  const params = new URLSearchParams({ waitForFinish: "60", maxItems: "5", timeout: "120", maxTotalChargeUsd: "0.5" });

  const resp = await fetch(`https://api.apify.com/v2/acts/vdrmota~contact-info-scraper/runs?${params}`, {
    method: "POST", headers,
    body: JSON.stringify({ startUrls: [{ url }], maxRequestsPerStartUrl: 3 }),
  });

  if (!resp.ok) return null;
  let run = (await resp.json()).data;

  let polls = 0;
  while ((run.status === "RUNNING" || run.status === "READY") && polls < 2) {
    polls++;
    const pollResp = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?waitForFinish=30`, { headers });
    run = (await pollResp.json()).data;
  }
  if (run.status !== "SUCCEEDED") return null;

  const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?format=json&limit=5`, { headers })).json();

  const allEmails: string[] = [];
  const allPhones: string[] = [];
  let whatsapp = "";

  for (const item of items || []) {
    if (item.emails) allEmails.push(...item.emails);
    if (item.phones) allPhones.push(...item.phones);
    if (item.phoneNumbers) allPhones.push(...item.phoneNumbers);
    if (item.whatsapp) whatsapp = item.whatsapp;
    if (item.socialUrls?.whatsapp) whatsapp = item.socialUrls.whatsapp;
  }

  return {
    email: [...new Set(allEmails)][0] || null,
    phone: [...new Set(allPhones)][0] || null,
    whatsapp: whatsapp || null,
    allEmails: [...new Set(allEmails)],
    allPhones: [...new Set(allPhones)],
  };
}

// ─── Tavily Search Enrichment ───
async function enrichFromTavily(name: string, title: string, city: string, TAVILY_KEY: string): Promise<any | null> {
  if (!TAVILY_KEY || !name) return null;

  const query = `"${name}" ${title || ""} ${city || ""} contato telefone email`.trim();

  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();

  let email = "";
  let phone = "";
  let website = "";

  for (const r of data.results || []) {
    const text = `${r.title || ""} ${r.content || ""} ${r.url || ""}`;
    if (!email) {
      const m = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
      if (m) email = m[0];
    }
    if (!phone) {
      const m = text.match(/\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/);
      if (m) phone = m[0];
    }
    if (!website && r.url && !r.url.includes("facebook.com") && !r.url.includes("instagram.com") && !r.url.includes("linkedin.com")) {
      website = r.url;
    }
  }

  return (email || phone || website) ? { email: email || null, phone: phone || null, website: website || null } : null;
}

// ─── People Data Labs Enrichment ───
async function enrichFromPDL(name: string, title: string, city: string, linkedinUrl: string, PDL_KEY: string): Promise<any | null> {
  if (!PDL_KEY || !name) return null;

  let params: Record<string, string> = {};
  if (linkedinUrl) {
    params = { profile: linkedinUrl };
  } else {
    params = { name, location: city || "Brazil", titleRole: title || "" };
  }

  const url = new URL("https://api.peopledatalabs.com/v5/person/enrich");
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString(), {
    headers: { "X-Api-Key": PDL_KEY },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (data.status !== 200 || !data.data) return null;

  const p = data.data;
  return {
    email: p.work_email || p.personal_emails?.[0] || null,
    phone: p.mobile_phone || p.phone_numbers?.[0] || null,
    linkedin: p.linkedin_url || null,
    title: p.job_title || null,
    company: p.job_company_name || null,
  };
}
